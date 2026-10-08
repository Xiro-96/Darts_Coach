import { completedAssessments } from './assessment';
import { groupSizesFrom, sessionDarts, startOfDay, startOfWeek, DAY_MS } from './stats';
import type { Profile, SessionRecord } from './models';
import { TECHNIQUE_IDS } from './technique';

/**
 * Motivation ohne Übertraining: XP belohnen vor allem regelmäßiges, strukturiertes
 * Training. Darts bringen nur begrenzt XP (Tageslimit), damit lange Einheiten sich
 * nicht "lohnen".
 */

export const XP_RULES = {
  completedSession: 50,
  planSession: 25,
  assessment: 60,
  perThreeDarts: 1,
  dailyDartXpCap: 40,
  personalBest: 20,
  maxPbPerSession: 2,
  challengeSuccess: 30,
};

export interface XpBreakdown {
  total: number;
  lines: { label: string; xp: number }[];
}

/** XP für eine gerade abgeschlossene Einheit. `previous` = alle früheren Sessions. */
export function sessionXp(session: SessionRecord, previous: SessionRecord[], personalBests: number): XpBreakdown {
  const lines: XpBreakdown['lines'] = [];
  if (session.completed) lines.push({ label: 'Einheit abgeschlossen', xp: XP_RULES.completedSession });
  if (session.completed && session.kind === 'plan') lines.push({ label: 'Trainingsplan befolgt', xp: XP_RULES.planSession });
  if (session.completed && session.kind === 'assessment') lines.push({ label: 'Leistungstest', xp: XP_RULES.assessment });
  const today = startOfDay(session.startedAt);
  const dartXpToday = previous
    .filter((s) => startOfDay(s.startedAt) === today)
    .reduce((a, s) => a + Math.floor(sessionDarts(s) / 3) * XP_RULES.perThreeDarts, 0);
  const dartXp = Math.max(0, Math.min(XP_RULES.dailyDartXpCap - dartXpToday, Math.floor(sessionDarts(session) / 3) * XP_RULES.perThreeDarts));
  if (dartXp > 0) lines.push({ label: 'Geworfene Darts', xp: dartXp });
  const pbs = Math.min(personalBests, XP_RULES.maxPbPerSession);
  if (pbs > 0) lines.push({ label: pbs > 1 ? `${pbs} persönliche Rekorde` : 'Persönlicher Rekord', xp: pbs * XP_RULES.personalBest });
  if (session.challengeSuccess) lines.push({ label: 'Challenge geschafft', xp: XP_RULES.challengeSuccess });
  return { total: lines.reduce((a, l) => a + l.xp, 0), lines };
}

export function totalXp(sessions: SessionRecord[]): number {
  return sessions.reduce((a, s) => a + (s.xp ?? 0), 0);
}

const LEVEL_NAMES = [
  'Neuling',
  'Einsteiger',
  'Lernender',
  'Regelmäßiger Werfer',
  'Routinier',
  'Präzisionsarbeiter',
  'Gruppierer',
  'Scorer',
  'Finisher',
  'Kneipen-Ass',
  'Vereinsreif',
  'Liga-Material',
];

