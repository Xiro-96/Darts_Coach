import type { DrillConfig, DrillResult } from './drills/types';
import { configKey } from './drills/registry';
import type { PlayerLevel, Profile, SessionRecord } from './models';
import { createRng, hashString } from './random';
import { median } from './statistics';
import { allThrows, hasTarget, startOfDay, startOfWeek } from './stats';

export interface ChallengeGoal {
  /** 'primary' oder ein Schlüssel aus result.metrics */
  metric: string;
  op: '>=' | '<=';
  value: number;
}

export interface Challenge {
  id: string;
  type: 'daily';
  title: string;
  description: string;
  drillId: string;
  config: DrillConfig;
  goal: ChallengeGoal;
  goalText: string;
  personalized: boolean;
}

type LevelValues = Record<PlayerLevel, number>;

interface Template {
  key: string;
  title: string;
  drillId: string;
  config: DrillConfig;
  metric: string;
  op: '>=' | '<=';
  levels: LevelValues;
  text: (v: number) => string;
  max?: number;
  min?: number;
}

const TEMPLATES: Template[] = [
  {
    key: 'hits20',
    title: 'Volltreffer 20',
    drillId: 'big-singles',
    config: { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 30, scoring: 'hits' },
    metric: 'hits',
    op: '>=',
    levels: { beginner: 10, intermediate: 15, advanced: 20 },
    text: (v) => `Triff mit 30 Darts mindestens ${v}× die 20.`,
    max: 30,
  },
  {
    key: 'atcSprint',
    title: 'Uhr-Sprint',
    drillId: 'atc',
    config: { engine: 'atc', ring: 'number', bull: false, jump: false, maxDarts: 45 },
    metric: 'targetsCleared',
    op: '>=',
    levels: { beginner: 10, intermediate: 15, advanced: 20 },
    text: (v) => `Schaffe mit 45 Darts mindestens ${v} Zahlen bei Around the Clock.`,
    max: 20,
  },
  {
    key: 'bullGroup',
    title: 'Enge Gruppe',
    drillId: 'grouping',
    config: { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds: 4, measure: 'positions' },
    metric: 'primary',
    op: '<=',
    levels: { beginner: 9, intermediate: 7, advanced: 5 },
    text: (v) => `Vier Gruppen aufs Bull mit einer Ø Gruppengröße von höchstens ${v} cm.`,
    min: 2,
  },
  {
    key: 'doubles15',
    title: 'Doppel-Duell',
    drillId: 'd16',
    config: { engine: 'target', targets: [{ n: 20, kind: 'double' }, { n: 16, kind: 'double' }], rotation: 'visit', totalDarts: 15, scoring: 'hits' },
    metric: 'hits',
    op: '>=',
    levels: { beginner: 1, intermediate: 2, advanced: 4 },
    text: (v) => `Triff mit 15 Darts (abwechselnd D20/D16) mindestens ${v} Doppel.`,
    max: 15,
  },
  {
    key: 'highscore5',
    title: 'Punktejagd',
    drillId: 'highscore',
    config: { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 15, scoring: 'total' },
    metric: 'primary',
    op: '>=',
    levels: { beginner: 120, intermediate: 200, advanced: 300 },
    text: (v) => `Erziele in 5 Aufnahmen mindestens ${v} Punkte.`,
    max: 900,
  },
  {
    key: 'checkout5',
    title: 'Finish-Five',
    drillId: 'checkout-doubles',
    config: { engine: 'checkout', mode: 'random', min: 2, max: 40, evenOnly: true, attempts: 5, dartsPerAttempt: 3, out: 'double', seed: 1 },
    metric: 'successes',
    op: '>=',
    levels: { beginner: 1, intermediate: 2, advanced: 3 },
    text: (v) => `Checke mindestens ${v} von 5 Restwerten (2–40) mit je 3 Darts.`,
    max: 5,
  },
  {
    key: 'follow5',
    title: 'Schattenwurf',
    drillId: 'follow-leader',
    config: { engine: 'follow', rounds: 5 },
    metric: 'primary',
    op: '>=',
    levels: { beginner: 30, intermediate: 45, advanced: 60 },
    text: (v) => `Follow the Leader: mindestens ${v} % der Folgedarts im gleichen Feld (5 Runden).`,
    max: 100,
  },
];

function dateKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function metricValue(result: DrillResult, metric: string): number | null {
  if (metric === 'primary') return result.primary.value;
  return result.metrics[metric] ?? null;
}

export function goalReached(result: DrillResult, goal: ChallengeGoal): boolean {
  if (!result.completed) return false;
  const v = metricValue(result, goal.metric);
  if (v === null) return false;
  return goal.op === '>=' ? v >= goal.value : v <= goal.value;
}

