import { targetLabel } from '../board';
import type { Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, hitFeedback, pct, quickFor, record } from './helpers';
import type { AtcConfig, DrillResult, DrillView, EngineModule, ThrowRecord } from './types';

/** Around the Clock: 1 bis 20 (optional Bull) der Reihe nach treffen. */
export interface AtcState {
  config: AtcConfig;
  idx: number;
  throws: ThrowRecord[];
}

function sequence(c: AtcConfig): number[] {
  const seq = Array.from({ length: 20 }, (_, i) => i + 1);
  if (c.bull) seq.push(25);
  return seq;
}

function targetFor(c: AtcConfig, n: number): Target {
  if (n === 25) return { n: 25, kind: c.ring === 'double' ? 'bullseye' : 'bull' };
  return { n, kind: c.ring };
}

function isDone(s: AtcState): boolean {
  return s.idx >= sequence(s.config).length || (s.config.maxDarts !== undefined && s.throws.length >= s.config.maxDarts);
}

export const aroundTheClock: EngineModule<AtcConfig, AtcState> = {
  init(config) {
    return { config, idx: 0, throws: [] };
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const seq = sequence(s.config);
    const target = targetFor(s.config, seq[s.idx]);
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const rec = record(e.dart, target, round, e.at);
    let idx = s.idx;
    if (rec.hit) {
      const step = s.config.jump && s.config.ring === 'number' && e.dart.n !== 25 ? e.dart.m : 1;
      idx = idx + step;
      const last = seq.length - 1;
      // Bull muss immer getroffen werden – Sprünge enden spätestens davor.
      if (s.config.bull && s.idx < last) idx = Math.min(idx, last);
      idx = Math.min(idx, seq.length);
    }
    return { ...s, idx, throws: [...s.throws, rec] };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const seq = sequence(s.config);
    const done = isDone(s);
    const target = done ? null : targetFor(s.config, seq[s.idx]);
    const { hits, attempts } = countHits(s.throws);
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const visitRound = s.throws.length % DARTS_PER_VISIT === 0 && s.throws.length > 0 ? round - 1 : round;
    const stats = [
      { label: 'Darts', value: `${s.throws.length}${s.config.maxDarts ? `/${s.config.maxDarts}` : ''}` },
      { label: 'Trefferquote', value: pct(hits, attempts) },
    ];
    return {
      target,
      headline: done ? 'Fertig' : target ? targetLabel(target) : '',
      caption: `Ziel ${Math.min(s.idx + 1, seq.length)} von ${seq.length}`,
      progress: s.idx / seq.length,
      stats,
      visitDarts: currentVisit(s.throws, visitRound),
      awaiting: done ? 'done' : 'dart',
      feedback: hitFeedback(s.throws[s.throws.length - 1]),
      quick: quickFor(target),
    };
  },

  result(s): DrillResult {
    const seq = sequence(s.config);
    const completed = s.idx >= seq.length;
    const { hits, attempts } = countHits(s.throws);
    const metrics: Record<string, number> = {
      darts: s.throws.length,
      hits,
      attempts,
      targetsCleared: Math.min(s.idx, seq.length),
      targetsTotal: seq.length,
    };
    const lines = [`${Math.min(s.idx, seq.length)} von ${seq.length} Zielen geschafft`, `Trefferquote: ${pct(hits, attempts)}`];
    if (s.config.maxDarts) {
      const cleared = Math.min(s.idx, seq.length);
      return {
        primary: { label: 'Ziele geschafft', value: cleared, display: `${cleared}/${seq.length}`, higherIsBetter: true },
        completed: completed || s.throws.length >= s.config.maxDarts,
        metrics,
        lines: [...lines, `${s.throws.length} Darts geworfen`],
      };
    }
    if (completed) lines.unshift(`Geschafft in ${s.throws.length} Darts`);
    return {
      primary: {
        label: 'Darts benötigt',
        value: completed ? s.throws.length : null,
        display: completed ? `${s.throws.length}` : '–',
        higherIsBetter: false,
        unit: 'Darts',
      },
      completed,
      metrics,
      lines,
    };
  },
};
