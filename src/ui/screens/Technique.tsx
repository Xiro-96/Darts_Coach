import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronRight, ListChecks, Play, Plus, RotateCcw, Trash2, Video } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../data/store';
import type { TechniqueId } from '../../domain/drills/catalog';
import { DEFAULT_ROUTINE, type RoutineStep, type TechniqueStatus } from '../../domain/models';
import { newId } from '../../domain/session';
import { getTechnique, TECHNIQUE } from '../../domain/technique';
import { navigate } from '../router';
import { startSingleDrill } from '../startSession';
import { RoutinePlayer } from '../technique/RhythmTools';
import { StanceIllustration } from '../technique/Illustrations';
import { Button, Card, Chip, cx, EmptyState, inputClass, PageHeader, SectionTitle } from '../components/ui';

const STATUS_LABEL: Record<TechniqueStatus, string> = { new: 'Neu', working: 'In Arbeit', solid: 'Sitzt' };

export function TechniqueHome() {
  const profile = useApp((s) => s.profile)!;
  const solid = TECHNIQUE.filter((t) => profile.techniqueStatus[t.id] === 'solid').length;
  return (
    <div className="pb-6">
      <PageHeader title="Technik-Coach" subtitle="Einen natürlichen, wiederholbaren Wurf entwickeln" />
      <Card className="p-5">
        <p className="leading-relaxed text-ink-1">
          Es gibt nicht <em>die</em> perfekte Technik. Ziel ist eine Bewegung, die sich für dich natürlich anfühlt und die du jedes Mal gleich ausführen kannst.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" /> Pro Training nur <strong className="text-ink-1">ein</strong> Technikthema verändern.
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" /> Beim Wurf selbst ans Ziel denken – nicht an den Arm.
          </li>
          <li className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" /> Eine Veränderung braucht einige Einheiten, bis sie sich normal anfühlt.
          </li>
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {TECHNIQUE.map((t) => (
              <span key={t.id} className={cx('h-2 flex-1 rounded-full', profile.techniqueStatus[t.id] === 'solid' ? 'bg-accent' : profile.techniqueStatus[t.id] === 'working' ? 'bg-flare' : 'bg-surface-3')} />
            ))}
          </div>
          <span className="text-sm tabular text-ink-2">{solid}/7 sitzen</span>
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4" onClick={() => navigate('/technique/routine')} as="button">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <ListChecks size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Meine Pre-Throw-Routine</div>
              <div className="text-sm text-ink-2">{profile.routine.map((r) => r.label).join(' → ')}</div>
            </div>
            <ChevronRight className="text-ink-3" />
          </div>
        </Card>
        <Card className="p-4" onClick={() => navigate('/technique/video')} as="button">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info">
              <Video size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Video-Analyse</div>
              <div className="text-sm text-ink-2">Wurf filmen, Zeitlupe, zwei Würfe vergleichen</div>
            </div>
            <ChevronRight className="text-ink-3" />
          </div>
        </Card>
      </div>

      <SectionTitle>Die sieben Bausteine</SectionTitle>
      <div className="flex flex-col gap-2">
        {TECHNIQUE.map((t) => {
          const st = profile.techniqueStatus[t.id] ?? 'new';
          return (
            <Card key={t.id} className="flex items-center gap-3 p-4" onClick={() => navigate(`/technique/${t.id}`)} as="button">
              <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-xl">{t.order}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.title}</div>
                <div className="truncate text-sm text-ink-2">{t.short}</div>
              </div>
              <Chip tone={st === 'solid' ? 'accent' : st === 'working' ? 'flare' : 'neutral'}>{STATUS_LABEL[st]}</Chip>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TechniqueTopicScreen({ id }: { id: string }) {
  const profile = useApp((s) => s.profile)!;
  const updateProfile = useApp((s) => s.updateProfile);
  const active = useApp((s) => s.active);
  const topic = TECHNIQUE.find((t) => t.id === id);
  const [checked, setChecked] = useState<number[]>([]);
  const [note, setNote] = useState(() => (topic ? profile.techniqueNotes[topic.id] ?? '' : ''));
  if (!topic) return <EmptyState icon={<AlertTriangle />} title="Thema nicht gefunden" text="" action={<Button onClick={() => navigate('/technique')}>Zurück</Button>} />;
  const status = profile.techniqueStatus[topic.id] ?? 'new';
  const setStatus = (s: TechniqueStatus) => updateProfile((p) => ({ ...p, techniqueStatus: { ...p.techniqueStatus, [topic.id]: s } }));
  const saveNote = () => updateProfile((p) => ({ ...p, techniqueNotes: { ...p.techniqueNotes, [topic.id]: note } }));

  return (
    <div className="pb-6">
      <PageHeader title={topic.title} subtitle={topic.short} backTo="/technique" />
      <div className="flex gap-2" role="radiogroup" aria-label="Status">
        {(['new', 'working', 'solid'] as TechniqueStatus[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={status === s}
            onClick={() => setStatus(s)}
            className={cx('h-10 flex-1 rounded-xl text-sm font-semibold', status === s ? (s === 'solid' ? 'bg-accent text-[#05170d]' : s === 'working' ? 'bg-flare text-[#1d0d02]' : 'bg-surface-3 text-ink-1') : 'bg-surface-2 text-ink-3')}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="label">Warum das wichtig ist</div>
        <p className="mt-2 leading-relaxed text-ink-1">{topic.why}</p>
      </Card>

      {topic.id === 'stance' && (
        <Card className="mt-3 p-4">
          <StanceIllustration hand={profile.hand} />
        </Card>
      )}

      <SectionTitle>So gehst du vor</SectionTitle>
      <Card className="p-5">
        <ol className="space-y-3">
          {topic.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm text-accent">{i + 1}</span>
              <span className="text-ink-1">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      {topic.options && (
        <>
          <SectionTitle>Varianten – finde, was zu dir passt</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-3">
            {topic.options.map((o) => (
              <Card key={o.title} className="p-4">
                <div className="font-semibold">{o.title}</div>
                <p className="mt-1 text-sm text-ink-2">{o.text}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Selbstcheck</SectionTitle>
      <Card className="divide-y divide-line">
        {topic.checkpoints.map((c, i) => {
          const on = checked.includes(i);
          return (
            <button key={c} onClick={() => setChecked((x) => (on ? x.filter((y) => y !== i) : [...x, i]))} className="flex w-full items-start gap-3 px-4 py-3 text-left" aria-pressed={on}>
              <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border', on ? 'border-accent bg-accent text-[#05170d]' : 'border-line-strong')}>{on && <Check size={14} strokeWidth={3} />}</span>
              <span className="text-sm">{c}</span>
            </button>
          );
        })}
      </Card>

      <SectionTitle>Typische Probleme</SectionTitle>
      <div className="flex flex-col gap-2">
        {topic.mistakes.map((m) => (
          <Card key={m.problem} className="p-4">
            <div className="text-sm font-semibold">Wenn: {m.problem}</div>
            <div className="mt-1 text-sm text-ink-2">Probiere: {m.tryThis}</div>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">Das sind allgemeine Hinweise, keine Diagnose deines Wurfs. Verändere immer nur eine Sache und prüfe über mehrere Einheiten, ob sie hilft.</p>

      <SectionTitle>Meine Notizen</SectionTitle>
      <Card className="p-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          rows={3}
          placeholder={topic.id === 'stance' ? 'z. B. Rechter Fuß 2 cm links vom Bull-Lot, Fußspitze an der Linie …' : 'Was funktioniert für dich?'}
          className={cx(inputClass, 'h-auto py-3')}
          aria-label="Notizen"
        />
      </Card>

      <div className="mt-6">
        <Button size="lg" block disabled={Boolean(active)} onClick={() => startSingleDrill(topic.drillId, 'standard')}>
          <Play size={18} /> Übung: {topic.title} trainieren
        </Button>
      </div>
    </div>
  );
}

export function RoutineScreen() {
  const profile = useApp((s) => s.profile)!;
  const updateProfile = useApp((s) => s.updateProfile);
  const [steps, setSteps] = useState<RoutineStep[]>(profile.routine);
  const [dirty, setDirty] = useState(false);
  const change = (next: RoutineStep[]) => {
    setSteps(next);
    setDirty(true);
  };
  const save = async () => {
    await updateProfile((p) => ({ ...p, routine: steps.filter((s) => s.label.trim()) }));
    setDirty(false);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };
  return (
    <div className="pb-6">
      <PageHeader title="Pre-Throw-Routine" subtitle="Dein fester Ablauf vor jedem Dart" backTo="/technique" />
      <Card className="p-5">
        <RoutinePlayer steps={steps} voiceDefault={profile.voice} />
      </Card>
      <p className="mt-3 text-sm text-ink-2">Tipp: Eine kurze Routine (3–6 Schritte), die du immer machst, ist besser als eine lange, die du vergisst. Nutze Stichworte, die für dich etwas bedeuten.</p>

      <SectionTitle action={<button onClick={() => change(DEFAULT_ROUTINE)} className="flex items-center gap-1 text-sm font-semibold text-ink-3"><RotateCcw size={14} /> Standard</button>}>Schritte anpassen</SectionTitle>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <Card key={s.id} className="p-3">
            <div className="flex items-center gap-2">
              <span className="num w-6 text-center text-lg text-ink-3">{i + 1}</span>
              <input className={cx(inputClass, 'h-10 flex-1')} value={s.label} onChange={(e) => change(steps.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))} aria-label={`Schritt ${i + 1} Name`} />
              <select
                className="h-10 rounded-xl border border-line bg-surface-2 px-2 text-sm"
                value={s.seconds}
                onChange={(e) => change(steps.map((x) => (x.id === s.id ? { ...x, seconds: Number(e.target.value) } : x)))}
                aria-label={`Schritt ${i + 1} Dauer`}
              >
                {[0.5, 1, 1.5, 2, 3, 4].map((v) => (
                  <option key={v} value={v}>
                    {String(v).replace('.', ',')} s
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-8">
              <input className={cx(inputClass, 'h-10 flex-1 text-sm')} value={s.cue} placeholder="Stichwort / Hinweis" onChange={(e) => change(steps.map((x) => (x.id === s.id ? { ...x, cue: e.target.value } : x)))} aria-label={`Schritt ${i + 1} Hinweis`} />
              <button aria-label="Nach oben" onClick={() => move(i, -1)} className="grid h-10 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2">
                <ArrowUp size={16} />
              </button>
              <button aria-label="Nach unten" onClick={() => move(i, 1)} className="grid h-10 w-9 place-items-center rounded-xl bg-surface-2 text-ink-2">
                <ArrowDown size={16} />
              </button>
              <button aria-label="Entfernen" onClick={() => change(steps.filter((x) => x.id !== s.id))} className="grid h-10 w-9 place-items-center rounded-xl bg-bad-soft text-bad">
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
        <Button variant="secondary" onClick={() => change([...steps, { id: newId(), label: 'Neuer Schritt', cue: '', seconds: 1 }])} disabled={steps.length >= 8}>
          <Plus size={18} /> Schritt hinzufügen
        </Button>
      </div>
      {dirty && (
        <div className="sticky bottom-20 mt-6 md:bottom-4">
          <Button size="lg" block onClick={save}>
            Routine speichern
          </Button>
        </div>
      )}
    </div>
  );
}

export function techniqueTitle(id: TechniqueId): string {
  return getTechnique(id).title;
}
