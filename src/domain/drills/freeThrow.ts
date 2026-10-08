import { dartLabel, dartScore } from '../board';
import { currentVisit, DARTS_PER_VISIT, fmt, quickFor, record } from './helpers';
import type { DrillResult, DrillView, EngineModule, FreeConfig, ThrowRecord } from './types';

/** Freies Werfen / Einwerfen: Jeder Dart wird erfasst, es gibt keine Regeln. */
export interface FreeState {
  config: FreeConfig;
  throws: ThrowRecord[];
}

function isDone(s: FreeState): boolean {
  return s.config.maxDarts !== undefined && s.throws.length >= s.config.maxDarts;
}

export const freeThrow: EngineModule<FreeConfig, FreeState> = {
  init(config) {
    return { config, throws: [] };
  },
  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    return { ...s, throws: [...s.throws, record(e.dart, null, Math.floor(s.throws.length / DARTS_PER_VISIT), e.at)] };
  },
  finished: isDone,
  throws(s) {
    return s.throws;
  },
  view(s): DrillView {
    const pts = s.throws.reduce((a, t) => a + dartScore(t.dart), 0);
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const last = s.throws[s.throws.length - 1];
    return {
      target: null,
      headline: isDone(s) ? 'Fertig' : 'Locker werfen',
      caption: 'Kein Druck: Rhythmus finden, Körper aufwärmen.',
      progress: s.config.maxDarts ? s.throws.length / s.config.maxDarts : 0,
      stats: [
        { label: 'Darts', value: `${s.throws.length}${s.config.maxDarts ? `/${s.config.maxDarts}` : ''}` },
        { label: 'Ø 3 Darts', value: s.throws.length ? fmt((pts / s.throws.length) * 3) : '–' },
      ],
      visitDarts: currentVisit(s.throws, s.throws.length % DARTS_PER_VISIT === 0 && round > 0 ? round - 1 : round),
      awaiting: isDone(s) ? 'done' : 'dart',
      feedback: last ? { tone: 'info', text: dartLabel(last.dart) } : undefined,
      quick: quickFor({ n: 20, kind: 'number' }),
    };
  },
  result(s): DrillResult {
    const pts = s.throws.reduce((a, t) => a + dartScore(t.dart), 0);
    const avg = s.throws.length ? (pts / s.throws.length) * 3 : null;
    return {
      primary: { label: 'Ø 3 Darts', value: avg, display: fmt(avg), higherIsBetter: true },
      completed: true,
      metrics: { darts: s.throws.length, points: pts, ...(avg !== null ? { avg3: avg } : {}) },
      lines: [`${s.throws.length} Darts eingeworfen`],
    };
  },
};
