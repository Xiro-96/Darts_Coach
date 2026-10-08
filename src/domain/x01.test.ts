import { describe, expect, it } from 'vitest';
import { chooseBotTarget, simulateThrow, BOT_LEVELS } from './bot';
import { makeDart } from './board';
import { createRng } from './random';
import {
  applyDart,
  applyVisit,
  createX01,
  playerStats,
  replayX01,
  undoLastHuman,
  type X01Config,
  type X01Event,
} from './x01';

const solo = (start = 501, extra: Partial<X01Config> = {}): X01Config => ({
  start,
  out: 'double',
  in: 'straight',
  legsToWin: 1,
  players: [{ name: 'Ich' }],
  ...extra,
});

const T = (n: number) => makeDart(n, 3);
const D = (n: number) => makeDart(n, 2);
const S = (n: number) => makeDart(n, 1);
const MISS = makeDart(0, 0);

function throwAll(config: X01Config, darts: ReturnType<typeof makeDart>[]) {
  return darts.reduce(applyDart, createX01(config));
}

describe('X01 – Grundregeln', () => {
  it('zieht Punkte ab und wechselt nach drei Darts die Aufnahme', () => {
    const s = throwAll(solo(), [T(20), T(20), T(20)]);
    expect(s.players[0].remaining).toBe(321);
    expect(s.visits).toHaveLength(1);
    expect(s.visits[0].score).toBe(180);
    expect(s.visitDarts).toHaveLength(0);
    expect(s.visitStart).toBe(321);
  });

  it('Bust bei Überwerfen setzt auf den Stand zu Aufnahmebeginn zurück', () => {
    let s = createX01(solo(60));
    s = applyDart(s, S(20)); // 40
    s = applyDart(s, T(20)); // -20 → Bust
    expect(s.players[0].remaining).toBe(60);
    expect(s.visits[0]).toMatchObject({ bust: true, score: 0, dartsUsed: 2 });
    expect(s.lastFeedback).toEqual({ kind: 'bust', player: 0 });
    expect(s.players[0].pointsScored).toBe(0);
    expect(s.players[0].dartsThrown).toBe(2);
  });

  it('Bust bei Rest 1 (Double-Out)', () => {
    const s = throwAll(solo(41), [S(20), S(20)]);
    expect(s.players[0].remaining).toBe(41);
    expect(s.visits[0].bust).toBe(true);
  });

  it('Bust bei Rest 0 ohne Doppel', () => {
    const s = throwAll(solo(40), [S(20), S(20)]);
    expect(s.players[0].remaining).toBe(40);
    expect(s.visits[0].bust).toBe(true);
    expect(s.finished).toBe(false);
  });

  it('Checkout mit Doppel beendet das Leg', () => {
    const s = throwAll(solo(40), [MISS, D(20)]);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.visits[0]).toMatchObject({ checkout: true, score: 40, dartsUsed: 2 });
    const st = playerStats(s, 0);
    expect(st.checkouts).toBe(1);
    expect(st.dartsAtDouble).toBe(2);
    expect(st.checkoutRate).toBeCloseTo(0.5);
    expect(st.highestFinish).toBe(40);
  });

  it('Bullseye zählt als Doppel', () => {
    const s = throwAll(solo(50), [makeDart(25, 2)]);
    expect(s.finished).toBe(true);
  });

  it('Single-Out erlaubt Finish mit Single und Rest 1', () => {
    let s = throwAll(solo(41, { out: 'single' }), [S(20), S(20)]);
    expect(s.players[0].remaining).toBe(1);
    s = applyDart(s, S(1));
    expect(s.finished).toBe(true);
  });

  it('Double-In: Punkte zählen erst nach einem Doppel', () => {
    let s = createX01(solo(301, { in: 'double' }));
    s = applyDart(s, T(20));
    expect(s.players[0].remaining).toBe(301);
    s = applyDart(s, D(10));
    expect(s.players[0].remaining).toBe(281);
    s = applyDart(s, T(20));
    expect(s.players[0].remaining).toBe(221);
  });

  it('kein Dart nach Spielende', () => {
    const s = throwAll(solo(2), [D(1)]);
    expect(() => applyDart(s, S(1))).toThrow();
  });

  it('zählt Darts auf Doppel nur bei echten Finish-Chancen', () => {
    const s = throwAll(solo(100), [T(20), S(20), S(19)]);
    // nach T20: 40 Rest → der zweite Dart war ein Dart aufs Doppel, der dritte bei 20 Rest auch
    expect(s.players[0].dartsAtDouble).toBe(2);
  });
});

