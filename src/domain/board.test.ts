import { describe, expect, it } from 'vitest';
import {
  aimPoint,
  BOARD_ORDER,
  dartFromPoint,
  dartLabel,
  dartScore,
  isHit,
  makeDart,
  neighbours,
  numberAtAngle,
  polarToPoint,
  RADII,
  segmentAngle,
} from './board';

describe('Scheibengeometrie', () => {
  it('hat 20 eindeutige Zahlen in korrekter Reihenfolge', () => {
    expect(BOARD_ORDER).toHaveLength(20);
    expect(new Set(BOARD_ORDER).size).toBe(20);
    expect(BOARD_ORDER.slice(0, 5)).toEqual([20, 1, 18, 4, 13]);
    expect(BOARD_ORDER[10]).toBe(3); // unten
    expect(BOARD_ORDER[5]).toBe(6); // rechts (3 Uhr)
    expect(BOARD_ORDER[15]).toBe(11); // links (9 Uhr)
  });

  it('ordnet Winkel den richtigen Segmenten zu', () => {
    expect(numberAtAngle(0)).toBe(20);
    expect(numberAtAngle(8.9)).toBe(20);
    expect(numberAtAngle(9.1)).toBe(1);
    expect(numberAtAngle(-8.9)).toBe(20);
    expect(numberAtAngle(-9.1)).toBe(5);
    expect(numberAtAngle(90)).toBe(6);
    expect(numberAtAngle(180)).toBe(3);
    expect(numberAtAngle(270)).toBe(11);
    expect(numberAtAngle(360 + 90)).toBe(6);
  });

  it('erkennt Bull, Bullseye, Single, Triple, Double und Miss aus Positionen', () => {
    expect(dartFromPoint({ x: 0, y: 0 })).toMatchObject({ n: 25, m: 2 });
    expect(dartFromPoint({ x: 10, y: 0 })).toMatchObject({ n: 25, m: 1 });
    expect(dartFromPoint({ x: 0, y: 50 })).toMatchObject({ n: 20, m: 1, inner: true });
    expect(dartFromPoint({ x: 0, y: 103 })).toMatchObject({ n: 20, m: 3 });
    expect(dartFromPoint({ x: 0, y: 130 })).toMatchObject({ n: 20, m: 1, inner: false });
    expect(dartFromPoint({ x: 0, y: 166 })).toMatchObject({ n: 20, m: 2 });
    expect(dartFromPoint({ x: 0, y: 175 })).toMatchObject({ n: 0, m: 0 });
    expect(dartFromPoint({ x: 166, y: 0 })).toMatchObject({ n: 6, m: 2 });
    expect(dartFromPoint({ x: 0, y: -103 })).toMatchObject({ n: 3, m: 3 });
    expect(dartFromPoint({ x: -103, y: 0 })).toMatchObject({ n: 11, m: 3 });
  });

  it('speichert die Position gerundet mit', () => {
    const d = dartFromPoint({ x: 1.234, y: 50.06 });
    expect(d.p).toEqual({ x: 1.2, y: 50.1 });
  });

  it('Zielpunkte liegen im jeweiligen Feld', () => {
    for (const n of BOARD_ORDER) {
      expect(dartFromPoint(aimPoint({ n, kind: 'triple' })!)).toMatchObject({ n, m: 3 });
      expect(dartFromPoint(aimPoint({ n, kind: 'double' })!)).toMatchObject({ n, m: 2 });
      expect(dartFromPoint(aimPoint({ n, kind: 'single' })!)).toMatchObject({ n, m: 1 });
    }
    expect(aimPoint({ n: 0, kind: 'free' })).toBeNull();
  });

  it('polarToPoint und segmentAngle sind konsistent', () => {
    const p = polarToPoint(segmentAngle(6), 50);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
    expect(RADII.doubleOuter).toBe(170);
  });

  it('kennt die Nachbarn', () => {
    expect(neighbours(20)).toEqual([5, 1]);
    expect(neighbours(3)).toEqual([17, 19]);
  });
});

describe('Punktwerte und Trefferprüfung', () => {
  it('berechnet Punktwerte', () => {
    expect(dartScore(makeDart(20, 3))).toBe(60);
    expect(dartScore(makeDart(16, 2))).toBe(32);
    expect(dartScore(makeDart(25, 1))).toBe(25);
    expect(dartScore(makeDart(25, 2))).toBe(50);
    expect(dartScore(makeDart(0, 0))).toBe(0);
    expect(dartScore(makeDart(7, 0))).toBe(0);
  });

  it('lehnt ungültige Darts ab', () => {
    expect(() => makeDart(25, 3)).toThrow();
    expect(() => makeDart(21, 1)).toThrow();
  });

  it('erstellt Beschriftungen', () => {
    expect(dartLabel(makeDart(20, 3))).toBe('T20');
    expect(dartLabel(makeDart(5, 1))).toBe('S5');
    expect(dartLabel(makeDart(25, 2))).toBe('BULL');
    expect(dartLabel(makeDart(25, 1))).toBe('25');
    expect(dartLabel(makeDart(0, 0))).toBe('Miss');
  });

  it('prüft Treffer je Zielart', () => {
    const t20 = makeDart(20, 3);
    expect(isHit(t20, { n: 20, kind: 'number' })).toBe(true);
    expect(isHit(t20, { n: 20, kind: 'triple' })).toBe(true);
    expect(isHit(t20, { n: 20, kind: 'single' })).toBe(false);
    expect(isHit(t20, { n: 20, kind: 'double' })).toBe(false);
    expect(isHit(t20, { n: 19, kind: 'number' })).toBe(false);
    expect(isHit(makeDart(25, 1), { n: 25, kind: 'bull' })).toBe(true);
    expect(isHit(makeDart(25, 1), { n: 25, kind: 'bullseye' })).toBe(false);
    expect(isHit(makeDart(25, 2), { n: 25, kind: 'bullseye' })).toBe(true);
    expect(isHit(makeDart(0, 0), { n: 0, kind: 'board' })).toBe(false);
    expect(isHit(makeDart(3, 1), { n: 0, kind: 'board' })).toBe(true);
  });
});
