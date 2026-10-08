import { ArrowLeft, ArrowRight, Check, Target } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp } from '../../data/store';
import { DEFAULT_ROUTINE, type Goal, type PlayerLevel, type Profile, type ProgramId, type SessionMinutes } from '../../domain/models';
import { PROGRAMS } from '../../domain/plan';
import type { InputMode } from '../../domain/types';
import { navigate } from '../router';
import { startAssessment } from '../startSession';
import { Button, cx, inputClass } from '../components/ui';

interface Draft {
  name: string;
  level: PlayerLevel;
  dartType: 'steel' | 'soft';
  hand: 'right' | 'left';
  sessionsPerWeek: number;
  sessionMinutes: SessionMinutes;
  goals: Goal[];
  stableThrow: 'yes' | 'unsure' | 'no';
  inputMode: InputMode;
}

const GOALS: { id: Goal; label: string; text: string }[] = [
  { id: 'accuracy', label: 'Treffsicherheit', text: 'Zahlen gezielt treffen' },
  { id: 'consistency', label: 'Konstanter Wurf', text: 'Jeder Dart gleich' },
  { id: 'scoring', label: 'Mehr Punkte', text: '20er und Triples' },
  { id: 'doubles', label: 'Doppel', text: 'Doppel sicher treffen' },
  { id: 'checkout', label: 'Checkouts', text: 'Finish-Wege lernen' },
  { id: 'games', label: '301 / 501', text: 'Im Spiel besser werden' },
];

export function programFor(d: Pick<Draft, 'level' | 'stableThrow'>): ProgramId {
  if (d.level === 'advanced') return 'build';
  if (d.level === 'intermediate' && d.stableThrow === 'yes') return 'build';
  return 'foundation';
}

