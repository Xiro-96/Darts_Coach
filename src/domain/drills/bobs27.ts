import { targetLabel } from '../board';
import type { Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, pct, quickFor, record } from './helpers';
import type { Bobs27Config, DrillResult, DrillView, EngineModule, ThrowRecord } from './types';

/**
 * Bob's 27 (nach Bob Anderson):
 *  - Start mit 27 Punkten
 *  - Je drei Darts auf D1, D2, … D20 (optional zum Schluss Bullseye)
 *  - Jeder Treffer addiert den Wert des Doppels (D7 = 14, Bull = 50)
 *  - Kein Treffer mit drei Darts: Wert des Doppels wird abgezogen
 *  - Klassisch: Fällt der Stand unter 0, ist das Spiel vorbei
 * Maximal möglich: 1437 Punkte (mit Bull).
 */
export interface Bobs27State {
  config: Bobs27Config;
  score: number;
  idx: number;
  dartsOnTarget: number;
  hitsOnTarget: number;
  throws: ThrowRecord[];
  eliminated: boolean;
  lastChange: number | null;
}

function sequence(c: Bobs27Config): number[] {
  const seq = Array.from({ length: 20 }, (_, i) => i + 1);
  if (c.bull) seq.push(25);
  return seq;
}

function targetFor(n: number): Target {
  return n === 25 ? { n: 25, kind: 'bullseye' } : { n, kind: 'double' };
}

function value(n: number): number {
  return n === 25 ? 50 : n * 2;
}

function isDone(s: Bobs27State): boolean {
  return s.eliminated || s.idx >= sequence(s.config).length;
}

export const bobs27: EngineModule<Bobs27Config, Bobs27State> = {
  init(config) {
    return { config, score: 27, idx: 0, dartsOnTarget: 0, hitsOnTarget: 0, throws: [], eliminated: false, lastChange: null };
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const seq = sequence(s.config);
    const n = seq[s.idx];
    const rec = record(e.dart, targetFor(n), s.idx, e.at);
    let { score, dartsOnTarget, hitsOnTarget, idx, eliminated } = s;
    let lastChange: number | null = null;
    dartsOnTarget += 1;
    if (rec.hit) {
      hitsOnTarget += 1;
      score += value(n);
    }
    if (dartsOnTarget === DARTS_PER_VISIT) {
      if (hitsOnTarget === 0) score -= value(n);
      lastChange = hitsOnTarget === 0 ? -value(n) : hitsOnTarget * value(n);
      const mode = s.config.elimination;
      if ((mode === 'below' && score < 0) || (mode === 'zero' && score <= 0)) eliminated = true;
      idx += 1;
      dartsOnTarget = 0;
      hitsOnTarget = 0;
    }
    return { ...s, score, dartsOnTarget, hitsOnTarget, idx, eliminated, lastChange, throws: [...s.throws, rec] };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const seq = sequence(s.config);
    const done = isDone(s);
    const target = done ? null : targetFor(seq[s.idx]);
    const { hits, attempts } = countHits(s.throws);
    const visitRound = s.dartsOnTarget === 0 && s.idx > 0 ? s.idx - 1 : s.idx;
    let feedback: DrillView['feedback'];
    if (s.eliminated) feedback = { tone: 'bad', text: 'Unter die Grenze gefallen – Spiel vorbei. Nächstes Mal schaffst du mehr Doppel!' };
    else if (s.lastChange !== null)
      feedback = s.lastChange > 0 ? { tone: 'good', text: `+${s.lastChange} Punkte` } : { tone: 'bad', text: `${s.lastChange} Punkte` };
    return {
      target,
      headline: done ? 'Fertig' : target ? targetLabel(target) : '',
      caption: done ? undefined : `Doppel ${s.idx + 1} von ${seq.length} · Dart ${s.dartsOnTarget + 1}/3`,
      progress: s.idx / seq.length,
      stats: [
        { label: 'Punktestand', value: `${s.score}` },
        { label: 'Doppelquote', value: pct(hits, attempts) },
      ],
      visitDarts: currentVisit(s.throws, visitRound),
      awaiting: done ? 'done' : 'dart',
      feedback,
      quick: quickFor(target),
      hint: s.config.elimination === 'none' ? 'Anfängermodus: Du spielst alle Doppel durch, auch wenn der Stand negativ wird.' : undefined,
    };
  },

  result(s): DrillResult {
    const seq = sequence(s.config);
    const { hits, attempts } = countHits(s.throws);
    const completed = isDone(s);
    const lines = [
      s.eliminated ? `Ausgeschieden bei ${targetLabel(targetFor(seq[s.idx - 1]))}` : `Alle ${seq.length} Doppel gespielt`,
      `Doppeltreffer: ${hits} von ${attempts} (${pct(hits, attempts)})`,
    ];
    return {
      primary: { label: 'Punktestand', value: completed ? s.score : null, display: `${s.score}`, higherIsBetter: true, unit: 'Punkte' },
      completed,
      metrics: {
        darts: attempts,
        hits,
        attempts,
        score: s.score,
        eliminated: s.eliminated ? 1 : 0,
        doublesPlayed: s.idx,
      },
      lines,
    };
  },
};
