import { aimPoint, neighbours, targetLabel } from './board';
import { findDrill } from './drills/catalog';
import type { ThrowRecord } from './drills/types';
import { biasAnalysis, groupSize, type BiasAnalysis } from './geometry';
import type { DrillRecord, SessionRecord } from './models';
import { binomialTestHalf, mean, stdDev, twoProportionTest, welchTest, wilson } from './statistics';
import type { Point, Target } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ThrowWithContext extends ThrowRecord {
  sessionId: string;
  drillId: string;
  time: number;
  engine?: string;
}

/** Übungen, in denen das Treffen des Ziels ausdrücklich zweitrangig ist (Gruppieren). */
const HIT_NEUTRAL_ENGINES = new Set(['grouping', 'follow']);

export function sessionsInLastDays(sessions: SessionRecord[], days: number | null, now = Date.now()): SessionRecord[] {
  if (days === null) return sessions;
  const from = now - days * DAY_MS;
  return sessions.filter((s) => s.startedAt >= from);
}

export function allThrows(sessions: SessionRecord[]): ThrowWithContext[] {
  const out: ThrowWithContext[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      for (const t of d.throws) out.push({ ...t, sessionId: s.id, drillId: d.drillId, time: t.at ?? d.startedAt, engine: d.config.engine });
    }
  }
  return out;
}

/** Hat der Wurf ein echtes, eindeutiges Ziel? */
export function hasTarget<T extends ThrowRecord>(t: T): t is T & { target: Target; hit: boolean } {
  return t.target !== null && t.hit !== null && t.target.kind !== 'free' && t.target.kind !== 'board';
}

/** Zählt der Wurf für Trefferquoten? (Ziel vorhanden und keine reine Gruppierungsübung) */
export function countsForHitRate(t: ThrowWithContext): t is ThrowWithContext & { target: Target; hit: boolean } {
  return hasTarget(t) && !HIT_NEUTRAL_ENGINES.has(t.engine ?? '');
}

export function drillDarts(d: DrillRecord): number {
  return d.result.metrics.darts ?? d.throws.length;
}

