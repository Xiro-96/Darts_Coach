import { dartScore, isDouble } from '../board';
import { bestCheckout, explainRoute, isFinishable, isOneDartDoubleFinish, setupAdvice } from '../checkout';
import { createRng } from '../random';
import type { Target } from '../types';
import { currentVisit, DARTS_PER_VISIT, pct, quickFor, record } from './helpers';
import type { CheckoutConfig, DrillResult, DrillView, EngineModule, ThrowRecord } from './types';

/**
 * Checkout-Training: Eine Restpunktzahl muss innerhalb eines Dart-Budgets
 * (3, 6 oder 9 Darts) nach X01-Regeln beendet werden – inklusive Bust.
 *  - random: Zufallszahlen aus einem Bereich (z. B. 2–40)
 *  - list: feste Liste
 *  - ladder: 121-Training – Erfolg → nächste Zahl +1, Misserfolg → −1 (nicht unter den Start)
 */
export interface CheckoutAttempt {
  target: number;
  success: boolean;
  darts: number;
}

export interface CheckoutState {
  config: CheckoutConfig;
  attempts: CheckoutAttempt[];
  target: number;
  remaining: number;
  visitStart: number;
  dartsInAttempt: number;
  dartsInVisit: number;
  throws: ThrowRecord[];
  last: { kind: 'bust' | 'success' | 'fail'; target: number } | null;
}

/** Erzeugt die n-te Zufallszahl deterministisch aus dem Seed. */
export function randomCheckout(c: CheckoutConfig, index: number): number {
  const min = Math.max(2, c.min ?? 2);
  const max = Math.min(170, c.max ?? 40);
  const rng = createRng((c.seed ^ (index * 2654435761)) >>> 0);
  const darts = Math.min(3, c.dartsPerAttempt);
  for (let i = 0; i < 200; i++) {
    const v = min + Math.floor(rng() * (max - min + 1));
    if (c.evenOnly && v % 2 !== 0) continue;
    if (isFinishable(v, darts, c.out)) return v;
  }
  return min % 2 === 0 ? min : min + 1;
}

function targetForAttempt(c: CheckoutConfig, index: number, prev: CheckoutState | null): number {
  if (c.mode === 'list') return (c.values ?? [40])[index % (c.values?.length || 1)];
  if (c.mode === 'ladder') {
    const start = c.start ?? 121;
    if (!prev || prev.attempts.length === 0) return start;
    const last = prev.attempts[prev.attempts.length - 1];
    return last.success ? Math.min(170, last.target + 1) : Math.max(start, last.target - 1);
  }
  return randomCheckout(c, index);
}

function isDone(s: CheckoutState): boolean {
  return s.attempts.length >= s.config.attempts;
}

function doubleTarget(rem: number): Target | null {
  if (!isOneDartDoubleFinish(rem)) return null;
  return rem === 50 ? { n: 25, kind: 'bullseye' } : { n: rem / 2, kind: 'double' };
}

function startAttempt(s: CheckoutState): CheckoutState {
  const target = targetForAttempt(s.config, s.attempts.length, s);
  return { ...s, target, remaining: target, visitStart: target, dartsInAttempt: 0, dartsInVisit: 0 };
}

