import { targetLabel } from './board';
import { getDrill, getVariant, SKILL_LABEL, type Skill, type TechniqueId } from './drills/catalog';
import { configKey } from './drills/registry';
import type { DrillRecord, Profile, SessionRecord } from './models';
import { mean } from './statistics';
import {
  allThrows,
  biasFrom,
  compareRates,
  compareValues,
  DAY_MS,
  drillHistory,
  groupSizesFrom,
  hasTarget,
  missDirections,
  rate,
  segmentStats,
  sessionDarts,
  startOfDay,
  type Rate,
  type ThrowWithContext,
  type TrendVerdict,
} from './stats';
import { getTechnique } from './technique';

/**
 * Regelbasierter, nachvollziehbarer Coach. Alle Aussagen beruhen auf gespeicherten
 * Daten; jede Aussage nennt ihre Datenbasis. Mechanische Ursachen werden nie
 * behauptet – höchstens als Prüfpunkte angeboten.
 */

export const RECENT_DAYS = 14;
export const MIN_RATE_N = 40;

export interface SkillSnapshot {
  skill: Skill;
  label: string;
  value: number | null;
  display: string;
  n: number;
  nLabel: string;
  trend: TrendVerdict;
  trendText?: string;
  lastTrained: number | null;
  level: 'low' | 'mid' | 'high' | null;
}

export interface Insight {
  id: string;
  kind: 'positive' | 'focus' | 'pattern' | 'info' | 'care';
  title: string;
  text: string;
  evidence?: string;
}

export interface Recommendation {
  focusSkill: Skill;
  focusReason: string;
  technique: TechniqueId;
  techniqueReason: string;
  load: 'normal' | 'light' | 'rest';
  loadReason?: string;
}

export interface CoachAnalysis {
  skills: SkillSnapshot[];
  insights: Insight[];
  totalDarts: number;
}

/** Richtwerte (Coach-Heuristik) – keine offiziellen Normen. */
const BENCH: Record<string, { low: number; high: number; lowerIsBetter?: boolean }> = {
  singles: { low: 30, high: 50 },
  switching: { low: 30, high: 45 },
  doubles: { low: 8, high: 18 },
  trebles: { low: 7, high: 15 },
  checkout: { low: 25, high: 50 },
  routine: { low: 50, high: 80 },
  consistency: { low: 9, high: 5, lowerIsBetter: true },
  scoring: { low: 30, high: 45 },
  game: { low: 25, high: 40 },
};

function levelOf(skill: string, v: number | null): SkillSnapshot['level'] {
  const b = BENCH[skill];
  if (!b || v === null) return null;
  if (b.lowerIsBetter) return v >= b.low ? 'low' : v <= b.high ? 'high' : 'mid';
  return v < b.low ? 'low' : v >= b.high ? 'high' : 'mid';
}

