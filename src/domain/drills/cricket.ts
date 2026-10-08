import { dartLabel, makeDart } from '../board';
import { currentVisit, DARTS_PER_VISIT, fmt, record } from './helpers';
import type { CricketConfig, DrillResult, DrillView, EngineModule, ThrowRecord } from './types';

/**
 * Cricket-Training (solo): Schließe 20, 19, 18, 17, 16, 15 und Bull mit je drei
 * Marks (Single = 1, Double = 2, Triple = 3; Bull: 25 = 1, Bullseye = 2) in
 * möglichst wenigen Aufnahmen. Kennzahl: Marks pro Runde (MPR).
 */
export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];

export interface CricketState {
  config: CricketConfig;
  marks: Record<number, number>;
  throws: ThrowRecord[];
  /** Zählende Marks (bis zum Schließen). */
  counted: number;
}

function allClosed(s: CricketState): boolean {
  return CRICKET_NUMBERS.every((n) => (s.marks[n] ?? 0) >= 3);
}

function isDone(s: CricketState): boolean {
  return allClosed(s) || s.throws.length >= s.config.maxRounds * DARTS_PER_VISIT;
}

export const cricket: EngineModule<CricketConfig, CricketState> = {
  init(config) {
    return { config, marks: {}, throws: [], counted: 0 };
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const d = e.dart;
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const open = CRICKET_NUMBERS.includes(d.n) && (s.marks[d.n] ?? 0) < 3;
    const rec: ThrowRecord = { ...record(d, null, round, e.at), hit: open && d.m > 0 };
    if (!open || d.m === 0) return { ...s, throws: [...s.throws, rec] };
    const before = s.marks[d.n] ?? 0;
    const after = Math.min(3, before + d.m);
    return { ...s, marks: { ...s.marks, [d.n]: after }, counted: s.counted + (after - before), throws: [...s.throws, rec] };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const done = isDone(s);
    const rounds = Math.ceil(s.throws.length / DARTS_PER_VISIT);
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const openNums = CRICKET_NUMBERS.filter((n) => (s.marks[n] ?? 0) < 3);
    const quick = openNums.flatMap((n) => (n === 25 ? [makeDart(25, 1), makeDart(25, 2)] : [makeDart(n, 1), makeDart(n, 2), makeDart(n, 3)]));
    const last = s.throws[s.throws.length - 1];
    return {
      target: null,
      headline: done ? 'Fertig' : openNums.map((n) => (n === 25 ? 'B' : `${n}`)).join(' · '),
      caption: done ? undefined : 'Offene Felder – schließe jedes mit drei Marks',
      progress: CRICKET_NUMBERS.reduce((a, n) => a + Math.min(3, s.marks[n] ?? 0), 0) / (CRICKET_NUMBERS.length * 3),
      stats: [
        { label: 'Runde', value: `${Math.min(round + 1, s.config.maxRounds)}/${s.config.maxRounds}` },
        { label: 'MPR', value: rounds ? fmt((s.counted / s.throws.length) * DARTS_PER_VISIT, 2) : '–' },
      ],
      visitDarts: currentVisit(s.throws, s.throws.length % DARTS_PER_VISIT === 0 && round > 0 ? round - 1 : round),
      awaiting: done ? 'done' : 'dart',
      feedback: last ? (last.hit ? { tone: 'good', text: `${dartLabel(last.dart)} zählt` } : { tone: 'neutral', text: `${dartLabel(last.dart)} zählt nicht` }) : undefined,
      quick: [...quick, makeDart(0, 0)],
      panel: { type: 'cricket', marks: CRICKET_NUMBERS.map((n) => ({ n, marks: s.marks[n] ?? 0 })) },
    };
  },

  result(s): DrillResult {
    const closed = allClosed(s);
    const mpr = s.throws.length ? (s.counted / s.throws.length) * DARTS_PER_VISIT : 0;
    const rounds = Math.ceil(s.throws.length / DARTS_PER_VISIT);
    return {
      primary: { label: 'Marks pro Runde', value: s.throws.length ? mpr : null, display: fmt(mpr, 2), higherIsBetter: true, unit: 'MPR' },
      completed: isDone(s),
      metrics: { darts: s.throws.length, marks: s.counted, mpr, rounds, closed: closed ? 1 : 0, hits: s.throws.filter((t) => t.hit).length, attempts: s.throws.length },
      lines: [closed ? `Alle Felder geschlossen in ${rounds} Runden` : `${CRICKET_NUMBERS.filter((n) => (s.marks[n] ?? 0) >= 3).length} von 7 Feldern geschlossen`, `MPR: ${fmt(mpr, 2)}`],
    };
  },
};
