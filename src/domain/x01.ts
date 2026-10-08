import { dartScore, isDouble } from './board';
import { isFinishable, isOneDartDoubleFinish, type OutMode } from './checkout';
import type { Dart } from './types';

/**
 * X01-Spiel (z. B. 301 / 501) mit korrekten Regeln:
 *  - Bust bei Überwerfen, bei Rest 1 (Double-/Master-Out) und bei Rest 0 ohne gültigen Finish-Dart
 *  - Bei Bust wird der Punktestand auf den Stand zu Beginn der Aufnahme zurückgesetzt
 *  - Optional Double-In
 *  - Mehrere Legs (First to N), wechselnder Anwurf
 *
 * Der Spielzustand wird immer vollständig aus der Liste der Ereignisse berechnet
 * ("Event Sourcing"). Undo = letztes Ereignis entfernen und neu berechnen.
 */

export type InMode = 'straight' | 'double';

export interface X01PlayerSpec {
  name: string;
  /** Virtueller Gegner mit Stärke 1–10. */
  bot?: { level: number };
}

export interface X01Config {
  start: number;
  out: OutMode;
  in: InMode;
  legsToWin: number;
  players: X01PlayerSpec[];
}

export type X01Event =
  | { t: 'dart'; p: number; dart: Dart }
  | {
      t: 'visit';
      p: number;
      score: number;
      /** Benötigte Darts beim Checkout (1–3). */
      darts?: number;
      /** Darts auf ein Doppel in dieser Aufnahme (für die Doppelquote). */
      doubleDarts?: number;
    };

export interface X01Visit {
  leg: number;
  player: number;
  /** Einzelne Darts, falls Dart-für-Dart erfasst; `null` bei Gesamteingabe. */
  darts: Dart[] | null;
  startRemaining: number;
  score: number;
  dartsUsed: number;
  dartsAtDouble: number;
  bust: boolean;
  checkout: boolean;
}

export interface X01PlayerState {
  remaining: number;
  isIn: boolean;
  legsWon: number;
  dartsThrown: number;
  pointsScored: number;
  dartsAtDouble: number;
  checkouts: number;
  highestFinish: number;
  dartsInLeg: number;
}

export interface X01LegResult {
  winner: number;
  /** Darts des Gewinners in diesem Leg. */
  darts: number;
  checkout: number;
}

export type X01Feedback =
  | { kind: 'bust'; player: number }
  | { kind: 'checkout'; player: number; score: number }
  | { kind: 'visit'; player: number; score: number }
  | null;

export interface X01State {
  config: X01Config;
  players: X01PlayerState[];
  leg: number;
  legStarter: number;
  current: number;
  visitDarts: Dart[];
  visitStart: number;
  visitDoubleDarts: number;
  visits: X01Visit[];
  legs: X01LegResult[];
  finished: boolean;
  winner: number | null;
  lastFeedback: X01Feedback;
}

export class RuleError extends Error {}

/** Aufnahme-Summen, die mit drei Darts nicht erreichbar sind. */
export const IMPOSSIBLE_VISIT_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

export function createX01(config: X01Config): X01State {
  if (config.players.length < 1) throw new RuleError('Mindestens ein Spieler erforderlich');
  if (config.start < 2) throw new RuleError('Ungültige Startpunktzahl');
  return {
    config,
    players: config.players.map(() => newPlayer(config)),
    leg: 0,
    legStarter: 0,
    current: 0,
    visitDarts: [],
    visitStart: config.start,
    visitDoubleDarts: 0,
    visits: [],
    legs: [],
    finished: false,
    winner: null,
    lastFeedback: null,
  };
}

function newPlayer(config: X01Config): X01PlayerState {
  return {
    remaining: config.start,
    isIn: config.in === 'straight',
    legsWon: 0,
    dartsThrown: 0,
    pointsScored: 0,
    dartsAtDouble: 0,
    checkouts: 0,
    highestFinish: 0,
    dartsInLeg: 0,
  };
}

function clone(s: X01State): X01State {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    visitDarts: [...s.visitDarts],
    visits: [...s.visits],
    legs: [...s.legs],
  };
}

function isBust(newRem: number, out: OutMode, finisher: Dart | null): boolean {
  if (newRem < 0) return true;
  if (out !== 'single' && newRem === 1) return true;
  if (newRem === 0 && finisher) {
    if (out === 'double') return !isDouble(finisher);
    if (out === 'master') return !(finisher.m === 2 || finisher.m === 3);
  }
  return false;
}

function nextPlayer(s: X01State): void {
  s.current = (s.current + 1) % s.players.length;
  s.visitDarts = [];
  s.visitDoubleDarts = 0;
  s.visitStart = s.players[s.current].remaining;
}