export function sessionDarts(s: SessionRecord): number {
  return s.drills.reduce((a, d) => a + drillDarts(d), 0);
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Montag 00:00 der Woche (lokale Zeit). */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function trainingDays(sessions: SessionRecord[]): number {
  return new Set(sessions.map((s) => dayKey(s.startedAt))).size;
}

export interface Rate {
  hits: number;
  attempts: number;
  rate: number | null;
  low: number | null;
  high: number | null;
}

export function rate(hits: number, attempts: number): Rate {
  const w = wilson(hits, attempts);
  return { hits, attempts, rate: w?.p ?? null, low: w?.low ?? null, high: w?.high ?? null };
}

function isScoringAverageDrill(d: DrillRecord): boolean {
  if (d.drillId === 'free') return true;
  const def = findDrill(d.drillId);
  return Boolean(def && def.category === 'scoring' && d.config.engine === 'target' && d.config.targets.every((t) => t.kind === 'number'));
}

export interface Overview {
  sessions: number;
  trainingDays: number;
  activeMs: number;
  darts: number;
  target: Rate;
  doubles: Rate;
  trebles: Rate;
  /** 3-Dart-Average aus 301/501. */
  gameAverage: { value: number | null; darts: number };
  /** 3-Dart-Average aus Scoring-Übungen auf die 20/19. */
  scoringAverage: { value: number | null; darts: number };
  /** Checkout-Quote in 301/501 (Checkouts ÷ Darts aufs Doppel). */
  gameCheckout: Rate;
  /** Erfolgreiche Versuche in Checkout-Übungen. */
  drillCheckout: Rate;
  groupSize: { meanMm: number | null; rounds: number };
}

export function overview(sessions: SessionRecord[]): Overview {
  const throws = allThrows(sessions).filter(countsForHitRate);
  const hits = throws.filter((t) => t.hit).length;
  const dbl = throws.filter((t) => t.target.kind === 'double' || t.target.kind === 'bullseye');
  const tpl = throws.filter((t) => t.target.kind === 'triple');
  let gPts = 0;
  let gDarts = 0;
  let sPts = 0;
  let sDarts = 0;
  let coHits = 0;
  let coAtt = 0;
  let cdHits = 0;
  let cdAtt = 0;
  for (const s of sessions) {
    for (const d of s.drills) {
      const m = d.result.metrics;
      if (d.config.engine === 'x01') {
        gPts += m.points ?? 0;
        gDarts += m.darts ?? 0;
        coHits += m.checkouts ?? 0;
        coAtt += m.dartsAtDouble ?? 0;
      } else if (isScoringAverageDrill(d)) {
        sPts += m.points ?? 0;
        sDarts += m.darts ?? 0;
      }
      if (d.config.engine === 'checkout') {
        cdHits += m.successes ?? 0;
        cdAtt += m.attempts ?? 0;
      }
    }
  }
  const groups = groupSizesFrom(sessions);
  return {
    sessions: sessions.length,
    trainingDays: trainingDays(sessions),
    activeMs: sessions.reduce((a, s) => a + s.activeMs, 0),
    darts: sessions.reduce((a, s) => a + sessionDarts(s), 0),
    target: rate(hits, throws.length),
    doubles: rate(dbl.filter((t) => t.hit).length, dbl.length),
    trebles: rate(tpl.filter((t) => t.hit).length, tpl.length),
    gameAverage: { value: gDarts ? (gPts / gDarts) * 3 : null, darts: gDarts },
    scoringAverage: { value: sDarts ? (sPts / sDarts) * 3 : null, darts: sDarts },
    gameCheckout: rate(coHits, coAtt),
    drillCheckout: rate(cdHits, cdAtt),
    groupSize: { meanMm: mean(groups.map((g) => g.mm)), rounds: groups.length },
  };
}

/** Gemessene Gruppengrößen (3 Darts mit Positionen, gleiche Runde, gleiches Ziel) aus Grouping-/Technik-Übungen. */
export function groupSizesFrom(sessions: SessionRecord[]): { mm: number; time: number; sessionId: string }[] {
  const out: { mm: number; time: number; sessionId: string }[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      if (d.config.engine !== 'grouping' && d.config.engine !== 'focus') continue;
      const rounds = new Map<number, Point[]>();
      for (const t of d.throws) {
        if (!t.dart.p) continue;
        const list = rounds.get(t.round) ?? [];
        list.push(t.dart.p);
        rounds.set(t.round, list);
      }
      for (const pts of rounds.values()) {
        if (pts.length === 3) out.push({ mm: groupSize(pts)!, time: d.startedAt, sessionId: s.id });
      }
    }
  }
  return out;
}

export interface SegmentStat extends Rate {
  key: string;
  label: string;
  target: Target;
}

export function targetKey(t: Target): string {
  return `${t.kind}:${t.n}`;
}

/** Erfolgsquote je Zielfeld. */
export function segmentStats(sessions: SessionRecord[]): SegmentStat[] {
  const map = new Map<string, { target: Target; hits: number; attempts: number }>();
  for (const t of allThrows(sessions)) {
    if (!countsForHitRate(t)) continue;
    const k = targetKey(t.target);
    const e = map.get(k) ?? { target: t.target, hits: 0, attempts: 0 };
    e.attempts++;
    if (t.hit) e.hits++;
    map.set(k, e);
  }
  return [...map.entries()]
    .map(([key, e]) => ({ key, label: targetLabel(e.target), target: e.target, ...rate(e.hits, e.attempts) }))
    .sort((a, b) => b.attempts - a.attempts);
}

export interface MissDirection {
  n: number;
  left: number;
  right: number;
  leftN: number;
  rightN: number;
  misses: number;
  p: number;
}