/** XP-Schwelle für ein Level (Level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.round(150 * (level - 1) ** 1.6);
}

export function levelInfo(xp: number): { level: number; name: string; current: number; next: number; progress: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], current, next, progress: (xp - current) / (next - current) };
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  earnedAt?: number;
  icon: string;
}

function dayStreak(sessions: SessionRecord[], now: number): number {
  const days = new Set(sessions.map((s) => startOfDay(s.startedAt)));
  let d = startOfDay(now);
  if (!days.has(d)) d -= DAY_MS; // heute noch nicht trainiert → Serie bis gestern zählt
  let streak = 0;
  while (days.has(d)) {
    streak++;
    d = startOfDay(d - DAY_MS / 2);
  }
  return streak;
}

/** Längste Serie vollständig abgeschlossener Einheiten in Folge. */
export function completedRun(sessions: SessionRecord[]): { current: number; best: number } {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  let cur = 0;
  let best = 0;
  for (const s of sorted) {
    cur = s.completed ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return { current: cur, best };
}

export function trainingStreak(sessions: SessionRecord[], now = Date.now()): number {
  return dayStreak(sessions, now);
}

export function weeklyProgress(profile: Profile, sessions: SessionRecord[], now = Date.now()): { done: number; goal: number; days: number[] } {
  const ws = startOfWeek(now);
  const inWeek = sessions.filter((s) => s.startedAt >= ws && s.completed);
  const days = [...new Set(inWeek.map((s) => (new Date(s.startedAt).getDay() + 6) % 7))];
  return { done: inWeek.length, goal: profile.sessionsPerWeek, days };
}

function firstTime(sessions: SessionRecord[], pred: (s: SessionRecord) => boolean): number | undefined {
  return [...sessions].sort((a, b) => a.startedAt - b.startedAt).find(pred)?.endedAt;
}

export function badges(profile: Profile, sessions: SessionRecord[], now = Date.now()): Badge[] {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  let cumulative = 0;
  let darts1000: number | undefined;
  let darts5000: number | undefined;
  for (const s of sorted) {
    cumulative += sessionDarts(s);
    if (!darts1000 && cumulative >= 1000) darts1000 = s.endedAt;
    if (!darts5000 && cumulative >= 5000) darts5000 = s.endedAt;
  }
  const tests = completedAssessments(sessions);
  const groups = groupSizesFrom(sessions);
  const tightGroup = groups.find((g) => g.mm <= 50);
  const run = completedRun(sessions);
  const streak = dayStreak(sessions, now);

  // Wochenziel in irgendeiner Woche erreicht
  const byWeek = new Map<number, number>();
  for (const s of sessions) if (s.completed) byWeek.set(startOfWeek(s.startedAt), (byWeek.get(startOfWeek(s.startedAt)) ?? 0) + 1);
  const weekGoal = [...byWeek.entries()].find(([, n]) => n >= profile.sessionsPerWeek);

  const drillWhere = (pred: (d: SessionRecord['drills'][number]) => boolean) => firstTime(sessions, (s) => s.drills.some(pred));

  const defs: Omit<Badge, 'earned'>[] = [
    { id: 'first', title: 'Erster Wurf', description: 'Erste Trainingseinheit abgeschlossen', icon: 'Target', earnedAt: firstTime(sessions, (s) => s.completed) },
    { id: 'baseline', title: 'Standort bestimmt', description: 'Eingangstest absolviert', icon: 'MapPin', earnedAt: tests[0]?.endedAt },
    { id: 'retest', title: 'Fortschritt gemessen', description: 'Leistungstest wiederholt', icon: 'TrendingUp', earnedAt: tests[1]?.endedAt },
    { id: 'three-in-row', title: 'Drei am Stück', description: 'Drei Einheiten hintereinander vollständig abgeschlossen', icon: 'Layers', earnedAt: run.best >= 3 ? firstRunEnd(sorted, 3) : undefined },
    { id: 'streak3', title: 'Dranbleiber', description: 'An drei Tagen in Folge trainiert', icon: 'Flame', earnedAt: streak >= 3 || longestDayStreak(sessions) >= 3 ? now : undefined },
    { id: 'week-goal', title: 'Wochenziel', description: `${profile.sessionsPerWeek} Einheiten in einer Woche`, icon: 'CalendarCheck', earnedAt: weekGoal ? weekGoal[0] + 6 * DAY_MS : undefined },
    { id: 'darts1000', title: '1.000 Darts', description: '1.000 Darts erfasst', icon: 'Hash', earnedAt: darts1000 },
    { id: 'darts5000', title: '5.000 Darts', description: '5.000 Darts erfasst', icon: 'Gem', earnedAt: darts5000 },
    { id: 'tight', title: 'Enge Gruppe', description: 'Eine gemessene Gruppe unter 5 cm', icon: 'Crosshair', earnedAt: tightGroup?.time },
    { id: 'atc', title: 'Einmal rund', description: 'Around the Clock komplett geschafft', icon: 'RotateCw', earnedAt: drillWhere((d) => d.config.engine === 'atc' && d.result.completed && (d.result.metrics.targetsCleared ?? 0) >= (d.result.metrics.targetsTotal ?? 99)) },
    { id: 'bob', title: 'Bob überlebt', description: "Bob's 27 klassisch ohne Ausscheiden beendet", icon: 'Shield', earnedAt: drillWhere((d) => d.config.engine === 'bobs27' && d.config.elimination !== 'none' && d.result.completed && d.result.metrics.eliminated === 0) },
    { id: 'checkout', title: 'Erstes Finish', description: 'Erster erfolgreicher Checkout', icon: 'CheckCircle2', earnedAt: drillWhere((d) => (d.result.metrics.successes ?? 0) > 0 || (d.result.metrics.checkouts ?? 0) > 0) },
    { id: 'ton', title: 'Ton!', description: '100 oder mehr Punkte in einer Aufnahme', icon: 'Zap', earnedAt: drillWhere((d) => (d.result.metrics.tons ?? 0) > 0 || visitMax(d) >= 100) },
    { id: 'routine', title: 'Routine-Profi', description: 'Technik-Übung mit mind. 8 Runden und ≥ 80 % Routine-Treue', icon: 'Repeat', earnedAt: drillWhere((d) => d.config.engine === 'focus' && (d.result.metrics.roundsRated ?? 0) >= 8 && (d.result.metrics.adherence ?? 0) >= 80) },
    { id: 'stage', title: 'Stufe geschafft', description: 'Eine Stufe des Trainingsplans abgeschlossen', icon: 'Award', earnedAt: profile.plan.history[0]?.endedAt },
    { id: 'technique', title: 'Technik-Fundament', description: 'Alle sieben Technikthemen als „sitzt“ markiert', icon: 'Sparkles', earnedAt: TECHNIQUE_IDS.every((t) => profile.techniqueStatus[t] === 'solid') ? now : undefined },
  ];
  return defs.map((b) => ({ ...b, earned: b.earnedAt !== undefined }));
}

function visitMax(d: SessionRecord['drills'][number]): number {
  const rounds = new Map<number, number>();
  for (const t of d.throws) rounds.set(t.round, (rounds.get(t.round) ?? 0) + t.dart.n * t.dart.m);
  return Math.max(0, ...rounds.values());
}

function firstRunEnd(sorted: SessionRecord[], len: number): number | undefined {
  let cur = 0;
  for (const s of sorted) {
    cur = s.completed ? cur + 1 : 0;
    if (cur >= len) return s.endedAt;
  }
  return undefined;
}

function longestDayStreak(sessions: SessionRecord[]): number {
  const days = [...new Set(sessions.map((s) => startOfDay(s.startedAt)))].sort((a, b) => a - b);
  let best = 0;
  let cur = 0;
  for (let i = 0; i < days.length; i++) {
    cur = i > 0 && Math.round((days[i] - days[i - 1]) / DAY_MS) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}