function finishLeg(s: X01State, winner: number, checkoutScore: number): void {
  const w = s.players[winner];
  w.legsWon += 1;
  w.checkouts += 1;
  w.highestFinish = Math.max(w.highestFinish, checkoutScore);
  s.legs.push({ winner, darts: w.dartsInLeg, checkout: checkoutScore });
  if (w.legsWon >= s.config.legsToWin) {
    s.finished = true;
    s.winner = winner;
    s.visitDarts = [];
    return;
  }
  s.leg += 1;
  s.legStarter = (s.legStarter + 1) % s.players.length;
  for (const p of s.players) {
    p.remaining = s.config.start;
    p.isIn = s.config.in === 'straight';
    p.dartsInLeg = 0;
  }
  s.current = s.legStarter;
  s.visitDarts = [];
  s.visitDoubleDarts = 0;
  s.visitStart = s.config.start;
}

/** Wendet einen einzelnen Dart an. */
export function applyDart(state: X01State, dart: Dart): X01State {
  if (state.finished) throw new RuleError('Das Spiel ist bereits beendet');
  const s = clone(state);
  const pi = s.current;
  const p = s.players[pi];
  const out = s.config.out;

  p.dartsThrown += 1;
  p.dartsInLeg += 1;
  if (out === 'double' && p.isIn && isOneDartDoubleFinish(p.remaining)) {
    p.dartsAtDouble += 1;
    s.visitDoubleDarts += 1;
  }

  let value = dartScore(dart);
  if (!p.isIn) {
    if (isDouble(dart)) p.isIn = true;
    else value = 0;
  }

  const newRem = p.remaining - value;
  const darts = [...s.visitDarts, dart];

  if (isBust(newRem, out, dart)) {
    p.pointsScored -= s.visitStart - p.remaining; // bereits gezählte Punkte der Aufnahme verfallen
    p.remaining = s.visitStart;
    s.visits.push(visitRecord(s, pi, darts, 0, true, false));
    s.lastFeedback = { kind: 'bust', player: pi };
    nextPlayer(s);
    return s;
  }

  p.pointsScored += value;
  p.remaining = newRem;

  if (newRem === 0) {
    s.visits.push(visitRecord(s, pi, darts, s.visitStart, false, true));
    s.lastFeedback = { kind: 'checkout', player: pi, score: s.visitStart };
    finishLeg(s, pi, s.visitStart);
    return s;
  }

  if (darts.length === 3) {
    s.visits.push(visitRecord(s, pi, darts, s.visitStart - newRem, false, false));
    s.lastFeedback = { kind: 'visit', player: pi, score: s.visitStart - newRem };
    nextPlayer(s);
    return s;
  }

  s.visitDarts = darts;
  s.lastFeedback = null;
  return s;
}

function visitRecord(
  s: X01State,
  player: number,
  darts: Dart[] | null,
  score: number,
  bust: boolean,
  checkout: boolean,
  dartsUsed?: number,
  dartsAtDouble?: number,
): X01Visit {
  return {
    leg: s.leg,
    player,
    darts,
    startRemaining: s.visitStart,
    score,
    dartsUsed: dartsUsed ?? darts?.length ?? 3,
    dartsAtDouble: dartsAtDouble ?? s.visitDoubleDarts,
    bust,
    checkout,
  };
}

/**
 * Wendet eine komplette Aufnahme (Gesamtpunktzahl) an.
 * Nur zu Beginn einer Aufnahme möglich.
 */
