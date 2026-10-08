import { targetLabel } from '../board';
import type { Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, pct, quickFor, record } from './helpers';
import type { DoublesLadderConfig, DrillResult, DrillView, EngineModule, ThrowRecord } from './types';

/**
 * Doppel-Leiter mit ansteigendem Schwierigkeitsgrad: Jede Stufe verlangt einen
 * Treffer auf ein bestimmtes Doppel innerhalb eines Dart-Budgets. Das Budget wird
 * von Stufe zu Stufe kleiner. Ein Fehlversuch kostet ein Leben, die Stufe wird wiederholt.
 */
export interface LadderState {
  config: DoublesLadderConfig;
  stage: number;
  dartsOnStage: number;
  lives: number;
  throws: ThrowRecord[];
  last: 'hit' | 'life' | null;
}

function targetFor(c: DoublesLadderConfig, stage: number): Target {
  const n = c.stages[stage].n;
  return n === 25 ? { n: 25, kind: 'bullseye' } : { n, kind: 'double' };
}

function isDone(s: LadderState): boolean {
  return s.lives <= 0 || s.stage >= s.config.stages.length;
}

export const doublesLadder: EngineModule<DoublesLadderConfig, LadderState> = {
  init(config) {
    return { config, stage: 0, dartsOnStage: 0, lives: config.lives, throws: [], last: null };
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const rec = record(e.dart, targetFor(s.config, s.stage), Math.floor(s.throws.length / DARTS_PER_VISIT), e.at);
    const throws = [...s.throws, rec];
    if (rec.hit) return { ...s, throws, stage: s.stage + 1, dartsOnStage: 0, last: 'hit' };
    const dartsOnStage = s.dartsOnStage + 1;
    if (dartsOnStage >= s.config.stages[s.stage].budget) {
      return { ...s, throws, dartsOnStage: 0, lives: s.lives - 1, last: 'life' };
    }
    return { ...s, throws, dartsOnStage, last: null };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const done = isDone(s);
    const target = done ? null : targetFor(s.config, s.stage);
    const budget = done ? 0 : s.config.stages[s.stage].budget;
    const { hits, attempts } = countHits(s.throws);
    let feedback: DrillView['feedback'];
    if (s.last === 'hit') feedback = { tone: 'good', text: 'Stufe geschafft!' };
    if (s.last === 'life') feedback = { tone: 'bad', text: 'Budget aufgebraucht – ein Leben weniger. Gleiche Stufe nochmal.' };
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    return {
      target,
      headline: done ? 'Fertig' : targetLabel(target!),
      caption: done ? undefined : `Stufe ${s.stage + 1} von ${s.config.stages.length} · ${budget - s.dartsOnStage} von ${budget} Darts übrig`,
      progress: s.stage / s.config.stages.length,
      stats: [
        { label: 'Leben', value: '♥'.repeat(Math.max(0, s.lives)) || '0' },
        { label: 'Doppelquote', value: pct(hits, attempts) },
      ],
      visitDarts: currentVisit(s.throws, s.throws.length % DARTS_PER_VISIT === 0 && round > 0 ? round - 1 : round),
      awaiting: done ? 'done' : 'dart',
      feedback,
      quick: quickFor(target),
    };
  },

  result(s): DrillResult {
    const { hits, attempts } = countHits(s.throws);
    const cleared = Math.min(s.stage, s.config.stages.length);
    return {
      primary: { label: 'Stufen geschafft', value: cleared, display: `${cleared}/${s.config.stages.length}`, higherIsBetter: true },
      completed: isDone(s),
      metrics: { darts: s.throws.length, hits, attempts, stagesCleared: cleared, livesLeft: Math.max(0, s.lives) },
      lines: [`${cleared} von ${s.config.stages.length} Stufen geschafft`, `Doppeltreffer: ${hits} von ${attempts} (${pct(hits, attempts)})`],
    };
  },
};
