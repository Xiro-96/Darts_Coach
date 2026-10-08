import { ChevronDown, ChevronUp, Flag, Lightbulb, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../data/store';
import { findDrill } from '../../domain/drills/catalog';
import { nextBotDart, runDrill } from '../../domain/drills/registry';
import type { DrillView, X01Panel } from '../../domain/drills/types';
import type { X01DrillState } from '../../domain/drills/x01Drill';
import { isFinishable } from '../../domain/checkout';
import type { SessionPhase } from '../../domain/models';
import type { Dart } from '../../domain/types';
import { beep, speak } from '../hooks/media';
import { ThrowInput } from '../input/ThrowInput';
import { Metronome, RoutinePlayer } from '../technique/RhythmTools';
import { Button, cx, ProgressBar, Sheet } from '../components/ui';

/** Spielansicht einer Übung innerhalb einer Session. */
export function DrillPlay({ phase, onEndEarly }: { phase: SessionPhase; onEndEarly: () => void }) {
  const active = useApp((s) => s.active)!;
  const profile = useApp((s) => s.profile)!;
  const addEvent = useApp((s) => s.addEvent);
  const undo = useApp((s) => s.undo);
  const showToast = useApp((s) => s.showToast);
  const events = active.progress[active.phaseIdx].events;
  const run = useMemo(() => runDrill(phase.config, events), [phase.config, events]);
  const view = run.view;
  const def = findDrill(phase.drillId);
  const [companionOpen, setCompanionOpen] = useState(true);
  const [pendingVisit, setPendingVisit] = useState<{ score: number; checkout: boolean; askDouble: boolean } | null>(null);
  const lastFeedback = useRef<string | undefined>(undefined);

  // Virtueller Gegner wirft automatisch
  const botDart = useMemo(() => nextBotDart(phase.config, events), [phase.config, events]);
  useEffect(() => {
    if (!botDart || active.pausedAt) return;
    const t = setTimeout(() => addEvent({ t: 'dart', dart: botDart, bot: true }), 650);
    return () => clearTimeout(t);
  }, [botDart, addEvent, active.pausedAt]);

  // Akustisches Feedback / Sprachausgabe
  useEffect(() => {
    const fb = view.feedback;
    if (!fb || fb.text === lastFeedback.current) return;
    lastFeedback.current = fb.text;
    if (profile.sound) beep(fb.tone === 'good' ? 1040 : fb.tone === 'bad' ? 300 : 700, 70);
    if (profile.voice && (phase.config.engine === 'x01' || fb.tone === 'bad' || fb.tone === 'good')) speak(fb.text.replace(/[–!]/g, ''));
  }, [view.feedback, profile.sound, profile.voice, phase.config.engine]);

  const submitDart = (d: Dart) => {
    const err = addEvent({ t: 'dart', dart: d });
    if (err) showToast(err, 'bad');
  };

  const x01 = phase.config.engine === 'x01' ? (run.state as X01DrillState) : null;
  const submitVisit = (score: number) => {
    if (x01) {
      const g = x01.game;
      const p = g.players[g.current];
      const checkout = score === p.remaining && score > 0;
      const askDouble = g.config.out === 'double' && p.remaining <= 50;
      if (checkout && !isFinishable(p.remaining, 3, g.config.out)) {
        showToast(`${p.remaining} ist mit drei Darts nicht checkbar`, 'bad');
        return;
      }
      if (checkout || askDouble) {
        setPendingVisit({ score, checkout, askDouble });
        return;
      }
    }
    const err = addEvent({ t: 'visit', score });
    if (err) showToast(err, 'bad');
  };

  const finishVisit = (darts: number | undefined, doubleDarts: number | undefined) => {
    if (!pendingVisit) return;
    const err = addEvent({ t: 'visit', score: pendingVisit.score, darts, doubleDarts });
    if (err) showToast(err, 'bad');
    setPendingVisit(null);
  };

  const markers = useMemo(() => {
    const thr = run.throws;
    if (!thr.length) return [];
    const lastRound = thr[thr.length - 1].round;
    return thr
      .filter((t) => t.round === lastRound && t.dart.p)
      .map((t, i) => ({ p: t.dart.p!, label: String(i + 1) }));
  }, [run.throws]);

  const humanTurn = !(view.panel?.type === 'x01' && view.panel.currentIsBot);

  return (
    <div className="flex flex-col gap-4">
      <TargetHeader view={view} />

      {view.panel?.type === 'x01' && <X01Board panel={view.panel} />}
      {view.panel?.type === 'cricket' && (
        <div className="grid grid-cols-7 gap-1.5">
          {view.panel.marks.map((m) => (
            <div key={m.n} className={cx('rounded-xl border p-2 text-center', m.marks >= 3 ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-2')}>
              <div className="num text-lg">{m.n === 25 ? 'B' : m.n}</div>
              <div className="mt-1 text-xs font-bold tracking-widest text-ink-2">{m.marks >= 3 ? 'Ⓧ' : m.marks === 2 ? 'X' : m.marks === 1 ? '/' : '·'}</div>
            </div>
          ))}
        </div>
      )}

      {def?.companion && (
        <div className="card p-4">
          <button className="flex w-full items-center justify-between text-sm font-semibold text-ink-2" onClick={() => setCompanionOpen((v) => !v)}>
            {def.companion === 'metronome' ? 'Rhythmus-Metronom' : 'Routine-Player'}
            {companionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {companionOpen && <div className="mt-3">{def.companion === 'metronome' ? <Metronome /> : <RoutinePlayer steps={profile.routine} compact />}</div>}
        </div>
      )}

      {view.awaiting === 'rating' && view.rating ? (
        <div className="card animate-fade-up p-4" data-testid="rating">
          <div className="mb-3 font-semibold">{view.rating.question}</div>
          <div className="grid gap-2">
            {view.rating.options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  const err = addEvent({ t: 'rate', value: o.value });
                  if (err) showToast(err, 'bad');
                }}
                className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 text-left active:scale-[0.99]"
              >
                <span className="font-semibold">{o.label}</span>
                {o.hint && <span className="text-sm text-ink-3">{o.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        view.awaiting === 'dart' && (
          <ThrowInput
            key={phase.id}
            view={view}
            defaultMode={profile.inputMode}
            onDart={submitDart}
            onVisitTotal={view.allowVisitTotal ? submitVisit : undefined}
            markers={markers}
            disabled={!humanTurn}
          />
        )
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={undo} disabled={events.length === 0} aria-label="Letzte Eingabe rückgängig">
          <Undo2 size={18} /> Rückgängig
        </Button>
        <Button variant="ghost" onClick={onEndEarly}>
          <Flag size={18} /> Phase beenden
        </Button>
      </div>

      <Sheet open={pendingVisit !== null} onClose={() => setPendingVisit(null)} title={pendingVisit?.checkout ? `Checkout ${pendingVisit.score}!` : 'Darts aufs Doppel'}>
        {pendingVisit && <VisitDetails pending={pendingVisit} onDone={finishVisit} />}
      </Sheet>
    </div>
  );
}

function VisitDetails({ pending, onDone }: { pending: { score: number; checkout: boolean; askDouble: boolean }; onDone: (darts?: number, doubleDarts?: number) => void }) {
  const [darts, setDarts] = useState<number | undefined>(pending.checkout ? undefined : 3);
  const [dbl, setDbl] = useState<number | undefined>(pending.askDouble ? undefined : 0);
  const ready = darts !== undefined && dbl !== undefined;
  return (
    <div className="flex flex-col gap-4">
      {pending.checkout && (
        <div>
          <div className="mb-2 text-sm text-ink-2">Mit welchem Dart hast du gecheckt?</div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setDarts(n)} className={cx('h-12 rounded-xl font-bold', darts === n ? 'bg-accent text-[#05170d]' : 'bg-surface-3')}>
                {n}. Dart
              </button>
            ))}
          </div>
        </div>
      )}
      {pending.askDouble && (
        <div>
          <div className="mb-2 text-sm text-ink-2">Wie viele Darts gingen in dieser Aufnahme auf ein Doppel? (für deine Doppelquote)</div>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} onClick={() => setDbl(n)} disabled={pending.checkout && n === 0} className={cx('h-12 rounded-xl font-bold disabled:opacity-30', dbl === n ? 'bg-accent text-[#05170d]' : 'bg-surface-3')}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button block disabled={!ready} onClick={() => onDone(darts, dbl)}>
        Übernehmen
      </Button>
    </div>
  );
}

export function TargetHeader({ view }: { view: DrillView }) {
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <div className="card overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">{view.headlineLabel ?? 'Ziel'}</div>
          <div className="num mt-1 animate-pop text-6xl text-ink-1" key={view.headline} data-testid="target-headline">
            {view.headline}
          </div>
          {view.caption && <div className="mt-1.5 text-sm text-ink-2">{view.caption}</div>}
        </div>
        <div className="flex shrink-0 gap-1.5" aria-label="Darts dieser Aufnahme">
          {[0, 1, 2].map((i) => {
            const d = view.visitDarts[i];
            return (
              <div
                key={i}
                className={cx(
                  'num grid h-12 w-12 place-items-center rounded-xl border text-base',
                  !d && 'border-dashed border-line text-ink-3',
                  d && d.hit === true && 'border-accent/50 bg-accent-soft text-accent',
                  d && d.hit === false && 'border-line bg-surface-2 text-ink-2',
                  d && d.hit === null && 'border-line bg-surface-3 text-ink-1',
                )}
              >
                {d?.label ?? i + 1}
              </div>
            );
          })}
        </div>
      </div>
      <ProgressBar value={view.progress} className="mt-4" />
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {view.stats.map((s) => (
          <div key={s.label} className="text-sm">
            <span className="text-ink-3">{s.label} </span>
            <span className="font-semibold tabular" data-testid={`stat-${s.label}`}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
      {view.feedback && (
        <div
          key={view.feedback.text}
          role="status"
          className={cx(
            'mt-3 animate-fade-up rounded-xl px-3 py-2 text-sm font-semibold',
            view.feedback.tone === 'good' && 'bg-accent-soft text-accent',
            view.feedback.tone === 'bad' && 'bg-bad-soft text-bad',
            view.feedback.tone === 'neutral' && 'bg-surface-2 text-ink-2',
            view.feedback.tone === 'info' && 'bg-info-soft text-info',
          )}
        >
          {view.feedback.text}
        </div>
      )}
      {view.hint && (
        <button onClick={() => setHintOpen((v) => !v)} className="mt-3 flex w-full items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left text-sm text-ink-2">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-flare" />
          <span className={cx(!hintOpen && 'line-clamp-2')}>{view.hint}</span>
        </button>
      )}
    </div>
  );
}

function X01Board({ panel }: { panel: X01Panel }) {
  return (
    <div className={cx('grid gap-2', panel.players.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
      {panel.players.map((p) => (
        <div key={p.name} className={cx('rounded-2xl border p-3', p.active ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface-1')}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{p.name}</span>
            {panel.legsToWin > 1 && <span className="text-ink-3">Legs {p.legsWon}</span>}
          </div>
          <div className="num mt-1 text-4xl">{p.remaining}</div>
          <div className="text-xs text-ink-3">Ø {p.average === null ? '–' : p.average.toFixed(1).replace('.', ',')}</div>
        </div>
      ))}
    </div>
  );
}