export function applyVisit(
  state: X01State,
  score: number,
  opts: { darts?: number; doubleDarts?: number } = {},
): X01State {
  if (state.finished) throw new RuleError('Das Spiel ist bereits beendet');
  if (state.visitDarts.length > 0) throw new RuleError('Aufnahme läuft bereits – bitte Darts einzeln eingeben');
  if (!Number.isInteger(score) || score < 0 || score > 180) throw new RuleError('Punktzahl muss zwischen 0 und 180 liegen');
  if (IMPOSSIBLE_VISIT_SCORES.has(score)) throw new RuleError(`${score} ist mit drei Darts nicht möglich`);

  const s = clone(state);
  const pi = s.current;
  const p = s.players[pi];
  const out = s.config.out;
  const rem = p.remaining;
  const newRem = rem - score;
  const doubleDarts = Math.max(0, Math.min(3, opts.doubleDarts ?? 0));
  const doubleDartsCounted = out === 'double' && rem <= 50 ? doubleDarts : 0;

  if (!p.isIn && score > 0) p.isIn = true;

  if (newRem < 0 || (out !== 'single' && newRem === 1)) {
    p.dartsThrown += 3;
    p.dartsInLeg += 3;
    p.dartsAtDouble += doubleDartsCounted;
    s.visits.push(visitRecord(s, pi, null, 0, true, false, 3, doubleDartsCounted));
    s.lastFeedback = { kind: 'bust', player: pi };
    nextPlayer(s);
    return s;
  }

  if (newRem === 0) {
    const used = opts.darts ?? 3;
    if (used < 1 || used > 3) throw new RuleError('Anzahl Darts muss 1–3 sein');
    if (!isFinishable(rem, used, out)) {
      throw new RuleError(`${rem} kann mit ${used} Dart${used > 1 ? 's' : ''} nicht gecheckt werden`);
    }
    const atDouble = out === 'double' ? Math.max(1, doubleDartsCounted) : 0;
    p.dartsThrown += used;
    p.dartsInLeg += used;
    p.dartsAtDouble += atDouble;
    p.pointsScored += score;
    p.remaining = 0;
    s.visits.push(visitRecord(s, pi, null, score, false, true, used, atDouble));
    s.lastFeedback = { kind: 'checkout', player: pi, score };
    finishLeg(s, pi, score);
    return s;
  }

  p.dartsThrown += 3;
  p.dartsInLeg += 3;
  p.dartsAtDouble += doubleDartsCounted;
  p.pointsScored += score;
  p.remaining = newRem;
  s.visits.push(visitRecord(s, pi, null, score, false, false, 3, doubleDartsCounted));
  s.lastFeedback = { kind: 'visit', player: pi, score };
  nextPlayer(s);
  return s;
}

export function applyEvent(state: X01State, e: X01Event): X01State {
  if (e.p !== state.current) throw new RuleError('Ereignis gehört nicht zum Spieler am Zug');
  return e.t === 'dart' ? applyDart(state, e.dart) : applyVisit(state, e.score, { darts: e.darts, doubleDarts: e.doubleDarts });
}

/** Berechnet den Zustand aus allen Ereignissen. */
export function replayX01(config: X01Config, events: X01Event[]): X01State {
  return events.reduce(applyEvent, createX01(config));
}

/**
 * Entfernt die letzte Eingabe des menschlichen Spielers (inkl. danach folgender
 * Bot-Darts), damit Undo nach einer Bot-Aufnahme wie erwartet funktioniert.
 */
export function undoLastHuman(config: X01Config, events: X01Event[]): X01Event[] {
  const isBot = (p: number) => Boolean(config.players[p]?.bot);
  let i = events.length - 1;
  while (i >= 0 && isBot(events[i].p)) i--;
  return i < 0 ? [] : events.slice(0, i);
}

export interface X01PlayerStats {
  dartsThrown: number;
  pointsScored: number;
  average: number | null;
  first9Average: number | null;
  dartsAtDouble: number;
  checkouts: number;
  checkoutRate: number | null;
  highestFinish: number;
  highestVisit: number;
  tons: number;
  ton40s: number;
  max180s: number;
  legsWon: number;
  bestLegDarts: number | null;
}

export function playerStats(s: X01State, player: number): X01PlayerStats {
  const p = s.players[player];
  const visits = s.visits.filter((v) => v.player === player);
  let first9Points = 0;
  let first9Darts = 0;
  const perLegCount = new Map<number, number>();
  for (const v of visits) {
    const c = perLegCount.get(v.leg) ?? 0;
    if (c < 3) {
      first9Points += v.score;
      first9Darts += v.dartsUsed;
    }
    perLegCount.set(v.leg, c + 1);
  }
  const legs = s.legs.filter((l) => l.winner === player);
  return {
    dartsThrown: p.dartsThrown,
    pointsScored: p.pointsScored,
    average: p.dartsThrown > 0 ? (p.pointsScored / p.dartsThrown) * 3 : null,
    first9Average: first9Darts > 0 ? (first9Points / first9Darts) * 3 : null,
    dartsAtDouble: p.dartsAtDouble,
    checkouts: p.checkouts,
    checkoutRate: p.dartsAtDouble > 0 ? p.checkouts / p.dartsAtDouble : null,
    highestFinish: p.highestFinish,
    highestVisit: visits.reduce((m, v) => Math.max(m, v.score), 0),
    tons: visits.filter((v) => v.score >= 100 && v.score < 140).length,
    ton40s: visits.filter((v) => v.score >= 140 && v.score < 180).length,
    max180s: visits.filter((v) => v.score === 180).length,
    legsWon: p.legsWon,
    bestLegDarts: legs.length ? Math.min(...legs.map((l) => l.darts)) : null,
  };
}
