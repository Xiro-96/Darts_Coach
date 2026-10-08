import type { DrillConfig } from './drills/types';
import { configKey } from './drills/registry';
import type { SessionPhase, SessionRecord } from './models';
import { compareRates, compareValues, rate, type TrendResult } from './stats';

/**
 * Leistungstest (Eingangstest und Wiederholung). Immer identische Aufgaben,
 * damit Vorher-Nachher-Vergleiche fair sind.
 */
export interface AssessmentPart {
  id: string;
  title: string;
  coach: string;
  drillId: string;
  config: DrillConfig;
  minutes: number;
  /** Welche Kennzahl verglichen wird. */
  metric: 'hitRate' | 'groupSize' | 'points';
}

export const ASSESSMENT_PARTS: AssessmentPart[] = [
  {
    id: 'grouping',
    title: 'Test 1 · Gruppierung',
    coach: 'Fünf Runden à drei Darts aufs Bull. Punkte sind egal – es geht nur darum, wie eng deine Darts zusammen liegen. Tippe die Positionen möglichst genau an.',
    drillId: 'grouping',
    config: { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds: 5, measure: 'positions' },
    minutes: 4,
    metric: 'groupSize',
  },
  {
    id: 'singles',
    title: 'Test 2 · Große Singles',
    coach: 'Je 9 Darts auf 20, 19 und 18. Treffer ist das ganze Segment der jeweiligen Zahl.',
    drillId: 'big-singles',
    config: {
      engine: 'target',
      targets: [{ n: 20, kind: 'number' }, { n: 19, kind: 'number' }, { n: 18, kind: 'number' }],
      rotation: 'block',
      blockSize: 9,
      totalDarts: 27,
      scoring: 'hits',
    },
    minutes: 5,
    metric: 'hitRate',
  },
  {
    id: 'switch',
    title: 'Test 3 · Zielwechsel',
    coach: 'Jetzt wechselt das Ziel nach jedem Dart: 20 → 19 → 18. Sechs Aufnahmen.',
    drillId: 'target-switch',
    config: { engine: 'target', targets: [{ n: 20, kind: 'number' }, { n: 19, kind: 'number' }, { n: 18, kind: 'number' }], rotation: 'dart', totalDarts: 18, scoring: 'hits' },
    minutes: 4,
    metric: 'hitRate',
  },
  {
    id: 'doubles',
    title: 'Test 4 · Doppel',
    coach: 'Abwechselnd je eine Aufnahme auf D20 und D16. Doppel sind schwer – als Anfänger sind wenige Treffer völlig normal.',
    drillId: 'd20',
    config: { engine: 'target', targets: [{ n: 20, kind: 'double' }, { n: 16, kind: 'double' }], rotation: 'visit', totalDarts: 18, scoring: 'hits' },
    minutes: 4,
    metric: 'hitRate',
  },
  {
    id: 'scoring',
    title: 'Test 5 · Scoring',
    coach: 'Zum Schluss sieben Aufnahmen auf die 20. Alle Punkte zählen.',
    drillId: 'highscore',
    config: { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 21, scoring: 'total' },
    minutes: 4,
    metric: 'points',
  },
];

export const ASSESSMENT_MINUTES = ASSESSMENT_PARTS.reduce((a, p) => a + p.minutes, 0);

export function assessmentPhases(): SessionPhase[] {
  return ASSESSMENT_PARTS.map((p) => ({
    id: `assess-${p.id}`,
    title: p.title,
    coach: p.coach,
    drillId: p.drillId,
    variantId: `assessment-${p.id}`,
    config: p.config,
    minutes: p.minutes,
  }));
}

export function completedAssessments(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.filter((s) => s.kind === 'assessment' && s.completed).sort((a, b) => a.startedAt - b.startedAt);
}

export interface PartComparison {
  part: AssessmentPart;
  before: { value: number | null; display: string; n: number };
  after: { value: number | null; display: string; n: number };
  trend: TrendResult;
  higherIsBetter: boolean;
}

function partRecord(s: SessionRecord, part: AssessmentPart) {
  const key = configKey(part.config);
  return s.drills.find((d) => d.configKey === key);
}

function partValue(s: SessionRecord, part: AssessmentPart): { value: number | null; display: string; n: number; samples: number[]; hits: number } {
  const d = partRecord(s, part);
  if (!d) return { value: null, display: '–', n: 0, samples: [], hits: 0 };
  if (part.metric === 'hitRate') {
    const hits = d.throws.filter((t) => t.hit).length;
    const n = d.throws.filter((t) => t.hit !== null).length;
    return { value: n ? (hits / n) * 100 : null, display: n ? `${Math.round((hits / n) * 100)} %` : '–', n, samples: [], hits };
  }
  if (part.metric === 'groupSize') {
    const mm = d.result.metrics.groupSizeMm;
    const rounds = d.result.metrics.roundsMeasured ?? 0;
    // Einzelne Gruppen für den Vergleich rekonstruieren
    const samples: number[] = [];
    const byRound = new Map<number, { x: number; y: number }[]>();
    for (const t of d.throws) if (t.dart.p) byRound.set(t.round, [...(byRound.get(t.round) ?? []), t.dart.p]);
    for (const pts of byRound.values()) {
      if (pts.length !== 3) continue;
      let max = 0;
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) max = Math.max(max, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
      samples.push(max / 10);
    }
    return { value: mm !== undefined ? mm / 10 : null, display: mm !== undefined ? `${(mm / 10).toFixed(1).replace('.', ',')} cm` : '–', n: rounds, samples, hits: 0 };
  }
  // points: Punkte je Aufnahme als Stichproben
  const rounds = new Map<number, number>();
  for (const t of d.throws) rounds.set(t.round, (rounds.get(t.round) ?? 0) + t.dart.n * t.dart.m);
  const samples = [...rounds.values()];
  const total = d.result.metrics.points ?? 0;
  return { value: total, display: `${total}`, n: d.result.metrics.darts ?? 0, samples, hits: 0 };
}

/** Vergleicht Eingangstest und letzte Wiederholung je Teiltest – mit Signifikanzprüfung. */
export function compareAssessments(baseline: SessionRecord, retest: SessionRecord): PartComparison[] {
  return ASSESSMENT_PARTS.map((part) => {
    const b = partValue(baseline, part);
    const a = partValue(retest, part);
    let trend: TrendResult;
    const higherIsBetter = part.metric !== 'groupSize';
    if (part.metric === 'hitRate') trend = compareRates(rate(b.hits, b.n), rate(a.hits, a.n), 18);
    else trend = compareValues(b.samples, a.samples, higherIsBetter, 3);
    return { part, before: b, after: a, trend, higherIsBetter };
  });
}