export function Onboarding() {
  const setProfile = useApp((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({
    name: '',
    level: 'beginner',
    dartType: 'steel',
    hand: 'right',
    sessionsPerWeek: 3,
    sessionMinutes: 30,
    goals: ['accuracy', 'consistency'],
    stableThrow: 'no',
    inputMode: 'board',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const steps = 6;
  const program = programFor(d);

  const finish = async (startTest: boolean) => {
    const now = Date.now();
    const profile: Profile = {
      version: 1,
      name: d.name.trim() || 'Spieler',
      createdAt: now,
      level: d.level,
      dartType: d.dartType,
      hand: d.hand,
      sessionsPerWeek: d.sessionsPerWeek,
      sessionMinutes: d.sessionMinutes,
      goals: d.goals.length ? d.goals : ['accuracy'],
      stableThrow: d.stableThrow,
      inputMode: d.inputMode,
      sound: true,
      voice: false,
      setup: {},
      routine: DEFAULT_ROUTINE,
      techniqueStatus: {},
      techniqueNotes: {},
      plan: { program, stage: 0, stageStartedAt: now, history: [] },
    };
    await setProfile(profile);
    if (startTest) startAssessment();
    else navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-6 pt-6">
      <div className="mb-6 flex items-center gap-3">
        {step > 0 ? (
          <button aria-label="Zurück" onClick={() => setStep((s) => s - 1)} className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-[#05170d]">
            <Target size={22} />
          </div>
        )}
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-surface-3')} />
          ))}
        </div>
      </div>

      <div key={step} className="flex flex-1 animate-fade-up flex-col">
        {step === 0 && (
          <Step title="Willkommen bei DARTS COACH" text="Train smarter. Throw better. Ein paar kurze Fragen, dann bekommst du einen Trainingsplan, der zu dir passt.">
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-2">Wie dürfen wir dich nennen?</span>
              <input className={inputClass} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Dein Name (optional)" autoComplete="given-name" />
            </label>
            <Question label="Wie schätzt du dich ein?">
              <Choice selected={d.level === 'beginner'} onClick={() => set('level', 'beginner')} title="Anfänger" text="Ich fange (wieder) an und will die Grundlagen lernen." />
              <Choice selected={d.level === 'intermediate'} onClick={() => set('level', 'intermediate')} title="Fortgeschritten" text="Ich spiele regelmäßig, will aber gezielter trainieren." />
              <Choice selected={d.level === 'advanced'} onClick={() => set('level', 'advanced')} title="Erfahren" text="Ich spiele im Verein oder in einer Liga." />
            </Question>
          </Step>
        )}
        {step === 1 && (
          <Step title="Dein Setup" text="Damit Abstände und Hinweise stimmen.">
            <Question label="Womit spielst du?">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={d.dartType === 'steel'} onClick={() => set('dartType', 'steel')} title="Steeldart" text="Abwurf 2,37 m" />
                <Choice selected={d.dartType === 'soft'} onClick={() => set('dartType', 'soft')} title="Softdart" text="Abwurf 2,44 m" />
              </div>
            </Question>
            <Question label="Wurfhand">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={d.hand === 'right'} onClick={() => set('hand', 'right')} title="Rechts" />
                <Choice selected={d.hand === 'left'} onClick={() => set('hand', 'left')} title="Links" />
              </div>
            </Question>
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">Scheibenmitte (Bull) in 1,73 m Höhe. Gemessen wird von der Vorderkante der Abwurflinie bis zur Scheibenoberfläche.</p>
          </Step>
        )}
        {step === 2 && (
          <Step title="Deine Zeit" text="Kurze, regelmäßige Einheiten bringen mehr als seltene lange. Der Plan passt sich daran an.">
            <Question label="Wie oft pro Woche möchtest du trainieren?">
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => set('sessionsPerWeek', n)} className={cx('num h-14 rounded-2xl text-2xl', d.sessionsPerWeek === n ? 'bg-accent text-[#05170d]' : 'bg-surface-2')}>
                    {n}×
                  </button>
                ))}
              </div>
            </Question>
            <Question label="Wie viel Zeit hast du pro Training?">
              <div className="grid grid-cols-4 gap-2">
                {([10, 20, 30, 45] as SessionMinutes[]).map((n) => (
                  <button key={n} onClick={() => set('sessionMinutes', n)} className={cx('h-14 rounded-2xl font-bold', d.sessionMinutes === n ? 'bg-accent text-[#05170d]' : 'bg-surface-2')}>
                    {n} Min.
                  </button>
                ))}
              </div>
            </Question>
          </Step>
        )}
        {step === 3 && (
          <Step title="Deine Ziele" text="Was möchtest du besonders verbessern? Mehrfachauswahl möglich.">
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => {
                const on = d.goals.includes(g.id);
                return <Choice key={g.id} selected={on} onClick={() => set('goals', on ? d.goals.filter((x) => x !== g.id) : [...d.goals, g.id])} title={g.label} text={g.text} />;
              })}
            </div>
          </Step>
        )}
        {step === 4 && (
          <Step title="Dein Wurf" text="Ehrlich sein hilft – es gibt keine falsche Antwort.">
            <Question label="Hast du schon einen stabilen, gleichbleibenden Wurfablauf?">
              <Choice selected={d.stableThrow === 'no'} onClick={() => set('stableThrow', 'no')} title="Nein, noch nicht" text="Jeder Wurf fühlt sich etwas anders an." />
              <Choice selected={d.stableThrow === 'unsure'} onClick={() => set('stableThrow', 'unsure')} title="Weiß nicht genau" text="Manchmal ja, manchmal nein." />
              <Choice selected={d.stableThrow === 'yes'} onClick={() => set('stableThrow', 'yes')} title="Ja" text="Stand, Griff und Ablauf sind meistens gleich." />
            </Question>
            <Question label="Wie möchtest du deine Würfe erfassen?">
              <Choice selected={d.inputMode === 'board'} onClick={() => set('inputMode', 'board')} title="Auf der Scheibe antippen" text="Etwas genauer: Die App kennt die Position und kann Streuung und Heatmap berechnen." />
              <Choice selected={d.inputMode === 'buttons'} onClick={() => set('inputMode', 'buttons')} title="Über große Tasten" text="Am schnellsten: S20, T20, D20, Miss … Positionen werden nicht gespeichert." />
            </Question>
          </Step>
        )}
        {step === 5 && (
          <Step title="Dein Plan steht" text={`Programm „${PROGRAMS[program].title}“ – ${PROGRAMS[program].description}`}>
            <ol className="space-y-2" data-testid="plan-preview">
              {PROGRAMS[program].stages.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-2xl border border-line bg-surface-1 p-4">
                  <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-lg">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{s.title}</span>
                    <span className="block text-sm text-ink-2">{s.subtitle}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
              Der Plan richtet sich nach deinen Ergebnissen, nicht nur nach dem Kalender. Du startest mit einem kurzen Eingangstest (ca. 20 Min.), damit wir später echten Fortschritt zeigen können.
            </p>
          </Step>
        )}
      </div>

      <div className="mt-6 grid gap-2">
        {step < steps - 1 ? (
          <Button size="lg" block onClick={() => setStep((s) => s + 1)} data-testid="onboarding-next">
            Weiter <ArrowRight size={18} />
          </Button>
        ) : (
          <>
            <Button size="lg" block onClick={() => finish(true)} data-testid="onboarding-start-test">
              Eingangstest starten
            </Button>
            <Button size="lg" variant="ghost" block onClick={() => finish(false)} data-testid="onboarding-finish">
              Erst mal umsehen
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-ink-2">{text}</p>
      </div>
      {children}
    </div>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-2">{label}</legend>
      {children}
    </fieldset>
  );
}

function Choice({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
        selected ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface-1 hover:border-line-strong',
      )}
    >
      <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', selected ? 'border-accent bg-accent text-[#05170d]' : 'border-line-strong')}>
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        {text && <span className="mt-0.5 block text-sm text-ink-2">{text}</span>}
      </span>
    </button>
  );
}