/**
 * Wohin gehen Fehlwürfe bei Zahlenzielen? Zählt Treffer in den Nachbarsegmenten
 * links und rechts. Funktioniert auch mit Schnelleingabe (ohne Positionen).
 */
export function missDirections(sessions: SessionRecord[]): MissDirection[] {
  const map = new Map<number, { left: number; right: number; misses: number }>();
  for (const t of allThrows(sessions)) {
    if (!countsForHitRate(t) || t.hit || t.target.n < 1 || t.target.n > 20) continue;
    if (!['number', 'single', 'triple', 'double'].includes(t.target.kind)) continue;
    const [l, r] = neighbours(t.target.n);
    const e = map.get(t.target.n) ?? { left: 0, right: 0, misses: 0 };
    e.misses++;
    if (t.dart.n === l) e.left++;
    if (t.dart.n === r) e.right++;
    map.set(t.target.n, e);
  }
  return [...map.entries()].map(([n, e]) => {
    const [leftN, rightN] = neighbours(n);
    return { n, ...e, leftN, rightN, p: binomialTestHalf(e.left, e.left + e.right) };
  });
}

/** Abweichungen der Trefferpositionen vom Zielpunkt (nur Ziele mit eindeutigem Zielpunkt). */
export function aimOffsets(sessions: SessionRecord[]): Point[] {
  const out: Point[] = [];
  for (const t of allThrows(sessions)) {
    if (!hasTarget(t) || !t.dart.p) continue;
    if (t.target.kind === 'number') continue; // ganzes Segment: kein eindeutiger Zielpunkt
    const aim = aimPoint(t.target);
    if (!aim) continue;
    // Auf dem Board außerhalb des Doppelrings getippte Positionen sind echte Fehlwürfe – mitzählen.
    out.push({ x: t.dart.p.x - aim.x, y: t.dart.p.y - aim.y });
  }
  return out;
}

export function biasFrom(sessions: SessionRecord[]): BiasAnalysis | null {
  return biasAnalysis(aimOffsets(sessions));
}

export function heatmapPoints(sessions: SessionRecord[]): Point[] {
  return allThrows(sessions)
    .map((t) => t.dart.p)
    .filter((p): p is Point => Boolean(p));
}

export interface WeekPoint {
  weekStart: number;
  label: string;
  sessions: number;
  darts: number;
  target: Rate;
  doubles: Rate;
  groupMm: number | null;
  groupRounds: number;
  zeroVisitShare: number | null;
  visits: number;
}

