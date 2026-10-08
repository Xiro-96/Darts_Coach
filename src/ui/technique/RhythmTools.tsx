import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RoutineStep } from '../../domain/models';
import { beep, speak } from '../hooks/media';
import { cx } from '../components/ui';

/**
 * Routine-Player: führt Schritt für Schritt durch die persönliche Pre-Throw-Routine.
 * Nach drei Darts folgt eine längere Pause zum Darts-Ziehen.
 */
export function RoutinePlayer({ steps, voiceDefault = false, compact = false }: { steps: RoutineStep[]; voiceDefault?: boolean; compact?: boolean }) {
  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState(voiceDefault);
  const [sound, setSound] = useState(true);
  const [state, setState] = useState<{ step: number; dart: number; phase: 'step' | 'gap' | 'pull' }>({ step: 0, dart: 0, phase: 'step' });
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const startT = useRef(0);

  const valid = steps.filter((s) => s.seconds > 0);

  useEffect(() => {
    if (!running || valid.length === 0) return;
    const { step, dart, phase } = state;
    let dur: number;
    if (phase === 'step') {
      const s = valid[step];
      dur = s.seconds * 1000;
      if (sound) beep(step === valid.length - 1 ? 1100 : 760, 60);
      if (voice) speak(s.label);
    } else if (phase === 'gap') dur = 1500;
    else {
      dur = 7000;
      if (voice) speak('Darts ziehen');
    }
    startT.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - startT.current) / dur);
      setProgress(p);
      if (p < 1) timer.current = requestAnimationFrame(tick);
      else {
        if (phase === 'step') {
          if (step + 1 < valid.length) setState({ step: step + 1, dart, phase: 'step' });
          else setState({ step: 0, dart, phase: dart + 1 >= 3 ? 'pull' : 'gap' });
        } else if (phase === 'gap') setState({ step: 0, dart: dart + 1, phase: 'step' });
        else setState({ step: 0, dart: 0, phase: 'step' });
      }
    };
    timer.current = requestAnimationFrame(tick);
    return () => {
      if (timer.current) cancelAnimationFrame(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, state]);

  const toggle = () => {
    if (running) {
      setRunning(false);
      setProgress(0);
    } else {
      setState({ step: 0, dart: 0, phase: 'step' });
      setRunning(true);
    }
  };

  const current = state.phase === 'step' ? valid[state.step] : null;
  return (
    <div className="flex flex-col gap-3" data-testid="routine-player">
      <div className="flex items-center gap-4">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-surface-3)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={state.phase === 'step' ? 'var(--color-accent)' : 'var(--color-info)'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - (running ? progress : 0))}
            />
          </svg>
          <div className="text-center">
            <div className="num text-2xl">{running ? (state.phase === 'pull' ? '↺' : state.dart + 1) : '–'}</div>
            <div className="text-[10px] text-ink-3">{state.phase === 'pull' ? 'ziehen' : 'Dart'}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">{running ? (current ? current.label : state.phase === 'pull' ? 'Darts ziehen' : 'Kurz lösen') : 'Bereit'}</div>
          <div className="text-sm text-ink-2">{running ? (current ? current.cue : state.phase === 'pull' ? 'Neu ansetzen, Routine beginnt von vorn.' : 'Nächster Dart – gleicher Ablauf.') : 'Starte den Player und wirf im Takt deiner Routine.'}</div>
        </div>
      </div>
      {!compact && (
        <ol className="flex flex-wrap gap-1.5">
          {valid.map((s, i) => (
            <li
              key={s.id}
              className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', running && state.phase === 'step' && state.step === i ? 'bg-accent text-[#05170d]' : 'bg-surface-3 text-ink-2')}
            >
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <button onClick={toggle} className={cx('flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-semibold', running ? 'bg-surface-3' : 'bg-accent text-[#05170d]')}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Stopp' : 'Routine starten'}
        </button>
        <button onClick={() => setSound((v) => !v)} aria-label={sound ? 'Signalton aus' : 'Signalton an'} aria-pressed={sound} className="grid h-11 w-11 place-items-center rounded-xl bg-surface-3">
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button onClick={() => setVoice((v) => !v)} aria-pressed={voice} className={cx('h-11 rounded-xl px-3 text-sm font-semibold', voice ? 'bg-info-soft text-info' : 'bg-surface-3 text-ink-3')}>
          Sprache
        </button>
      </div>
    </div>
  );
}

/**
 * Rhythmus-Metronom: drei Schläge pro Dart (Zielen – Ausholen – Wurf), der dritte betont.
 */
export function Metronome() {
  const [bpm, setBpm] = useState(60);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!running) return;
    let b = 0;
    setBeat(0);
    beep(660, 50);
    const id = setInterval(() => {
      b = (b + 1) % 3;
      setBeat(b);
      beep(b === 2 ? 1150 : 660, b === 2 ? 90 : 50, b === 2 ? 0.12 : 0.07);
    }, 60000 / bpm);
    return () => clearInterval(id);
  }, [running, bpm]);
  const labels = ['Zielen', 'Ausholen', 'Wurf'];
  return (
    <div className="flex flex-col gap-3" data-testid="metronome">
      <div className="flex items-center justify-between gap-2">
        {labels.map((l, i) => (
          <div
            key={l}
            className={cx(
              'flex h-14 flex-1 items-center justify-center rounded-xl text-sm font-bold transition-colors',
              running && beat === i ? (i === 2 ? 'bg-flare text-[#1d0d02]' : 'bg-accent text-[#05170d]') : 'bg-surface-3 text-ink-3',
            )}
          >
            {l}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setRunning((v) => !v)} className={cx('flex h-11 items-center gap-2 rounded-xl px-4 font-semibold', running ? 'bg-surface-3' : 'bg-accent text-[#05170d]')}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {running ? 'Stopp' : 'Start'}
        </button>
        <label className="flex flex-1 items-center gap-3 text-sm text-ink-2">
          <span className="w-16 shrink-0 tabular">{bpm} BPM</span>
          <input type="range" min={36} max={96} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" aria-label="Tempo" />
        </label>
      </div>
    </div>
  );
}