/**
 * Tageschallenge: täglich wechselnd (deterministisch nach Datum). Die Zielmarke
 * richtet sich nach deinen bisherigen Ergebnissen derselben Aufgabe (leicht über
 * deinem Median) – sonst nach deinem Niveau.
 */
export function dailyChallenge(profile: Profile, sessions: SessionRecord[], now = Date.now()): Challenge {
  const key = dateKey(now);
  const rng = createRng(hashString(`daily:${key}`));
  const yesterday = createRng(hashString(`daily:${dateKey(now - 86400000)}`));
  const yIdx = Math.floor(yesterday() * TEMPLATES.length);
  let idx = Math.floor(rng() * TEMPLATES.length);
  if (idx === yIdx) idx = (idx + 1) % TEMPLATES.length;
  const t = TEMPLATES[idx];
  const config = t.config.engine === 'checkout' ? { ...t.config, seed: hashString(key) } : t.config;

  const history: number[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      if (d.configKey !== configKey(config) || !d.result.completed) continue;
      const v = metricValue(d.result, t.metric);
      if (v !== null) history.push(v);
    }
  }
  let value = t.levels[profile.level];
  let personalized = false;
  if (history.length >= 3) {
    const m = median(history.slice(-5))!;
    value = t.op === '>=' ? Math.ceil(m * 1.1 + 0.01) : Math.round(m * 0.9 * 10) / 10;
    personalized = true;
  }
  if (t.max !== undefined) value = Math.min(value, t.max);
  if (t.min !== undefined) value = Math.max(value, t.min);
  return {
    id: `daily:${key}`,
    type: 'daily',
    title: t.title,
    description: personalized ? 'Zielmarke knapp über deinem bisherigen Mittelwert.' : 'Zielmarke passend zu deinem Niveau.',
    drillId: t.drillId,
    config,
    goal: { metric: t.metric, op: t.op, value },
    goalText: t.text(value),
    personalized,
  };
}

export function challengeDone(sessions: SessionRecord[], id: string): boolean {
  return sessions.some((s) => s.challengeId === id && s.challengeSuccess);
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  current: number;
  goal: number;
  done: boolean;
}

/** Wochenchallenge: prozessorientiert (regelmäßig, abwechslungsreich) statt "mehr ist besser". */
export function weeklyChallenge(profile: Profile, sessions: SessionRecord[], now = Date.now()): WeeklyChallenge {
  const ws = startOfWeek(now);
  const inWeek = sessions.filter((s) => s.startedAt >= ws);
  const rng = createRng(hashString(`week:${dateKey(ws)}`));
  const options = [
    () => {
      const goal = Math.min(3, Math.max(2, profile.sessionsPerWeek));
      const days = new Set(inWeek.filter((s) => s.completed).map((s) => startOfDay(s.startedAt))).size;
      return { key: 'days', title: 'Regelmäßigkeit', description: `Trainiere an ${goal} verschiedenen Tagen – kurze Einheiten zählen voll.`, current: days, goal };
    },
    () => {
      const n = inWeek.reduce((a, s) => a + s.drills.filter((d) => d.config.engine === 'focus' && d.result.completed).length, 0);
      return { key: 'technique', title: 'Technik-Woche', description: 'Schließe 3 Technik-Übungen ab (je ein Schwerpunkt).', current: n, goal: 3 };
    },
    () => {
      const n = allThrows(inWeek).filter((t) => t.dart.p).length;
      return { key: 'board', title: 'Heatmap füllen', description: 'Erfasse 150 Darts über die Scheibe – so entsteht deine Trefferbild-Analyse.', current: n, goal: 150 };
    },
    () => {
      const n = new Set(inWeek.flatMap((s) => s.drills.map((d) => d.drillId))).size;
      return { key: 'variety', title: 'Abwechslung', description: 'Absolviere 4 verschiedene Übungen – Variation fördert das Lernen.', current: n, goal: 4 };
    },
    () => {
      const n = allThrows(inWeek).filter((t) => hasTarget(t) && (t.target.kind === 'double' || t.target.kind === 'bullseye')).length;
      return { key: 'doubles', title: 'Doppel-Woche', description: 'Wirf 60 Darts auf Doppel (in beliebigen Übungen).', current: n, goal: 60 };
    },
  ];
  const pickIdx = profile.level === 'beginner' ? Math.floor(rng() * 4) : Math.floor(rng() * options.length);
  const c = options[pickIdx]();
  return { id: `weekly:${dateKey(ws)}:${c.key}`, title: c.title, description: c.description, current: Math.min(c.current, c.goal), goal: c.goal, done: c.current >= c.goal };
}
