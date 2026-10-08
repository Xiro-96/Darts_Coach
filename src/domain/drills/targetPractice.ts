import { dartScore, targetLabel } from '../board';
import type { Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, fmt, hitFeedback, pct, quickFor, ratio, record } from './helpers';
import type { DrillEvent, DrillResult, DrillView, EngineModule, TargetPracticeConfig, ThrowRecord } from './types';

/**
 * Universelle Zielübung: Big Singles, Zielwechsel, 20er-/19er-Training,
 * Triple-, Double- und Bull-Training, 100-Darts-Challenge, Highscore …
 */
export interface TargetPracticeState {
  config: TargetPracticeConfig;
  throws: ThrowRecord[];
  /** Darts inkl. Aufnahmen, die als Gesamtsumme eingegeben wurden. */
  dartCount: number;
  /** Punkte aus Gesamteingaben (nur bei scoring = total). */
  visitPoints: number;
}

function targetAt(c: TargetPracticeConfig, dartIndex: number): Target {
  const len = c.targets.length;
  if (c.rotation === 'dart') return c.targets[dartIndex % len];
  if (c.rotation === 'visit') return c.targets[Math.floor(dartIndex / DARTS_PER_VISIT) % len];
  return c.targets[Math.floor(dartIndex / (c.blockSize ?? DARTS_PER_VISIT)) % len];
}

function pointsOnTarget(throws: ThrowRecord[]): number {
  return throws.reduce((s, t) => (t.target && t.dart.n === t.target.n ? s + dartScore(t.dart) : s), 0);
}

function isDone(s: TargetPracticeState): boolean {
  return s.dartCount >= s.config.totalDarts;
}

function totalPoints(s: TargetPracticeState): number {
  return s.throws.reduce((sum, t) => sum + dartScore(t.dart), 0) + s.visitPoints;
}

export const targetPractice: EngineModule<TargetPracticeConfig, TargetPracticeState> = {
  init(config) {
    if (config.targets.length === 0) throw new Error('Mindestens ein Ziel erforderlich');
    return { config, throws: [], dartCount: 0, visitPoints: 0 };
  },

  apply(s, e: DrillEvent) {
    if (isDone(s)) return s;
    if (e.t === 'dart') {
      const target = targetAt(s.config, s.dartCount);
      const round = Math.floor(s.dartCount / DARTS_PER_VISIT);
      return { ...s, throws: [...s.throws, record(e.dart, target, round, e.at)], dartCount: s.dartCount + 1 };
    }
    if (e.t === 'visit' && s.config.scoring === 'total') {
      if (s.dartCount % DARTS_PER_VISIT !== 0) throw new Error('Gesamteingabe nur zu Beginn einer Aufnahme');
      if (e.score < 0 || e.score > 180) throw new Error('Punktzahl muss zwischen 0 und 180 liegen');
      const darts = Math.min(DARTS_PER_VISIT, s.config.totalDarts - s.dartCount);
      return { ...s, dartCount: s.dartCount + darts, visitPoints: s.visitPoints + e.score };
    }
    return s;
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const c = s.config;
    const done = isDone(s);
    const target = done ? null : targetAt(c, s.dartCount);
    const round = Math.floor(s.dartCount / DARTS_PER_VISIT);
    const { hits, attempts } = countHits(s.throws);
    const stats: DrillView['stats'] = [{ label: 'Dart', value: `${Math.min(s.dartCount + 1, c.totalDarts)}/${c.totalDarts}` }];
    if (c.scoring === 'hits') stats.push({ label: 'Treffer', value: `${hits} (${pct(hits, attempts)})` });
    if (c.scoring === 'points') stats.push({ label: 'Punkte auf Ziel', value: `${pointsOnTarget(s.throws)}` });
    if (c.scoring === 'total') {
      stats.push({ label: 'Punkte', value: `${totalPoints(s)}` });
      stats.push({ label: 'Ø 3 Darts', value: s.dartCount ? fmt((totalPoints(s) / s.dartCount) * 3) : '–' });
    }
    const next = target ? targetLabel(target) : '';
    return {
      target,
      headline: done ? 'Fertig' : next,
      caption: c.targets.length > 1 ? `Zielfolge: ${c.targets.map(targetLabel).join(' → ')}` : undefined,
      progress: s.dartCount / c.totalDarts,
      stats,
      visitDarts: currentVisit(s.throws, s.dartCount % DARTS_PER_VISIT === 0 && s.dartCount > 0 ? round - 1 : round),
      awaiting: done ? 'done' : 'dart',
      feedback: hitFeedback(s.throws[s.throws.length - 1]),
      quick: quickFor(target),
      allowVisitTotal: c.scoring === 'total',
    };
  },

  result(s): DrillResult {
    const c = s.config;
    const { hits, attempts } = countHits(s.throws);
    const numberHits = s.throws.filter((t) => t.target && t.dart.n === t.target.n).length;
    const trebles = s.throws.filter((t) => t.dart.m === 3).length;
    const doubles = s.throws.filter((t) => t.dart.m === 2 && t.dart.n !== 25).length;
    const total = totalPoints(s);
    const onTarget = pointsOnTarget(s.throws);
    const completed = isDone(s);
    const metrics: Record<string, number> = {
      darts: s.dartCount,
      hits,
      attempts,
      numberHits,
      trebles,
      doubles,
      points: total,
      pointsOnTarget: onTarget,
    };
    const avg3 = s.dartCount > 0 ? (total / s.dartCount) * 3 : null;
    if (avg3 !== null) metrics.avg3 = avg3;

    let primary: DrillResult['primary'];
    if (c.scoring === 'hits') {
      const r = ratio(hits, attempts);
      primary = { label: 'Trefferquote', value: r === null ? null : r * 100, display: pct(hits, attempts), higherIsBetter: true, unit: '%' };
    } else if (c.scoring === 'points') {
      primary = { label: 'Punkte auf Ziel', value: onTarget, display: `${onTarget}`, higherIsBetter: true };
    } else {
      primary = { label: 'Punkte', value: total, display: `${total}`, higherIsBetter: true };
    }

    const lines = [`${s.dartCount} Darts geworfen`];
    if (attempts > 0) lines.push(`Zieltreffer: ${hits} von ${attempts} (${pct(hits, attempts)})`);
    if (c.targets.some((t) => t.kind !== 'number')) lines.push(`Richtige Zahl getroffen: ${numberHits} von ${s.throws.length}`);
    if (avg3 !== null && c.scoring !== 'hits') lines.push(`3-Dart-Average: ${fmt(avg3)}`);
    if (trebles) lines.push(`Triples: ${trebles}`);
    return { primary, completed, metrics, lines };
  },
};