describe('X01 – Aufnahme-Eingabe', () => {
  it('zieht Gesamtpunktzahl ab', () => {
    const s = applyVisit(createX01(solo()), 85);
    expect(s.players[0].remaining).toBe(416);
    expect(s.players[0].dartsThrown).toBe(3);
  });

  it('lehnt unmögliche Werte ab', () => {
    const s = createX01(solo());
    expect(() => applyVisit(s, 181)).toThrow();
    expect(() => applyVisit(s, 179)).toThrow();
    expect(() => applyVisit(s, -5)).toThrow();
    expect(() => applyVisit(s, 12.5)).toThrow();
  });

  it('Bust bei Überwerfen oder Rest 1', () => {
    let s = applyVisit(createX01(solo(50)), 60);
    expect(s.players[0].remaining).toBe(50);
    expect(s.visits[0].bust).toBe(true);
    s = applyVisit(s, 49);
    expect(s.players[0].remaining).toBe(50);
  });

  it('Checkout prüft, ob der Rest mit der Dartanzahl möglich ist', () => {
    const s = createX01(solo(170));
    expect(() => applyVisit(s, 170, { darts: 2 })).toThrow();
    const done = applyVisit(s, 170, { darts: 3 });
    expect(done.finished).toBe(true);
    expect(playerStats(done, 0).highestFinish).toBe(170);
    expect(() => applyVisit(createX01(solo(169)), 169)).toThrow();
  });

  it('nicht mitten in einer Aufnahme', () => {
    const s = applyDart(createX01(solo()), S(20));
    expect(() => applyVisit(s, 60)).toThrow();
  });
});

describe('X01 – Legs, Undo, Statistik', () => {
  it('spielt mehrere Legs mit wechselndem Anwurf', () => {
    const config: X01Config = {
      start: 40,
      out: 'double',
      in: 'straight',
      legsToWin: 2,
      players: [{ name: 'A' }, { name: 'B' }],
    };
    let s = createX01(config);
    s = applyDart(s, D(20)); // A gewinnt Leg 1
    expect(s.players[0].legsWon).toBe(1);
    expect(s.current).toBe(1); // B beginnt Leg 2
    expect(s.players[0].remaining).toBe(40);
    s = applyDart(s, MISS);
    s = applyDart(s, MISS);
    s = applyDart(s, MISS);
    expect(s.current).toBe(0);
    s = applyDart(s, D(20));
    expect(s.finished).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.legs).toHaveLength(2);
  });

  it('Replay + Undo ergibt den vorherigen Zustand', () => {
    const config = solo(501);
    const events: X01Event[] = [
      { t: 'dart', p: 0, dart: T(20) },
      { t: 'dart', p: 0, dart: S(20) },
      { t: 'dart', p: 0, dart: S(5) },
      { t: 'visit', p: 0, score: 100 },
    ];
    const full = replayX01(config, events);
    expect(full.players[0].remaining).toBe(316);
    const undone = replayX01(config, undoLastHuman(config, events));
    expect(undone.players[0].remaining).toBe(416);
  });

  it('Undo entfernt auch die danach geworfenen Bot-Darts', () => {
    const config: X01Config = { ...solo(501), players: [{ name: 'Ich' }, { name: 'Bot', bot: { level: 3 } }] };
    const events: X01Event[] = [
      { t: 'visit', p: 0, score: 60 },
      { t: 'dart', p: 1, dart: S(20) },
      { t: 'dart', p: 1, dart: S(20) },
      { t: 'dart', p: 1, dart: S(20) },
    ];
    expect(undoLastHuman(config, events)).toEqual([]);
  });

  it('berechnet Average und First-9-Average', () => {
    const config = solo(501);
    let s = createX01(config);
    for (const score of [60, 45, 100, 26]) s = applyVisit(s, score);
    const st = playerStats(s, 0);
    expect(st.average).toBeCloseTo(((60 + 45 + 100 + 26) / 12) * 3);
    expect(st.first9Average).toBeCloseTo(((60 + 45 + 100) / 9) * 3);
    expect(st.tons).toBe(1);
    expect(st.highestVisit).toBe(100);
  });
});

describe('Virtueller Gegner', () => {
  it('wählt sinnvolle Ziele', () => {
    expect(chooseBotTarget(501, 3, 'double', true)).toEqual({ n: 20, kind: 'triple' });
    expect(chooseBotTarget(40, 1, 'double', true)).toEqual({ n: 20, kind: 'double' });
    expect(chooseBotTarget(170, 3, 'double', true)).toEqual({ n: 20, kind: 'triple' });
    expect(chooseBotTarget(57, 1, 'double', true)).toEqual({ n: 17, kind: 'single' });
    expect(chooseBotTarget(301, 3, 'double', false)).toEqual({ n: 20, kind: 'double' });
  });

  it('erreicht ungefähr den angegebenen Average je Stufe', () => {
    for (const lvl of [BOT_LEVELS[2], BOT_LEVELS[6], BOT_LEVELS[9]]) {
      const rng = createRng(7);
      let darts = 0;
      let points = 0;
      for (let g = 0; g < 120; g++) {
        let s = createX01(solo(501));
        let guard = 0;
        while (!s.finished && guard++ < 500) {
          const p = s.players[0];
          s = applyDart(s, simulateThrow(chooseBotTarget(p.remaining, 3 - s.visitDarts.length, 'double', p.isIn), lvl.sigma, rng));
        }
        darts += s.players[0].dartsThrown;
        points += s.players[0].pointsScored;
      }
      const avg = (points / darts) * 3;
      expect(Math.abs(avg - lvl.approxAverage) / lvl.approxAverage).toBeLessThan(0.15);
    }
  });
});