export const checkoutPractice: EngineModule<CheckoutConfig, CheckoutState> = {
  init(config) {
    const base: CheckoutState = {
      config,
      attempts: [],
      target: 0,
      remaining: 0,
      visitStart: 0,
      dartsInAttempt: 0,
      dartsInVisit: 0,
      throws: [],
      last: null,
    };
    return startAttempt(base);
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const c = s.config;
    const tgt = c.out === 'double' ? doubleTarget(s.remaining) : null;
    // Runden-ID: eindeutig je Aufnahme innerhalb eines Versuchs
    const rec = record(e.dart, tgt, s.attempts.length * 10 + Math.floor(s.dartsInAttempt / DARTS_PER_VISIT), e.at);
    const throws = [...s.throws, rec];
    const value = dartScore(e.dart);
    const newRem = s.remaining - value;
    let dartsInAttempt = s.dartsInAttempt + 1;
    let dartsInVisit = s.dartsInVisit + 1;

    const bust =
      newRem < 0 || (c.out !== 'single' && newRem === 1) || (newRem === 0 && c.out === 'double' && !isDouble(e.dart));

    if (newRem === 0 && !bust) {
      const attempts = [...s.attempts, { target: s.target, success: true, darts: dartsInAttempt }];
      const next = { ...s, throws, attempts, last: { kind: 'success' as const, target: s.target } };
      return isDone(next) ? next : startAttempt(next);
    }

    let remaining = newRem;
    let visitStart = s.visitStart;
    let last: CheckoutState['last'] = null;
    if (bust) {
      remaining = s.visitStart;
      dartsInAttempt = Math.ceil(dartsInAttempt / DARTS_PER_VISIT) * DARTS_PER_VISIT; // Rest der Aufnahme verfällt
      dartsInVisit = DARTS_PER_VISIT;
      last = { kind: 'bust', target: s.target };
    }
    if (dartsInVisit >= DARTS_PER_VISIT) {
      dartsInVisit = 0;
      visitStart = remaining;
    }
    if (dartsInAttempt >= c.dartsPerAttempt) {
      const attempts = [...s.attempts, { target: s.target, success: false, darts: dartsInAttempt }];
      const next = { ...s, throws, attempts, last: { kind: 'fail' as const, target: s.target } };
      return isDone(next) ? next : startAttempt(next);
    }
    return { ...s, throws, remaining, visitStart, dartsInAttempt, dartsInVisit, last };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const c = s.config;
    const done = isDone(s);
    const dartsLeftInVisit = DARTS_PER_VISIT - s.dartsInVisit;
    const route = done ? null : bestCheckout(s.remaining, Math.min(dartsLeftInVisit, c.dartsPerAttempt - s.dartsInAttempt), c.out);
    let hint: string | undefined;
    if (!done) {
      if (route) hint = `Weg: ${route.labels.join(' → ')}`;
      else {
        const adv = setupAdvice(s.remaining);
        hint = adv ? `Kein Finish mit ${dartsLeftInVisit} Dart${dartsLeftInVisit > 1 ? 's' : ''} – stell dir mit ${adv.label} die ${adv.leave}.` : undefined;
      }
    }
    const firstRoute = done || s.dartsInAttempt > 0 ? null : bestCheckout(s.target, Math.min(3, c.dartsPerAttempt), c.out);
    const success = s.attempts.filter((a) => a.success).length;
    const tgt = c.out === 'double' && !done ? doubleTarget(s.remaining) : null;
    let feedback: DrillView['feedback'];
    if (s.last?.kind === 'success') feedback = { tone: 'good', text: `Checkout ${s.last.target}! Stark.` };
    else if (s.last?.kind === 'bust') feedback = { tone: 'bad', text: 'Bust – zurück auf den Stand vor der Aufnahme.' };
    else if (s.last?.kind === 'fail') feedback = { tone: 'neutral', text: `${s.last.target} nicht geschafft – nächster Versuch.` };
    const stats = [
      { label: 'Versuch', value: `${Math.min(s.attempts.length + 1, c.attempts)}/${c.attempts}` },
      { label: 'Erfolgreich', value: `${success} (${pct(success, s.attempts.length)})` },
      { label: 'Darts übrig', value: `${c.dartsPerAttempt - s.dartsInAttempt}` },
    ];
    if (c.mode === 'ladder') stats.push({ label: 'Höchster Checkout', value: `${maxChecked(s) || '–'}` });
    return {
      target: tgt,
      headline: done ? 'Fertig' : `${s.remaining}`,
      caption: done ? undefined : s.remaining !== s.target ? `Checkout ${s.target} · Rest ${s.remaining}` : `Checke ${s.target} mit max. ${c.dartsPerAttempt} Darts`,
      progress: s.attempts.length / c.attempts,
      stats,
      visitDarts: currentVisit(s.throws, s.throws.length ? s.throws[s.throws.length - 1].round : 0).slice(-3),
      awaiting: done ? 'done' : 'dart',
      hint: firstRoute ? `${hint} · ${explainRoute(s.target, firstRoute)}` : hint,
      feedback,
      quick: route ? [route.darts[0], ...quickFor(tgt).filter((d) => !(d.n === route.darts[0].n && d.m === route.darts[0].m))].slice(0, 6) : quickFor(tgt),
    };
  },

  result(s): DrillResult {
    const success = s.attempts.filter((a) => a.success).length;
    const dbl = s.throws.filter((t) => t.hit !== null);
    const dblHits = dbl.filter((t) => t.hit).length;
    const metrics: Record<string, number> = {
      darts: s.throws.length,
      attempts: s.attempts.length,
      successes: success,
      dartsAtDouble: dbl.length,
      doubleHits: dblHits,
      hits: dblHits,
    };
    const lines = [`Checkouts: ${success} von ${s.attempts.length} (${pct(success, s.attempts.length)})`, `Darts aufs Doppel: ${dbl.length}, getroffen: ${dblHits} (${pct(dblHits, dbl.length)})`];
    if (s.config.mode === 'ladder') {
      const best = maxChecked(s);
      metrics.highestCheckout = best;
      lines.unshift(best ? `Höchster Checkout: ${best}` : 'Noch kein Checkout geschafft');
      return {
        primary: { label: 'Höchster Checkout', value: best, display: best ? `${best}` : '–', higherIsBetter: true },
        completed: isDone(s),
        metrics,
        lines,
      };
    }
    return {
      primary: {
        label: 'Checkout-Quote',
        value: s.attempts.length ? (success / s.attempts.length) * 100 : null,
        display: pct(success, s.attempts.length),
        higherIsBetter: true,
        unit: '%',
      },
      completed: isDone(s),
      metrics,
      lines,
    };
  },
};

function maxChecked(s: CheckoutState): number {
  return s.attempts.filter((a) => a.success).reduce((m, a) => Math.max(m, a.target), 0);
}
