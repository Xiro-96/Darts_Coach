import {
  Award,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Download,
  Flame,
  Gem,
  Hash,
  History,
  Layers,
  MapPin,
  Repeat,
  RotateCw,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { exportData, importData, ImportError, parseImport } from '../../data/db';
import { useApp } from '../../data/store';
import { findDrill } from '../../domain/drills/catalog';
import { badges, levelInfo, totalXp } from '../../domain/gamification';
import type { Goal, PlayerLevel, Profile as P, SessionMinutes } from '../../domain/models';
import { PROGRAMS } from '../../domain/plan';
import { sessionDarts } from '../../domain/stats';
import { navigate } from '../router';
import { Button, Card, Chip, cx, EmptyState, Field, formatDate, formatDuration, inputClass, PageHeader, Ring, SectionTitle, Sheet, Toggle } from '../components/ui';
import { programFor } from './Onboarding';

const BADGE_ICONS: Record<string, LucideIcon> = { Target, MapPin, TrendingUp, Layers, Flame, CalendarCheck, Hash, Gem, Crosshair, RotateCw, Shield, CheckCircle2, Zap, Repeat, Award, Sparkles };

export function ProfileScreen() {
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const updateProfile = useApp((s) => s.updateProfile);
  const xp = totalXp(sessions);
  const lvl = levelInfo(xp);
  const earned = useMemo(() => badges(profile, sessions), [profile, sessions]);
  const set = (patch: Partial<P>) => updateProfile((p) => ({ ...p, ...patch }));

  return (
    <div className="pb-8">
      <PageHeader title="Profil" subtitle="Einstellungen, Ziele, Historie und Dart-Setup" />
      <Card className="flex items-center gap-4 p-5">
        <Ring value={lvl.progress} size={72} stroke={7} tone="flare">
          <span className="num text-2xl">{lvl.level}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">{profile.name}</div>
          <div className="text-sm text-ink-2">
            {lvl.name} · {xp.toLocaleString('de-DE')} XP
          </div>
          <div className="text-xs text-ink-3">Noch {lvl.next - xp} XP bis Level {lvl.level + 1}</div>
        </div>
      </Card>

      <SectionTitle>Abzeichen</SectionTitle>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="badges">
        {earned.map((b) => {
          const Icon = BADGE_ICONS[b.icon] ?? Award;
          return (
            <div key={b.id} className={cx('flex flex-col items-center rounded-2xl border p-3 text-center', b.earned ? 'border-flare/30 bg-flare-soft' : 'border-line bg-surface-1 opacity-50')} title={b.description}>
              <Icon size={22} className={b.earned ? 'text-flare' : 'text-ink-3'} />
              <div className="mt-1.5 text-xs font-semibold leading-tight">{b.title}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-ink-3">{b.description}</div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Training</SectionTitle>
      <Card className="flex flex-col gap-4 p-5">
        <Field label="Name">
          <input className={inputClass} defaultValue={profile.name} onBlur={(e) => set({ name: e.target.value.trim() || 'Spieler' })} />
        </Field>
        <Field label="Niveau">
          <select className={inputClass} value={profile.level} onChange={(e) => set({ level: e.target.value as PlayerLevel })}>
            <option value="beginner">Anfänger</option>
            <option value="intermediate">Fortgeschritten</option>
            <option value="advanced">Erfahren</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Einheiten pro Woche">
            <select className={inputClass} value={profile.sessionsPerWeek} onChange={(e) => set({ sessionsPerWeek: Number(e.target.value) })}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minuten pro Einheit">
            <select className={inputClass} value={profile.sessionMinutes} onChange={(e) => set({ sessionMinutes: Number(e.target.value) as SessionMinutes })}>
              {[10, 20, 30, 45].map((n) => (
                <option key={n} value={n}>
                  {n} Min.
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dart-Art">
            <select className={inputClass} value={profile.dartType} onChange={(e) => set({ dartType: e.target.value as P['dartType'] })}>
              <option value="steel">Steeldart</option>
              <option value="soft">Softdart</option>
            </select>
          </Field>
          <Field label="Wurfhand">
            <select className={inputClass} value={profile.hand} onChange={(e) => set({ hand: e.target.value as P['hand'] })}>
              <option value="right">Rechts</option>
              <option value="left">Links</option>
            </select>
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium text-ink-2">Ziele</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['accuracy', 'Treffsicherheit'],
                ['consistency', 'Konstanz'],
                ['scoring', 'Scoring'],
                ['doubles', 'Doppel'],
                ['checkout', 'Checkout'],
                ['games', '301/501'],
              ] as [Goal, string][]
            ).map(([g, l]) => {
              const on = profile.goals.includes(g);
              return (
                <button key={g} aria-pressed={on} onClick={() => set({ goals: on ? profile.goals.filter((x) => x !== g) : [...profile.goals, g] })} className={cx('h-9 rounded-xl px-3 text-sm font-semibold', on ? 'bg-accent text-[#05170d]' : 'bg-surface-3 text-ink-2')}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Standard-Eingabe">
          <select className={inputClass} value={profile.inputMode} onChange={(e) => set({ inputMode: e.target.value as P['inputMode'] })}>
            <option value="board">Scheibe antippen (mit Positionen)</option>
            <option value="buttons">Tasten (schnell)</option>
          </select>
        </Field>
        <div className="divide-y divide-line">
          <Toggle checked={profile.sound} onChange={(v) => set({ sound: v })} label="Signaltöne" description="Kurzer Ton bei Treffern und Bust" />
          <Toggle checked={profile.voice} onChange={(v) => set({ voice: v })} label="Sprachausgabe" description="Ansagen bei 301/501 und wichtigen Ereignissen" />
        </div>
      </Card>

      <PlanSettings />

      <SectionTitle>Dart-Setup</SectionTitle>
      <Card className="grid gap-3 p-5 sm:grid-cols-2">
        {(
          [
            ['weight', 'Gewicht', 'z. B. 22 g'],
            ['barrel', 'Barrel', 'Form, Material, Grip'],
            ['shaft', 'Schaft', 'Länge, Material'],
            ['flight', 'Flight', 'Form'],
            ['grip', 'Griff', 'z. B. 3-Finger, Daumen hinter Schwerpunkt'],
            ['standMark', 'Standmarkierung', 'z. B. Fußspitze 3 cm links vom Lot'],
          ] as [keyof P['setup'], string, string][]
        ).map(([k, l, ph]) => (
          <Field key={k} label={l}>
            <input className={inputClass} defaultValue={profile.setup[k] ?? ''} placeholder={ph} onBlur={(e) => set({ setup: { ...profile.setup, [k]: e.target.value } })} />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="Notizen">
            <textarea className={cx(inputClass, 'h-auto py-3')} rows={2} defaultValue={profile.setup.notes ?? ''} onBlur={(e) => set({ setup: { ...profile.setup, notes: e.target.value } })} />
          </Field>
        </div>
        <p className="text-xs text-ink-3 sm:col-span-2">Tipp: Verändere dein Material nicht ständig – Konstanz im Setup hilft der Konstanz im Wurf.</p>
      </Card>

      <SectionTitle>Trainingshistorie</SectionTitle>
      <Card className="flex items-center gap-3 p-4" onClick={() => navigate('/profile/history')} as="button">
        <History size={20} className="text-ink-2" />
        <div className="flex-1">
          <div className="font-semibold">Alle Einheiten</div>
          <div className="text-sm text-ink-3">{sessions.length} gespeichert</div>
        </div>
        <ChevronRight className="text-ink-3" />
      </Card>

      <DataManagement />
    </div>
  );
}

function PlanSettings() {
  const profile = useApp((s) => s.profile)!;
  const updateProfile = useApp((s) => s.updateProfile);
  const [open, setOpen] = useState(false);
  const recommended = programFor(profile);
  return (
    <>
      <SectionTitle>Trainingsplan</SectionTitle>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Programm {PROGRAMS[profile.plan.program].title}</div>
            <div className="text-sm text-ink-2">{PROGRAMS[profile.plan.program].stages[profile.plan.stage]?.title}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Ändern
          </Button>
        </div>
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="Programm wählen">
        <p className="mb-3 text-sm text-ink-2">Ein Wechsel startet das Programm bei Stufe 1. Deine Trainingsdaten bleiben erhalten.</p>
        <div className="grid gap-2">
          {(['foundation', 'build', 'adaptive'] as const).map((id) => (
            <button
              key={id}
              onClick={async () => {
                await updateProfile((p) => ({
                  ...p,
                  plan: { program: id, stage: 0, stageStartedAt: Date.now(), history: [...p.plan.history, { program: p.plan.program, stage: p.plan.stage, endedAt: Date.now(), reason: 'Programm manuell gewechselt' }] },
                }));
                setOpen(false);
              }}
              className={cx('rounded-2xl border p-4 text-left', profile.plan.program === id ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface-2')}
            >
              <div className="flex items-center gap-2 font-semibold">
                {PROGRAMS[id].title}
                {recommended === id && <Chip tone="accent">empfohlen</Chip>}
              </div>
              <div className="mt-1 text-sm text-ink-2">{PROGRAMS[id].description}</div>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function DataManagement() {
  const reload = useApp((s) => s.reloadSessions);
  const resetAll = useApp((s) => s.resetAll);
  const showToast = useApp((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof parseImport> | null>(null);

  const doExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darts-coach-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Sicherung erstellt', 'good');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseImport(await f.text()));
    } catch (e) {
      showToast(e instanceof ImportError ? e.message : 'Datei konnte nicht gelesen werden', 'bad');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const { added } = await importData(pending, mode);
    await reload();
    setPending(null);
    showToast(`${added} Einheit(en) importiert`, 'good');
  };

  return (
    <>
      <SectionTitle>Daten</SectionTitle>
      <Card className="flex flex-col gap-2 p-5">
        <p className="text-sm text-ink-2">Alle Daten liegen nur auf diesem Gerät. Erstelle regelmäßig eine Sicherung – z. B. bevor du den Browser-Speicher leerst oder das Gerät wechselst. Videos sind nicht enthalten.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={doExport}>
            <Download size={18} /> Daten exportieren
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Daten importieren
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Sicherung auswählen" />
        <Button variant="danger" className="mt-2" onClick={() => setConfirmReset(true)}>
          <Trash2 size={18} /> Alle Daten löschen
        </Button>
      </Card>
      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Sicherung importieren">
        <p className="mb-4 text-sm text-ink-2">
          Die Datei enthält {pending?.sessions.length ?? 0} Einheiten{pending?.profile ? ' und ein Profil' : ''} (exportiert am {pending ? formatDate(Date.parse(pending.exportedAt)) : ''}).
        </p>
        <div className="grid gap-2">
          <Button block onClick={() => doImport('merge')}>
            Zusammenführen (fehlende ergänzen)
          </Button>
          <Button block variant="danger" onClick={() => doImport('replace')}>
            Alles ersetzen
          </Button>
        </div>
      </Sheet>
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Wirklich alles löschen?">
        <p className="mb-4 text-sm text-ink-2">Profil, alle Trainingseinheiten und Videos werden unwiderruflich gelöscht. Exportiere vorher eine Sicherung, wenn du die Daten behalten möchtest.</p>
        <Button
          block
          variant="danger"
          onClick={async () => {
            await resetAll();
            setConfirmReset(false);
            navigate('/', { replace: true });
          }}
        >
          Endgültig löschen
        </Button>
      </Sheet>
    </>
  );
}

export function HistoryScreen() {
  const sessions = useApp((s) => s.sessions);
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  return (
    <div className="pb-6">
      <PageHeader title="Trainingshistorie" subtitle={`${sessions.length} Einheiten`} backTo="/profile" />
      {sorted.length === 0 ? (
        <EmptyState icon={<History />} title="Noch keine Einheiten" text="Absolvierte Trainings erscheinen hier." />
      ) : (
        <Card className="divide-y divide-line">
          {sorted.map((s) => (
            <button key={s.id} onClick={() => navigate(`/summary/${s.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.title}</div>
                <div className="truncate text-xs text-ink-3">
                  {formatDate(s.startedAt, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · {formatDuration(s.activeMs)} · {sessionDarts(s)} Darts
                </div>
                <div className="truncate text-xs text-ink-3">{s.drills.map((d) => findDrill(d.drillId)?.name ?? d.drillId).join(', ')}</div>
              </div>
              {!s.completed && <Chip>unvollständig</Chip>}
              <ChevronRight size={18} className="text-ink-3" />
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
