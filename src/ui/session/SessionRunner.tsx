import { ArrowRight, Clock, Pause, Play, SkipForward, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../data/store';
import { findDrill } from '../../domain/drills/catalog';
import { runDrill } from '../../domain/drills/registry';
import { activeMs } from '../../domain/session';
import { drillHistory } from '../../domain/stats';
import { configKey } from '../../domain/drills/registry';
import { formatClock, useNow, useWakeLock } from '../hooks/media';
import { navigate } from '../router';
import { Button, Card, Chip, cx, Sheet } from '../components/ui';
import { DrillPlay } from './DrillPlay';

/** Geführte Trainingseinheit: Phase für Phase mit Coach-Texten. */
export function SessionRunner() {
  const active = useApp((s) => s.active);
  const setActive = useApp((s) => s.setActive);
  const pause = useApp((s) => s.pause);
  const resume = useApp((s) => s.resume);
  const finishActive = useApp((s) => s.finishActive);
  const discardActive = useApp((s) => s.discardActive);
  const sessions = useApp((s) => s.sessions);
  const [confirmExit, setConfirmExit] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const now = useNow(1000, Boolean(active && !active.pausedAt));
  useWakeLock(Boolean(active && !active.pausedAt));

  useEffect(() => {
    if (!active && !finishing) navigate('/train', { replace: true });
  }, [active, finishing]);

  const phase = active?.phases[active.phaseIdx];
  const prog = active?.progress[active.phaseIdx];
  const run = useMemo(() => (phase && prog ? runDrill(phase.config, prog.events) : null), [phase, prog]);
  if (!active || !phase || !prog || !run) return null;

  const stage: 'intro' | 'play' | 'done' = prog.skipped || prog.endedAt || run.finished ? 'done' : prog.startedAt ? 'play' : 'intro';
  const isLast = active.phaseIdx === active.phases.length - 1;

  const startPhase = () => setActive((s) => ({ ...s, progress: s.progress.map((p, i) => (i === s.phaseIdx ? { ...p, startedAt: Date.now() } : p)) }));
  const endPhase = () => setActive((s) => ({ ...s, progress: s.progress.map((p, i) => (i === s.phaseIdx ? { ...p, endedAt: Date.now() } : p)) }));
  const skipPhase = () => setActive((s) => ({ ...s, progress: s.progress.map((p, i) => (i === s.phaseIdx ? { ...p, skipped: p.events.length === 0, endedAt: Date.now() } : p)) }));

  const finish = async () => {
    setFinishing(true);
    const summary = await finishActive();
    if (summary && summary.record.drills.length > 0) navigate(`/summary/${summary.record.id}`, { replace: true });
    else navigate('/train', { replace: true });
  };

  const next = () => {
    if (isLast) finish();
    else setActive((s) => ({ ...s, phaseIdx: s.phaseIdx + 1 }));
  };

  const elapsed = activeMs(active, now);
  const phaseElapsed = prog.startedAt ? (prog.endedAt ?? now) - prog.startedAt : 0;
  const def = findDrill(phase.drillId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-8 pt-3">
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur">
        <button aria-label="Training beenden" onClick={() => setConfirmExit(true)} className="grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{active.title}</div>
          <div className="flex items-center gap-1.5">
            {active.phases.map((p, i) => (
              <span
                key={p.id + i}
                className={cx('h-1.5 flex-1 rounded-full', i < active.phaseIdx ? 'bg-accent' : i === active.phaseIdx ? 'bg-flare' : 'bg-surface-3')}
                title={p.title}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm tabular text-ink-2">
          <Clock size={14} />
          {formatClock(elapsed)}
        </div>
        <button aria-label="Pause" onClick={pause} className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-ink-1">
          <Pause size={18} />
        </button>
      </header>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="label">
            Phase {active.phaseIdx + 1} von {active.phases.length}
          </div>
          <h1 className="text-xl font-bold">{phase.title}</h1>
        </div>
        <Chip tone={phaseElapsed > phase.minutes * 60000 ? 'flare' : 'neutral'}>
          {formatClock(phaseElapsed)} / {phase.minutes}:00
        </Chip>
      </div>

      {stage === 'intro' && (
        <div className="flex animate-fade-up flex-col gap-4">
          <Card className="p-5">
            <div className="label mb-2">Dein Coach</div>
            <p className="leading-relaxed text-ink-1">{phase.coach}</p>
            {active.challenge && active.phaseIdx === 0 && <p className="mt-3 rounded-xl bg-flare-soft px-3 py-2 text-sm font-semibold text-flare">Challenge: {active.challenge.text}</p>}
          </Card>
          {def && (
            <Card className="p-5">
              <div className="label mb-2">So geht’s · {def.name}</div>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {def.rules.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Button size="lg" block onClick={startPhase} data-testid="start-phase">
            <Play size={18} /> Los geht’s
          </Button>
          {(phase.optionalInput || active.phases.length > 1) && (
            <Button variant="ghost" block onClick={skipPhase}>
              <SkipForward size={18} /> Phase überspringen
            </Button>
          )}
        </div>
      )}

      {stage === 'play' && (
        <div className="flex flex-col gap-4">
          {phase.optionalInput && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info">
              <span>Eingabe optional – einfach locker werfen.</span>
              <button onClick={endPhase} className="font-bold underline">
                Fertig
              </button>
            </div>
          )}
          <DrillPlay phase={phase} onEndEarly={endPhase} />
        </div>
      )}

      {stage === 'done' && <PhaseDone phaseIdx={active.phaseIdx} isLast={isLast} onNext={next} sessions={sessions} finishing={finishing} />}

      {active.pausedAt && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-bg/95 px-6 text-center backdrop-blur">
          <div className="num text-6xl">Pause</div>
          <p className="max-w-sm text-ink-2">Dein Training ist gesichert. Trink etwas, lockere die Schulter – und mach dann mit demselben Ablauf weiter.</p>
          <Button size="lg" onClick={resume}>
            <Play size={18} /> Weiter
          </Button>
        </div>
      )}

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Training beenden?">
        <p className="mb-4 text-sm text-ink-2">Bisher erfasste Übungen werden gespeichert. Nicht beendete Übungen zählen nicht für Rekorde.</p>
        <div className="grid gap-2">
          <Button
            block
            onClick={() => {
              setConfirmExit(false);
              finish();
            }}
          >
            Speichern und beenden
          </Button>
          <Button
            block
            variant="danger"
            onClick={() => {
              setConfirmExit(false);
              discardActive();
            }}
          >
            Verwerfen
          </Button>
          <Button block variant="ghost" onClick={() => setConfirmExit(false)}>
            Weiter trainieren
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function PhaseDone({ phaseIdx, isLast, onNext, sessions, finishing }: { phaseIdx: number; isLast: boolean; onNext: () => void; sessions: ReturnType<typeof useApp.getState>['sessions']; finishing: boolean }) {
  const active = useApp((s) => s.active)!;
  const phase = active.phases[phaseIdx];
  const prog = active.progress[phaseIdx];
  const run = runDrill(phase.config, prog.events);
  const r = run.result;
  const prev = drillHistory(sessions, phase.drillId, configKey(phase.config));
  const last = prev[prev.length - 1];
  return (
    <div className="flex animate-fade-up flex-col gap-4" data-testid="phase-done">
      <Card className="p-5">
        {prog.events.length === 0 ? (
          <p className="text-ink-2">{phase.optionalInput ? 'Warm-up erledigt.' : 'Phase übersprungen.'}</p>
        ) : (
          <>
            <div className="label">{r.primary.label}</div>
            <div className="num mt-1 text-5xl text-accent" data-testid="phase-result">
              {r.primary.display}
            </div>
            {!r.completed && <div className="mt-1 text-sm text-flare">Vorzeitig beendet – zählt nicht für Rekorde.</div>}
            {last && r.completed && r.primary.value !== null && (
              <div className="mt-2 text-sm text-ink-2">
                Letztes Mal: <span className="font-semibold text-ink-1">{last.display}</span>
              </div>
            )}
            <ul className="mt-4 space-y-1 text-sm text-ink-2">
              {r.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Button size="lg" block onClick={onNext} disabled={finishing} data-testid="next-phase">
        {isLast ? 'Training abschließen' : 'Nächste Phase'} <ArrowRight size={18} />
      </Button>
    </div>
  );
}