/** Wochenwerte für Trenddiagramme. */
export function weeklyTrend(sessions: SessionRecord[], weeks: number, now = Date.now()): WeekPoint[] {
  const out: WeekPoint[] = [];
  const thisWeek = startOfWeek(now);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY_MS;
    // Sommer-/Winterzeit: Wochenbeginn neu berechnen
    const ws = startOfWeek(start + DAY_MS / 2);
    const we = startOfWeek(ws + 8 * DAY_MS);
    const inWeek = sessions.filter((s) => s.startedAt >= ws && s.startedAt < we);
    const throws = allThrows(inWeek).filter(countsForHitRate);
    const dbl = throws.filter((t) => t.target.kind === 'double' || t.target.kind === 'bullseye');
    const groups = groupSizesFrom(inWeek);
    const zero = zeroVisits(inWeek);
    const d = new Date(ws);
    out.push({
      weekStart: ws,
      label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`,
      sessions: inWeek.length,
      darts: inWeek.reduce((a, s) => a + sessionDarts(s), 0),
      target: rate(throws.filter((t) => t.hit).length, throws.length),
      doubles: rate(dbl.filter((t) => t.hit).length, dbl.length),
      groupMm: mean(groups.map((g) => g.mm)),
      groupRounds: groups.length,
      zeroVisitShare: zero.visits ? zero.zero / zero.visits : null,
      visits: zero.visits,
    });
  }
  return out;
}

/** Aufnahmen (3 Darts aufs gleiche Ziel) ganz ohne Treffer – ein einfacher Konstanz-Indikator. */
export function zeroVisits(sessions: SessionRecord[]): { zero: number; visits: number } {
  let zero = 0;
  let visits = 0;
  for (const s of sessions) {
    for (const d of s.drills) {
      if (d.config.engine !== 'target' || d.config.scoring === 'total') continue;
      const rounds = new Map<number, ThrowRecord[]>();
      for (const t of d.throws) {
        if (!hasTarget(t)) continue;
        const r = rounds.get(t.round) ?? [];
        r.push(t);
        rounds.set(t.round, r);
      }
      for (const r of rounds.values()) {
        if (r.length !== 3) continue;
        visits++;
        if (r.every((t) => !t.hit)) zero++;
      }
    }
  }
  return { zero, visits };
}

export interface HistoryPoint {
  sessionId: string;
  time: number;
  value: number;
  display: string;
}

/** Verlauf der Hauptkennzahl einer Übung (gleiche Konfiguration). */
export function drillHistory(sessions: SessionRecord[], drillId: string, configKey?: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const d of s.drills) {
      if (d.drillId !== drillId || (configKey && d.configKey !== configKey)) continue;
      if (!d.result.completed || d.result.primary.value === null) continue;
      out.push({ sessionId: s.id, time: d.startedAt, value: d.result.primary.value, display: d.result.primary.display });
    }
  }
  return out;
}

export interface PersonalBest {
  drillId: string;
  configKey: string;
  variantId: string;
  label: string;
  value: number;
  display: string;
  higherIsBetter: boolean;
  time: number;
  count: number;
}

/** Bestleistungen je Übung und Konfiguration (nur vollständig gespielte Übungen). */
export function personalBests(sessions: SessionRecord[]): PersonalBest[] {
  const map = new Map<string, PersonalBest>();
  for (const s of sessions) {
    for (const d of s.drills) {
      const p = d.result.primary;
      if (!d.result.completed || p.value === null) continue;
      const k = `${d.drillId}|${d.configKey}`;
      const cur = map.get(k);
      const better = !cur || (p.higherIsBetter ? p.value > cur.value : p.value < cur.value);
      if (better) {
        map.set(k, {
          drillId: d.drillId,
          configKey: d.configKey,
          variantId: d.variantId,
          label: p.label,
          value: p.value,
          display: p.display,
          higherIsBetter: p.higherIsBetter,
          time: d.startedAt,
          count: (cur?.count ?? 0) + 1,
        });
      } else if (cur) cur.count++;
    }
  }
  return [...map.values()];
}

/** Ist das Ergebnis eine neue Bestleistung gegenüber den bisherigen Sessions? */
export function isPersonalBest(previous: SessionRecord[], d: DrillRecord): boolean {
  const p = d.result.primary;
  if (!d.result.completed || p.value === null) return false;
  const prior = drillHistory(previous, d.drillId, d.configKey);
  if (prior.length === 0) return false; // erste Einheit ist noch kein "Rekord"
  const best = p.higherIsBetter ? Math.max(...prior.map((h) => h.value)) : Math.min(...prior.map((h) => h.value));
  return p.higherIsBetter ? p.value > best : p.value < best;
}

/** Vergleich mit der letzten gleichartigen Übung. */
export function previousComparable(previous: SessionRecord[], d: DrillRecord): HistoryPoint | null {
  const prior = drillHistory(previous, d.drillId, d.configKey);
  return prior.length ? prior[prior.length - 1] : null;
}

export type TrendVerdict = 'improved' | 'declined' | 'stable' | 'insufficient';

export interface TrendResult {
  verdict: TrendVerdict;
  before: number | null;
  after: number | null;
  nBefore: number;
  nAfter: number;
  p: number | null;
}

/**
 * Vergleicht zwei Zeiträume bzw. Ergebnisgruppen. "improved"/"declined" nur bei
 * statistisch deutlichem Unterschied (p < 0,05) UND ausreichender Datenbasis.
 */
export function compareRates(before: Rate, after: Rate, minN = 40): TrendResult {
  const base = { before: before.rate, after: after.rate, nBefore: before.attempts, nAfter: after.attempts };
  if (before.attempts < minN || after.attempts < minN) return { ...base, verdict: 'insufficient', p: null };
  const t = twoProportionTest(before.hits, before.attempts, after.hits, after.attempts);
  if (!t) return { ...base, verdict: 'insufficient', p: null };
  if (t.p < 0.05) return { ...base, verdict: t.z > 0 ? 'improved' : 'declined', p: t.p };
  return { ...base, verdict: 'stable', p: t.p };
}

export function compareValues(before: number[], after: number[], higherIsBetter: boolean, minEach = 3): TrendResult {
  const base = { before: mean(before), after: mean(after), nBefore: before.length, nAfter: after.length };
  if (before.length < minEach || after.length < minEach) return { ...base, verdict: 'insufficient', p: null };
  const t = welchTest(before, after);
  if (!t) return { ...base, verdict: 'insufficient', p: null };
  if (t.p < 0.05) {
    const better = higherIsBetter ? t.diff > 0 : t.diff < 0;
    return { ...base, verdict: better ? 'improved' : 'declined', p: t.p };
  }
  return { ...base, verdict: 'stable', p: t.p };
}

/** Konstanz der Aufnahmen: Standardabweichung der Punkte je Aufnahme (Scoring-/X01-Übungen mit Einzeldarts). */
export function visitScoreSpread(sessions: SessionRecord[]): { sd: number | null; visits: number } {
  const scores: number[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      if (!(d.config.engine === 'x01' || isScoringAverageDrill(d))) continue;
      const rounds = new Map<number, number>();
      const count = new Map<number, number>();
      for (const t of d.throws) {
        rounds.set(t.round, (rounds.get(t.round) ?? 0) + t.dart.n * t.dart.m);
        count.set(t.round, (count.get(t.round) ?? 0) + 1);
      }
      for (const [r, v] of rounds) if (count.get(r) === 3) scores.push(v);
    }
  }
  return { sd: stdDev(scores), visits: scores.length };
}


export interface BucketPoint {
  start: number;
  label: string;
  target: Rate;
  darts: number;
  groupMm: number | null;
  groupRounds: number;
  zeroShare: number | null;
  visits: number;
}

/** Werte je Tag oder Woche für einen Zeitraum (für Diagramme). */
export function bucketTrend(sessions: SessionRecord[], bucket: 'day' | 'week', count: number, now = Date.now()): BucketPoint[] {
  if (bucket === 'week') {
    return weeklyTrend(sessions, count, now).map((w) => ({
      start: w.weekStart,
      label: w.label,
      target: w.target,
      darts: w.darts,
      groupMm: w.groupMm,
      groupRounds: w.groupRounds,
      zeroShare: w.zeroVisitShare,
      visits: w.visits,
    }));
  }
  const out: BucketPoint[] = [];
  const today = startOfDay(now);
  for (let i = count - 1; i >= 0; i--) {
    const ds = startOfDay(today - i * DAY_MS + DAY_MS / 2);
    const de = startOfDay(ds + DAY_MS * 1.5);
    const inDay = sessions.filter((s) => s.startedAt >= ds && s.startedAt < de);
    const throws = allThrows(inDay).filter(countsForHitRate);
    const groups = groupSizesFrom(inDay);
    const zero = zeroVisits(inDay);
    const d = new Date(ds);
    out.push({
      start: ds,
      label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`,
      target: rate(throws.filter((t) => t.hit).length, throws.length),
      darts: inDay.reduce((a, s) => a + sessionDarts(s), 0),
      groupMm: mean(groups.map((g) => g.mm)),
      groupRounds: groups.length,
      zeroShare: zero.visits ? zero.zero / zero.visits : null,
      visits: zero.visits,
    });
  }
  return out;
}
