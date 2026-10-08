import { targetLabel } from '../board';
import { groupSize } from '../geometry';
import type { Point } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, fmt, hitFeedback, pct, quickFor, record } from './helpers';
import type { DrillResult, DrillView, EngineModule, FocusConfig, RatingPrompt, ThrowRecord } from './types';

/**
 * Technik- und Konstanzübung: Pro Runde drei Darts mit genau EINEM Technikschwerpunkt.
 * Nach jeder Runde bewertest du selbst, ob du den Schwerpunkt umsetzen konntest.
 * So wird nicht nur das Ergebnis, sondern auch der Prozess (die Routine) trainiert.
 */
export interface FocusState {
  config: FocusConfig;
  throws: ThrowRecord[];
  ratings: number[];
}

export function focusRating(question: string): RatingPrompt {
  return {
    question,
    options: [
      { value: 2, label: 'Ja, sauber', hint: 'bei allen drei Darts' },
      { value: 1, label: 'Teilweise', hint: 'bei ein oder zwei Darts' },
      { value: 0, label: 'Nein', hint: 'gedanklich woanders' },
    ],
  };
}

function round(s: FocusState): number {
  return Math.floor(s.throws.length / DARTS_PER_VISIT);
}

function needsRating(s: FocusState): boolean {
  return s.throws.length > 0 && s.throws.length % DARTS_PER_VISIT === 0 && s.ratings.length < round(s);
}

function isDone(s: FocusState): boolean {
  return round(s) >= s.config.rounds && !needsRating(s);
}

function groupSizes(s: FocusState): number[] {
  const out: number[] = [];
  for (let r = 0; r < round(s); r++) {
    const pts = s.throws
      .filter((t) => t.round === r)
      .map((t) => t.dart.p)
      .filter((p): p is Point => Boolean(p));
    if (pts.length === DARTS_PER_VISIT) out.push(groupSize(pts)!);
  }
  return out;
}

export const focusDrill: EngineModule<FocusConfig, FocusState> = {
  init(config) {
    return { config, throws: [], ratings: [] };
  },

  apply(s, e) {
    if (isDone(s)) return s;
    if (needsRating(s)) {
      return e.t === 'rate' ? { ...s, ratings: [...s.ratings, e.value] } : s;
    }
    if (e.t !== 'dart') return s;
    const r = round(s);
    const target = s.config.targets[r % s.config.targets.length];
    return { ...s, throws: [...s.throws, record(e.dart, target, r, e.at)] };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const done = isDone(s);
    const rating = needsRating(s);
    const r = round(s);
    const target = done || rating ? null : s.config.targets[r % s.config.targets.length];
    const { hits, attempts } = countHits(s.throws);
    const good = s.ratings.filter((v) => v === 2).length;
    return {
      target,
      headline: done ? 'Fertig' : rating ? 'Kurz reflektieren' : targetLabel(target!),
      caption: done ? undefined : `Fokus: ${s.config.cue}`,
      progress: r / s.config.rounds,
      stats: [
        { label: 'Runde', value: `${Math.min(r + (rating ? 0 : 1), s.config.rounds)}/${s.config.rounds}` },
        { label: 'Fokus umgesetzt', value: pct(good, s.ratings.length) },
        { label: 'Zieltreffer', value: pct(hits, attempts) },
      ],
      visitDarts: currentVisit(s.throws, s.throws.length % DARTS_PER_VISIT === 0 && r > 0 ? r - 1 : r),
      awaiting: done ? 'done' : rating ? 'rating' : 'dart',
      rating: rating ? focusRating(s.config.question) : undefined,
      feedback: rating ? undefined : hitFeedback(s.throws[s.throws.length - 1]),
      quick: quickFor(target),
      hint: s.config.cue,
    };
  },

  result(s): DrillResult {
    const { hits, attempts } = countHits(s.throws);
    const good = s.ratings.filter((v) => v === 2).length;
    const partial = s.ratings.filter((v) => v === 1).length;
    const adherence = s.ratings.length ? ((good + partial * 0.5) / s.ratings.length) * 100 : null;
    const sizes = groupSizes(s);
    const metrics: Record<string, number> = { darts: s.throws.length, hits, attempts, roundsRated: s.ratings.length };
    if (adherence !== null) metrics.adherence = adherence;
    const lines = [`Schwerpunkt sauber umgesetzt: ${good} von ${s.ratings.length} Runden`, `Zieltreffer: ${hits} von ${attempts} (${pct(hits, attempts)})`];
    if (sizes.length) {
      const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      metrics.groupSizeMm = avg;
      lines.push(`Ø Gruppengröße: ${fmt(avg / 10)} cm (aus ${sizes.length} Runden mit Positionen)`);
    }
    return {
      primary: { label: 'Routine-Treue', value: adherence, display: adherence === null ? '–' : `${Math.round(adherence)} %`, higherIsBetter: true, unit: '%' },
      completed: isDone(s),
      metrics,
      lines,
    };
  },
};