export const pctText = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`);
const cm = (mm: number | null) => (mm === null ? '–' : `${(mm / 10).toFixed(1).replace('.', ',')} cm`);

function throwSkill(t: ThrowWithContext): Skill | null {
  if (!hasTarget(t)) return null;
  if (['grouping', 'focus', 'follow'].includes(drillEngine(t.drillId))) return null;
  const k = t.target.kind;
  if (k === 'double' || k === 'bullseye') return 'doubles';
  if (k === 'triple') return 'trebles';
  if (k === 'number' || k === 'single' || k === 'bull') return 'singles';
  return null;
}

const ENGINE_CACHE = new Map<string, string>();
function drillEngine(drillId: string): string {
  if (!ENGINE_CACHE.has(drillId)) {
    try {
      ENGINE_CACHE.set(drillId, getDrill(drillId).variants[0].make(0).engine);
    } catch {
      ENGINE_CACHE.set(drillId, 'unknown');
    }
  }
  return ENGINE_CACHE.get(drillId)!;
}

/** Teilt Würfe in "vorher" und "zuletzt". Fällt auf eine chronologische Teilung zurück, wenn ältere Daten fehlen. */
function splitWindows<T extends { time: number }>(items: T[], now: number, minN: number): { before: T[]; after: T[] } {
  const cut = now - RECENT_DAYS * DAY_MS;
  const after = items.filter((i) => i.time >= cut);
  const before = items.filter((i) => i.time < cut && i.time >= cut - 6 * 7 * DAY_MS);
  if (before.length >= minN && after.length >= minN) return { before, after };
  const recent = items.filter((i) => i.time >= now - 42 * DAY_MS).sort((a, b) => a.time - b.time);
  const half = Math.floor(recent.length / 2);
  return { before: recent.slice(0, half), after: recent.slice(half) };
}

function rateOf<T extends { hit: boolean | null }>(list: T[]): Rate {
  return rate(list.filter((t) => t.hit).length, list.length);
}

function rateSnapshot(skill: Skill, list: ThrowWithContext[], now: number): SkillSnapshot {
  const lastTrained = list.length ? Math.max(...list.map((t) => t.time)) : null;
  const { before, after } = splitWindows(list, now, MIN_RATE_N);
  const recentWindow = list.filter((t) => t.time >= now - RECENT_DAYS * DAY_MS);
  const basis = recentWindow.length >= 20 ? recentWindow : list;
  const r = rateOf(basis);
  const trend = compareRates(rateOf(before), rateOf(after), MIN_RATE_N);
  return {
    skill,
    label: SKILL_LABEL[skill],
    value: r.rate === null ? null : r.rate * 100,
    display: pctText(r.rate),
    n: r.attempts,
    nLabel: `${r.attempts} Darts`,
    trend: trend.verdict,
    trendText: trend.verdict !== 'insufficient' ? `${pctText(trend.before)} → ${pctText(trend.after)}` : undefined,
    lastTrained,
    level: levelOf(skill, r.rate === null ? null : r.rate * 100),
  };
}

export function skillSnapshots(sessions: SessionRecord[], now = Date.now()): SkillSnapshot[] {
  const throws = allThrows(sessions);
  const bySkill = new Map<Skill, ThrowWithContext[]>();
  for (const t of throws) {
    const s = throwSkill(t);
    if (!s) continue;
    bySkill.set(s, [...(bySkill.get(s) ?? []), t]);
  }
  // Zielwechsel: Übungen, bei denen das Ziel nach jedem Dart wechselt
  const switching: ThrowWithContext[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      if ((d.config.engine === 'target' && d.config.rotation === 'dart' && d.config.targets.length > 1) || d.config.engine === 'atc') {
        for (const t of d.throws) if (hasTarget(t)) switching.push({ ...t, sessionId: s.id, drillId: d.drillId, time: t.at ?? d.startedAt });
      }
    }
  }
  const out: SkillSnapshot[] = [];
  for (const skill of ['singles', 'doubles', 'trebles'] as Skill[]) {
    const list = bySkill.get(skill) ?? [];
    if (list.length) out.push(rateSnapshot(skill, list, now));
  }
  if (switching.length) out.push(rateSnapshot('switching', switching, now));

  // Konstanz: gemessene Gruppengrößen
  const groups = groupSizesFrom(sessions).map((g) => ({ ...g }));
  if (groups.length) {
    const { before, after } = splitWindows(groups, now, 5);
    const recent = groups.filter((g) => g.time >= now - RECENT_DAYS * DAY_MS);
    const basis = recent.length >= 3 ? recent : groups;
    const v = mean(basis.map((g) => g.mm));
    const trend = compareValues(before.map((g) => g.mm), after.map((g) => g.mm), false, 5);
    out.push({
      skill: 'consistency',
      label: SKILL_LABEL.consistency,
      value: v === null ? null : v / 10,
      display: cm(v),
      n: basis.length,
      nLabel: `${basis.length} Gruppen`,
      trend: trend.verdict,
      trendText: trend.verdict !== 'insufficient' ? `${cm(trend.before)} → ${cm(trend.after)}` : undefined,
      lastTrained: Math.max(...groups.map((g) => g.time)),
      level: levelOf('consistency', v === null ? null : v / 10),
    });
  }

  // Checkout: erfolgreiche Versuche in Checkout-Übungen
  const co: { time: number; hit: boolean }[] = [];
  const routine: { time: number; value: number }[] = [];
  for (const s of sessions) {
    for (const d of s.drills) {
      if (d.config.engine === 'checkout') {
        const succ = d.result.metrics.successes ?? 0;
        const att = d.result.metrics.attempts ?? 0;
        for (let i = 0; i < att; i++) co.push({ time: d.startedAt, hit: i < succ });
      }
      if (d.config.engine === 'focus') {
        for (const e of d.events) if (e.t === 'rate') routine.push({ time: e.at ?? d.startedAt, value: e.value });
      }
    }
  }
  if (co.length) {
    const { before, after } = splitWindows(co, now, 20);
    const r = rateOf(co.filter((c) => c.time >= now - 30 * DAY_MS).length >= 10 ? co.filter((c) => c.time >= now - 30 * DAY_MS) : co);
    const trend = compareRates(rateOf(before), rateOf(after), 20);
    out.push({
      skill: 'checkout',
      label: SKILL_LABEL.checkout,
      value: r.rate === null ? null : r.rate * 100,
      display: pctText(r.rate),
      n: r.attempts,
      nLabel: `${r.attempts} Versuche`,
      trend: trend.verdict,
      trendText: trend.verdict !== 'insufficient' ? `${pctText(trend.before)} → ${pctText(trend.after)}` : undefined,
      lastTrained: Math.max(...co.map((c) => c.time)),
      level: levelOf('checkout', r.rate === null ? null : r.rate * 100),
    });
  }
  if (routine.length) {
    const recent = routine.filter((r) => r.time >= now - RECENT_DAYS * DAY_MS);
    const basis = recent.length >= 5 ? recent : routine;
    const v = mean(basis.map((r) => (r.value === 2 ? 100 : r.value === 1 ? 50 : 0)));
    out.push({
      skill: 'routine',
      label: SKILL_LABEL.routine,
      value: v,
      display: v === null ? '–' : `${Math.round(v)} %`,
      n: basis.length,
      nLabel: `${basis.length} Runden`,
      trend: 'insufficient',
      lastTrained: Math.max(...routine.map((r) => r.time)),
      level: levelOf('routine', v),
    });
  }
  return out;
}

function daysTrained(sessions: SessionRecord[], days: number, now: number): number {
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  return new Set(sessions.filter((s) => s.startedAt >= from).map((s) => startOfDay(s.startedAt))).size;
}

/** Erkenntnisse für Dashboard und Statistik. */
export function insights(sessions: SessionRecord[], now = Date.now()): CoachAnalysis {
  const skills = skillSnapshots(sessions, now);
  const totalDarts = sessions.reduce((a, s) => a + sessionDarts(s), 0);
  const out: Insight[] = [];

  if (sessions.length === 0) {
    out.push({
      id: 'welcome',
      kind: 'info',
      title: 'Lass uns deinen Startpunkt finden',
      text: 'Der Eingangstest (ca. 20 Minuten) misst Gruppierung, große Singles, Zielwechsel, Doppel und Scoring. So kann der Coach dein Training gezielt anpassen und später echte Fortschritte zeigen.',
    });
    return { skills, insights: out, totalDarts };
  }

  for (const s of skills) {
    if (s.trend === 'improved') {
      out.push({
        id: `up-${s.skill}`,
        kind: 'positive',
        title: `${s.label}: echte Verbesserung`,
        text: `${s.label} hat sich deutlich verbessert (${s.trendText}). Der Unterschied ist groß genug, dass es kein Zufall einer einzelnen guten Einheit ist.`,
        evidence: `Vergleich früherer und neuerer Daten, zuletzt ${s.nLabel}`,
      });
    } else if (s.trend === 'declined') {
      out.push({
        id: `down-${s.skill}`,
        kind: 'focus',
        title: `${s.label}: zuletzt schwächer`,
        text: `Bei ${s.label} lagen die neueren Werte niedriger (${s.trendText}). Das passiert oft, wenn man gerade etwas an der Technik verändert – kein Grund zur Sorge, aber ein Grund, hier dranzubleiben.`,
        evidence: `zuletzt ${s.nLabel}`,
      });
    }
  }

  // Schwächstes Zielsegment
  const segs = segmentStats(sessions.filter((s) => s.startedAt >= now - 60 * DAY_MS)).filter((s) => s.attempts >= 15 && s.target.kind === 'number' && s.target.n !== 25);
  if (segs.length >= 2) {
    const pooled = rate(segs.reduce((a, s) => a + s.hits, 0), segs.reduce((a, s) => a + s.attempts, 0));
    const worst = [...segs].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0];
    const others = rate(pooled.hits - worst.hits, pooled.attempts - worst.attempts);
    if (worst.high !== null && others.rate !== null && worst.high < others.rate) {
      out.push({
        id: `weak-${worst.key}`,
        kind: 'focus',
        title: `Die ${worst.label} bereitet dir am meisten Probleme`,
        text: `Auf die ${worst.label} triffst du ${pctText(worst.rate)}, auf deine anderen Zahlen ${pctText(others.rate)}. Gezieltes Training auf diese Zahl lohnt sich.`,
        evidence: `${worst.attempts} Darts auf die ${worst.label}, ${others.attempts} auf andere Zahlen (letzte 60 Tage)`,
      });
    }
  }

  // Richtung der Fehlwürfe (links/rechts) – funktioniert auch ohne Positionsdaten
  for (const m of missDirections(sessions.filter((s) => s.startedAt >= now - 60 * DAY_MS))) {
    const side = m.left + m.right;
    if (side < 15 || m.p >= 0.05) continue;
    const toLeft = m.left > m.right;
    out.push({
      id: `dir-${m.n}`,
      kind: 'pattern',
      title: `Fehlwürfe bei der ${m.n} gehen eher nach ${toLeft ? 'links' : 'rechts'}`,
      text: `Wenn du die ${m.n} verfehlst, landest du ${toLeft ? m.left : m.right}× in der ${toLeft ? m.leftN : m.rightN}, aber nur ${toLeft ? m.right : m.left}× in der ${toLeft ? m.rightN : m.leftN}. Das ist ein Muster in deinen Treffern – keine Diagnose der Ursache. Ein Blick auf Stand und Ausrichtung im Technik-Coach (oder ein Video von hinten) kann helfen, es einzuordnen.`,
      evidence: `${side} Fehlwürfe in Nachbarfelder der ${m.n}`,
    });
  }

  // Systematische Abweichung aus Positionsdaten
  const bias = biasFrom(sessions.filter((s) => s.startedAt >= now - 60 * DAY_MS));
  if (bias && (bias.significantX || bias.significantY)) {
    const parts: string[] = [];
    if (bias.significantY) parts.push(`${cm(Math.abs(bias.dy))} ${bias.dy < 0 ? 'unterhalb' : 'oberhalb'}`);
    if (bias.significantX) parts.push(`${cm(Math.abs(bias.dx))} ${bias.dx < 0 ? 'links' : 'rechts'}`);
    out.push({
      id: 'bias',
      kind: 'pattern',
      title: 'Deine Darts liegen systematisch neben dem Zielpunkt',
      text: `Im Mittel landen deine Darts ${parts.join(' und ')} des Zielpunkts. Gemessen an deinen angetippten Positionen. Mögliche Prüfpunkte (keine Diagnose): Follow-through, gleichmäßiger Abwurf, Ausrichtung des Stands – teste immer nur einen davon.`,
      evidence: `${bias.n} Darts mit Positionsangabe auf Felder mit eindeutigem Zielpunkt`,
    });
  }

  // Streuung
  const cons = skills.find((s) => s.skill === 'consistency');
  if (cons && cons.n >= 5 && cons.level === 'low') {
    out.push({
      id: 'spread',
      kind: 'focus',
      title: 'Deine Würfe streuen noch stark',
      text: `Deine Gruppen sind im Schnitt ${cons.display} groß. Bevor du an Zielen und Zahlen arbeitest, lohnt sich ein konstanter Ablauf: stabiler Stand, gleicher Griff, sauberer Wurfabschluss.`,
      evidence: cons.nLabel,
    });
  }

  // Stagnation je Übung
  const stag = stagnatingDrills(sessions);
  for (const s of stag.slice(0, 1)) {
    out.push({
      id: `stag-${s.drillId}`,
      kind: 'info',
      title: `${s.name}: seit ${s.count} Einheiten auf ähnlichem Niveau`,
      text: `Deine Ergebnisse liegen konstant um ${s.typical}. Plateaus sind normal. Abwechslung hilft oft mehr als Wiederholung: Probiere ${s.suggestion}.`,
      evidence: `letzte ${s.count} vollständige Durchgänge`,
    });
  }

  // Routine
  const rt = skills.find((s) => s.skill === 'routine');
  if (rt && rt.n >= 10 && rt.level === 'low') {
    out.push({
      id: 'routine',
      kind: 'focus',
      title: 'Die Routine sitzt noch nicht',
      text: `Du hast deinen Technikschwerpunkt in ${rt.display} der Runden sauber umgesetzt (Selbsteinschätzung). Der Routine-Player im Technik-Coach hilft, den Ablauf zu automatisieren.`,
      evidence: rt.nLabel,
    });
  }

  // Belastung
  const d7 = daysTrained(sessions, 7, now);
  if (d7 >= 6) {
    out.push({
      id: 'load',
      kind: 'care',
      title: 'Denk an Pausen',
      text: `Du hast an ${d7} der letzten 7 Tage trainiert – stark! Motorisches Lernen braucht aber auch Pausen. Ein freier Tag oder eine kurze Technik-Einheit ist heute völlig in Ordnung.`,
    });
  }

  if (totalDarts < 300) {
    out.push({
      id: 'thin',
      kind: 'info',
      title: 'Aussagen sind noch vorläufig',
      text: `Bisher ${totalDarts} Darts erfasst. Ab etwa 300 Darts werden Trends belastbar. Der Coach nennt Verbesserungen erst, wenn sie statistisch klar erkennbar sind.`,
    });
  }

  return { skills, insights: out, totalDarts };
}

interface Stagnation {
  drillId: string;
  name: string;
  count: number;
  typical: string;
  suggestion: string;
}

/** Übungen mit ≥ 6 vollständigen Durchgängen, deren letzte 3 sich nicht von den 3 davor unterscheiden. */
export function stagnatingDrills(sessions: SessionRecord[]): Stagnation[] {
  const byKey = new Map<string, DrillRecord[]>();
  for (const s of sessions) for (const d of s.drills) byKey.set(`${d.drillId}|${d.configKey}`, [...(byKey.get(`${d.drillId}|${d.configKey}`) ?? []), d]);
  const out: Stagnation[] = [];
  for (const [key, list] of byKey) {
    const [drillId, ck] = key.split('|');
    const hist = drillHistory(sessions, drillId, ck);
    if (hist.length < 6) continue;
    const last = hist.slice(-3).map((h) => h.value);
    const prev = hist.slice(-6, -3).map((h) => h.value);
    const higher = list[0].result.primary.higherIsBetter;
    const cmp = compareValues(prev, last, higher, 3);
    const m = mean(last)!;
    const improving = higher ? m > mean(prev)! * 1.05 : m < mean(prev)! * 0.95;
    if (cmp.verdict === 'stable' && !improving) {
      let name = drillId;
      let suggestion = 'eine andere Übung für dieselbe Fähigkeit';
      try {
        const def = getDrill(drillId);
        name = def.name;
        const next = progressionAfter(drillId);
        if (next) suggestion = `"${getDrill(next.drillId).name}" (${getVariant(getDrill(next.drillId), next.variantId).label})`;
      } catch {
        /* unbekannte Übung */
      }
      out.push({ drillId, name, count: hist.length, typical: list[list.length - 1].result.primary.display, suggestion });
    }
  }
  return out;
}

// ---------------- Progression & Folgeübung ----------------

interface ChainStep {
  drillId: string;
  variantId: string;
  /** Ab diesem Wert der Hauptkennzahl (gepoolt über bis zu 3 Durchgänge) geht es weiter. */
  advanceAt: number;
  /** Unter diesem Wert wird eine leichtere Stufe empfohlen. */
  dropBelow: number;
}

const CHAINS: ChainStep[][] = [
  [
    { drillId: 'grouping', variantId: 'bull-measure', advanceAt: 6, dropBelow: 12 },
    { drillId: 'follow-leader', variantId: 'standard', advanceAt: 45, dropBelow: 15 },
    { drillId: 'grouping-conditions', variantId: 'measure', advanceAt: 6, dropBelow: 12 },
  ],
  [
    { drillId: 'big-singles', variantId: 'easy', advanceAt: 50, dropBelow: 15 },
    { drillId: 'big-singles', variantId: 'number', advanceAt: 50, dropBelow: 25 },
    { drillId: 'target-switch', variantId: 'visit', advanceAt: 45, dropBelow: 25 },
    { drillId: 'target-switch', variantId: 'top', advanceAt: 45, dropBelow: 25 },
    { drillId: 'big-singles', variantId: 'single', advanceAt: 45, dropBelow: 20 },
    { drillId: 'target-switch', variantId: 'cross', advanceAt: 45, dropBelow: 25 },
  ],
  [
    { drillId: 'atc', variantId: 'short', advanceAt: 17, dropBelow: 6 },
    { drillId: 'atc', variantId: 'number', advanceAt: 45, dropBelow: 90 },
    { drillId: 'atc', variantId: 'single', advanceAt: 55, dropBelow: 110 },
    { drillId: 'doubles-atc', variantId: 'limit45', advanceAt: 6, dropBelow: 1 },
  ],
  [
    { drillId: 'twenty-training', variantId: 'short', advanceAt: 360, dropBelow: 120 },
    { drillId: 'twenty-training', variantId: 'standard', advanceAt: 600, dropBelow: 200 },
    { drillId: 't20', variantId: 'short', advanceAt: 15, dropBelow: 3 },
    { drillId: 't20', variantId: 'standard', advanceAt: 18, dropBelow: 5 },
  ],
  [
    { drillId: 'checkout-doubles', variantId: 'easy', advanceAt: 50, dropBelow: 10 },
    { drillId: 'checkout-doubles', variantId: 'standard', advanceAt: 40, dropBelow: 10 },
    { drillId: 'checkout-under40', variantId: 'standard', advanceAt: 40, dropBelow: 10 },
    { drillId: 'checkout-easy', variantId: 'easy', advanceAt: 40, dropBelow: 10 },
    { drillId: 'checkout-easy', variantId: 'standard', advanceAt: 35, dropBelow: 10 },
    { drillId: 'checkout-challenge', variantId: 'six', advanceAt: 35, dropBelow: 5 },
    { drillId: 'checkout-121', variantId: 'standard', advanceAt: 999, dropBelow: 0 },
  ],
  [
    { drillId: 'd20', variantId: 'short', advanceAt: 15, dropBelow: 0 },
    { drillId: 'd16', variantId: 'standard', advanceAt: 15, dropBelow: 3 },
    { drillId: 'double-ladder', variantId: 'easy', advanceAt: 6, dropBelow: 1 },
    { drillId: 'bobs27', variantId: 'easy', advanceAt: 0, dropBelow: -800 },
    { drillId: 'bobs27', variantId: 'classic', advanceAt: 9999, dropBelow: 0 },
  ],
  [
    { drillId: 'x01', variantId: '301-single', advanceAt: 25, dropBelow: 0 },
    { drillId: 'x01', variantId: '301', advanceAt: 30, dropBelow: 12 },
    { drillId: 'x01', variantId: '501', advanceAt: 999, dropBelow: 15 },
  ],
];

function findStep(drillId: string, variantId: string): { chain: ChainStep[]; idx: number } | null {
  for (const chain of CHAINS) {
    const idx = chain.findIndex((s) => s.drillId === drillId && s.variantId === variantId);
    if (idx >= 0) return { chain, idx };
  }
  return null;
}

export function progressionAfter(drillId: string, variantId?: string): { drillId: string; variantId: string } | null {
  for (const chain of CHAINS) {
    const idx = chain.findIndex((s) => s.drillId === drillId && (!variantId || s.variantId === variantId));
    if (idx >= 0 && idx < chain.length - 1) return { drillId: chain[idx + 1].drillId, variantId: chain[idx + 1].variantId };
  }
  return null;
}

export interface NextDrill {
  drillId: string;
  variantId: string;
  reason: string;
}

/**
 * Empfehlung für die Folgeübung nach einem Durchgang. Entscheidet über bis zu drei
 * Durchgänge gleicher Konfiguration – eine einzelne gute Einheit reicht nicht zum Aufstieg.
 */
export function nextDrillAfter(sessions: SessionRecord[], d: DrillRecord): NextDrill {
  const def = getDrill(d.drillId);
  const variant = getVariant(def, d.variantId);
  const hist = drillHistory(sessions, d.drillId, d.configKey);
  const recent = hist.slice(-3).map((h) => h.value);
  const pooled = mean(recent);
  const step = findStep(d.drillId, d.variantId);
  const primary = d.result.primary;
  const fmtVal = (v: number) => (primary.unit === '%' ? `${Math.round(v)} %` : primary.unit === 'cm' ? `${v.toFixed(1).replace('.', ',')} cm` : `${Math.round(v)}`);

  if (!step || pooled === null) {
    return { drillId: d.drillId, variantId: d.variantId, reason: `Wiederhole „${def.name}“ beim nächsten Mal – so entsteht eine Vergleichsbasis für deinen Fortschritt.` };
  }
  const cur = step.chain[step.idx];
  const lowerBetter = !primary.higherIsBetter;
  const good = lowerBetter ? pooled <= cur.advanceAt : pooled >= cur.advanceAt;
  const poor = lowerBetter ? pooled >= cur.dropBelow : pooled < cur.dropBelow;

  if (recent.length < 2) {
    return {
      drillId: d.drillId,
      variantId: d.variantId,
      reason: `Erster Durchgang: ${primary.display}. Wiederhole die Übung noch mindestens einmal, bevor wir die Schwierigkeit ändern – ein einzelnes Ergebnis kann täuschen.`,
    };
  }
  if (good && step.idx < step.chain.length - 1) {
    const next = step.chain[step.idx + 1];
    const nd = getDrill(next.drillId);
    return {
      drillId: next.drillId,
      variantId: next.variantId,
      reason: `In den letzten ${recent.length} Durchgängen lagst du im Schnitt bei ${fmtVal(pooled)} (Schwelle: ${fmtVal(cur.advanceAt)}). Nächster Schritt: „${nd.name}“ (${getVariant(nd, next.variantId).label}).`,
    };
  }
  if (poor && step.idx > 0) {
    const prev = step.chain[step.idx - 1];
    const pd = getDrill(prev.drillId);
    return {
      drillId: prev.drillId,
      variantId: prev.variantId,
      reason: `Im Schnitt ${fmtVal(pooled)} über ${recent.length} Durchgänge – noch zu früh für diese Stufe. Festige zuerst „${pd.name}“ (${getVariant(pd, prev.variantId).label}).`,
    };
  }
  return {
    drillId: d.drillId,
    variantId: d.variantId,
    reason: `Bleib bei „${def.name}“ (${variant.label}): Im Schnitt ${fmtVal(pooled)} über ${recent.length} Durchgänge${cur.advanceAt < 900 ? `, Ziel für den nächsten Schritt: ${fmtVal(cur.advanceAt)}` : ''}.`,
  };
}

// ---------------- Empfehlung für heute ----------------

export function recommend(
  profile: Profile,
  sessions: SessionRecord[],
  stageSkills: Skill[],
  stageTechniques: TechniqueId[],
  now = Date.now(),
): Recommendation {
  const skills = skillSnapshots(sessions, now);
  const byId = new Map(skills.map((s) => [s.skill, s]));
  let best: { skill: Skill; score: number; reason: string } | null = null;
  for (let i = 0; i < stageSkills.length; i++) {
    const skill = stageSkills[i];
    const s = byId.get(skill);
    let score = (stageSkills.length - i) * 0.4;
    let reason = `Dieser Abschnitt deines Plans legt den Schwerpunkt auf ${SKILL_LABEL[skill]}.`;
    if (!s || s.n < 20) {
      score += 1;
      reason = `Für ${SKILL_LABEL[skill]} gibt es noch kaum Daten – heute sammeln wir die ersten Werte.`;
    } else {
      if (s.level === 'low') {
        score += 3;
        reason = `${SKILL_LABEL[skill]} ist aktuell deine größte Baustelle (${s.display} bei ${s.nLabel}).`;
      }
      if (s.trend === 'declined') {
        score += 2;
        reason = `${SKILL_LABEL[skill]} war zuletzt schwächer (${s.trendText}) – hier bleiben wir dran.`;
      }
      if (s.level === 'high') {
        score -= 2;
      }
      if (s.lastTrained !== null && now - s.lastTrained > 7 * DAY_MS) {
        score += 1;
        if (s.level !== 'low') reason = `${SKILL_LABEL[skill]} hast du seit über einer Woche nicht trainiert.`;
      }
      if (s.trend === 'improved' && s.level !== 'low') {
        score -= 0.5;
      }
    }
    if (!best || score > best.score) best = { skill, score, reason };
  }
  const chosen = best ?? { skill: stageSkills[0] ?? 'singles', score: 0, reason: '' };

  // Technik-Schwerpunkt: genau einer pro Einheit
  const lastFocus = [...sessions].sort((a, b) => b.startedAt - a.startedAt).find((s) => s.techniqueFocus)?.techniqueFocus;
  const routine = byId.get('routine');
  const cons = byId.get('consistency');
  let technique: TechniqueId;
  let techniqueReason: string;
  if (routine && routine.n >= 10 && routine.level === 'low' && lastFocus !== 'rhythm') {
    technique = 'rhythm';
    techniqueReason = `Deine Routine-Treue lag zuletzt bei ${routine.display} (${routine.nLabel}). Heute festigen wir den Ablauf vor jedem Dart.`;
  } else {
    const open = stageTechniques.filter((t) => profile.techniqueStatus[t] !== 'solid');
    const pool = open.length ? open : stageTechniques;
    technique = pool.find((t) => t !== lastFocus) ?? pool[0] ?? 'stance';
    const topic = getTechnique(technique);
    techniqueReason =
      open.length === 0
        ? `Alle Themen dieses Abschnitts sind als „sitzt“ markiert – heute eine Wiederholung: ${topic.title}.`
        : cons && cons.level === 'low' && (technique === 'stance' || technique === 'followThrough')
          ? `Deine Gruppen sind noch groß (${cons.display}). ${topic.title} ist ein guter Hebel für mehr Konstanz.`
          : `Heute nur ein Technikthema: ${topic.title}. ${topic.short}`;
  }

  // Belastungssteuerung
  const d7 = daysTrained(sessions, 7, now);
  const today = sessions.filter((s) => s.startedAt >= startOfDay(now)).reduce((a, s) => a + s.activeMs, 0);
  const last = sessions.length ? Math.max(...sessions.map((s) => s.endedAt)) : null;
  let load: Recommendation['load'] = 'normal';
  let loadReason: string | undefined;
  if (today >= 60 * 60 * 1000) {
    load = 'rest';
    loadReason = 'Du hast heute schon über eine Stunde trainiert. Mehr bringt jetzt wenig – Pause machen und morgen frisch weiter.';
  } else if (d7 >= 6) {
    load = 'light';
    loadReason = `Du hast an ${d7} der letzten 7 Tage trainiert. Heute lieber eine kurze, lockere Einheit.`;
  } else if (last !== null && now - last > 10 * DAY_MS) {
    load = 'light';
    loadReason = 'Willkommen zurück! Nach einer längeren Pause starten wir etwas ruhiger.';
  }

  return { focusSkill: chosen.skill, focusReason: chosen.reason, technique, techniqueReason, load, loadReason };
}

/** Kurztext für die Coach-Nachricht auf dem Dashboard. */
export function coachHeadline(rec: Recommendation, analysis: CoachAnalysis): string {
  const positive = analysis.insights.find((i) => i.kind === 'positive');
  const lead = positive ? `${positive.title}. ` : '';
  return `${lead}${rec.focusReason}`;
}

export function describeTarget(drill: DrillRecord): string {
  const c = drill.config;
  if (c.engine === 'target') return c.targets.map(targetLabel).join(' · ');
  return getDrill(drill.drillId).name;
}

export function drillConfigKey(drillId: string, variantId: string): string {
  return configKey(getVariant(getDrill(drillId), variantId).make(0));
}
