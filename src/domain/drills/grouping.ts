import { targetLabel } from '../board';
import { groupSize } from '../geometry';
import type { Point, Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, fmt, pct, quickFor, record } from './helpers';
import type { DrillResult, DrillView, EngineModule, GroupingConfig, RatingPrompt, ThrowRecord } from './types';

/**
 * Grouping: Drei Darts möglichst eng zusammen werfen. Die Punktzahl ist zweitrangig.
 * Messung entweder über angetippte Positionen (Gruppengröße in mm) oder – wenn keine
 * Positionen vorliegen – über eine ehrlich gekennzeichnete Selbsteinschätzung.
 */
export interface GroupingState {
  config: GroupingConfig;
  throws: ThrowRecord[];
  /** Selbsteinschätzung je Runde (Index = Runde), nur wenn keine Positionen vorliegen. */
  ratings: (number | null)[];
  /** Gemessene Gruppengröße je Runde in mm. */
  sizes: (number | null)[];
}

export const GROUP_RATING: RatingPrompt = {
  question: 'Wie eng lagen deine drei Darts zusammen?',
  options: [
    { value: 1, label: 'Sehr eng', hint: 'unter 3 cm – etwa eine Münze' },
    { value: 2, label: 'Eng', hint: '3–6 cm – etwa ein Bierdeckel-Radius' },
    { value: 3, label: 'Mittel', hint: '6–10 cm' },
    { value: 4, label: 'Weit', hint: 'mehr als 10 cm' },
  ],
};

function targetFor(c: GroupingConfig, round: number): Target {
  return c.targets[round % c.targets.length];
}

function roundDarts(s: GroupingState, round: number): ThrowRecord[] {
  return s.throws.filter((t) => t.round === round);
}

function currentRound(s: GroupingState): number {
  return Math.floor(s.throws.length / DARTS_PER_VISIT);
}

/** Wartet die Übung auf eine Selbsteinschätzung der zuletzt abgeschlossenen Runde? */
function needsRating(s: GroupingState): boolean {
  if (s.throws.length === 0 || s.throws.length % DARTS_PER_VISIT !== 0) return false;
  const r = currentRound(s) - 1;
  if (s.ratings[r] !== undefined) return false;
  return s.config.measure === 'self' || s.sizes[r] === null;
}

function isDone(s: GroupingState): boolean {
  return currentRound(s) >= s.config.rounds && !needsRating(s);
}

export const grouping: EngineModule<GroupingConfig, GroupingState> = {
  init(config) {
    return { config, throws: [], ratings: [], sizes: [] };
  },

  apply(s, e) {
    if (isDone(s)) return s;
    if (needsRating(s)) {
      if (e.t !== 'rate') return s;
      const ratings = [...s.ratings];
      ratings[currentRound(s) - 1] = e.value;
      return { ...s, ratings };
    }
    if (e.t !== 'dart') return s;
    const round = currentRound(s);
    const throws = [...s.throws, record(e.dart, targetFor(s.config, round), round, e.at)];
    const next = { ...s, throws };
    if (throws.length % DARTS_PER_VISIT === 0) {
      const pts = roundDarts(next, round)
        .map((t) => t.dart.p)
        .filter((p): p is Point => Boolean(p));
      const sizes = [...s.sizes];
      sizes[round] = pts.length === DARTS_PER_VISIT ? groupSize(pts) : null;
      return { ...next, sizes };
    }
    return next;
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const round = currentRound(s);
    const rating = needsRating(s);
    const done = isDone(s);
    const target = done || rating ? null : targetFor(s.config, round);
    const measured = s.sizes.filter((v): v is number => typeof v === 'number');
    const lastSize = s.throws.length % DARTS_PER_VISIT === 0 && round > 0 ? s.sizes[round - 1] : null;
    const stats = [{ label: 'Runde', value: `${Math.min(round + (rating ? 0 : 1), s.config.rounds)}/${s.config.rounds}` }];
    if (measured.length) stats.push({ label: 'Ø Gruppe', value: `${fmt(measured.reduce((a, b) => a + b, 0) / measured.length / 10)} cm` });
    const { hits, attempts } = countHits(s.throws);
    stats.push({ label: 'Zieltreffer', value: pct(hits, attempts) });
    return {
      target: target ?? (rating ? targetFor(s.config, round - 1) : null),
      headline: done ? 'Fertig' : rating ? 'Bewerten' : targetLabel(targetFor(s.config, round)),
      caption: 'Drei Darts – möglichst eng zusammen. Punkte sind egal.',
      progress: round / s.config.rounds,
      stats,
      visitDarts: currentVisit(s.throws, s.throws.length % DARTS_PER_VISIT === 0 && round > 0 ? round - 1 : round),
      awaiting: done ? 'done' : rating ? 'rating' : 'dart',
      rating: rating ? GROUP_RATING : undefined,
      feedback:
        typeof lastSize === 'number'
          ? { tone: 'info', text: `Gruppengröße dieser Runde: ${fmt(lastSize / 10)} cm` }
          : undefined,
      quick: quickFor(target),
      preferBoard: s.config.measure === 'positions',
      hint:
        s.config.measure === 'positions'
          ? 'Tippe auf der Scheibe möglichst genau dorthin, wo der Dart steckt – nur so kann die Gruppengröße berechnet werden.'
          : undefined,
    };
  },

  result(s): DrillResult {
    const measured = s.sizes.filter((v): v is number => typeof v === 'number');
    const ratings = s.ratings.filter((v): v is number => typeof v === 'number');
    const { hits, attempts } = countHits(s.throws);
    const completed = isDone(s);
    const metrics: Record<string, number> = { darts: s.throws.length, hits, attempts, roundsMeasured: measured.length, roundsRated: ratings.length };
    const lines: string[] = [];
    let primary: DrillResult['primary'];
    if (s.config.measure === 'positions' && measured.length > 0) {
      const avg = measured.reduce((a, b) => a + b, 0) / measured.length;
      metrics.groupSizeMm = avg;
      metrics.bestGroupMm = Math.min(...measured);
      primary = { label: 'Ø Gruppengröße', value: avg / 10, display: `${fmt(avg / 10)} cm`, higherIsBetter: false, unit: 'cm' };
      lines.push(`Gemessen in ${measured.length} Runden (aus deinen Tipp-Positionen)`, `Engste Gruppe: ${fmt(Math.min(...measured) / 10)} cm`);
    } else {
      const tight = ratings.filter((r) => r <= 2).length;
      metrics.tightShare = ratings.length ? (tight / ratings.length) * 100 : 0;
      metrics.avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      primary = {
        label: 'Enge Gruppen (Selbsteinschätzung)',
        value: ratings.length ? (tight / ratings.length) * 100 : null,
        display: pct(tight, ratings.length),
        higherIsBetter: true,
        unit: '%',
      };
      lines.push(`${tight} von ${ratings.length} Runden als eng (unter 6 cm) eingeschätzt`, 'Hinweis: Selbsteinschätzung, keine Messung.');
    }
    lines.push(`Zieltreffer: ${pct(hits, attempts)}`);
    return { primary, completed, metrics, lines };
  },
};
