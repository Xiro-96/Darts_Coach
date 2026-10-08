import { describe, expect, it } from 'vitest';
import { dartScore } from './board';
import {
  bestCheckout,
  BOGEY_NUMBERS,
  checkoutRoutes,
  explainRoute,
  isFinishable,
  isOneDartDoubleFinish,
  setupAdvice,
} from './checkout';

describe('Checkout-Rechner', () => {
  it('liefert die Standard-Finishes', () => {
    expect(bestCheckout(170)!.labels).toEqual(['T20', 'T20', 'BULL']);
    expect(bestCheckout(167)!.labels).toEqual(['T20', 'T19', 'BULL']);
    expect(bestCheckout(160)!.labels).toEqual(['T20', 'T20', 'D20']);
    expect(bestCheckout(100)!.labels).toEqual(['T20', 'D20']);
    expect(bestCheckout(40)!.labels).toEqual(['D20']);
    expect(bestCheckout(32)!.labels).toEqual(['D16']);
    expect(bestCheckout(2)!.labels).toEqual(['D1']);
    expect(bestCheckout(3)!.labels).toEqual(['S1', 'D1']);
  });

  it('bevorzugt einfache Single-Vorbereitung bei kleinen Restwerten', () => {
    expect(bestCheckout(60)!.labels).toEqual(['S20', 'D20']);
    expect(bestCheckout(36)!.labels).toEqual(['D18']);
    expect(bestCheckout(41)!.darts[0].m).toBe(1);
  });

  it('findet für 2–170 außer Bogey-Zahlen immer einen Weg', () => {
    for (let s = 2; s <= 170; s++) {
      const bogey = (BOGEY_NUMBERS as readonly number[]).includes(s);
      expect(isFinishable(s), `Score ${s}`).toBe(!bogey);
    }
    expect(isFinishable(1)).toBe(false);
    expect(isFinishable(171)).toBe(false);
    expect(isFinishable(180)).toBe(false);
  });

  it('jeder Weg ist gültig: Summe stimmt und letzter Dart ist ein Doppel', () => {
    for (let s = 2; s <= 170; s++) {
      for (const r of checkoutRoutes(s)) {
        expect(r.darts.reduce((a, d) => a + dartScore(d), 0)).toBe(s);
        expect(r.darts[r.darts.length - 1].m).toBe(2);
        expect(r.darts.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('beachtet die Anzahl verbleibender Darts', () => {
    expect(isFinishable(100, 1)).toBe(false);
    expect(isFinishable(100, 2)).toBe(true);
    expect(isFinishable(110, 2)).toBe(true); // T20 BULL
    expect(isFinishable(101, 2)).toBe(true); // T17 BULL
    expect(isFinishable(103, 2)).toBe(false);
    expect(isFinishable(109, 2)).toBe(false);
    expect(bestCheckout(50, 1)!.labels).toEqual(['BULL']);
  });

  it('unterstützt Single-Out', () => {
    expect(bestCheckout(1, 1, 'single')!.labels).toEqual(['S1']);
    expect(isFinishable(180, 3, 'single')).toBe(true);
    expect(isFinishable(179, 3, 'single')).toBe(false);
  });

  it('erkennt Ein-Dart-Doppelfinishes', () => {
    expect(isOneDartDoubleFinish(40)).toBe(true);
    expect(isOneDartDoubleFinish(50)).toBe(true);
    expect(isOneDartDoubleFinish(41)).toBe(false);
    expect(isOneDartDoubleFinish(42)).toBe(false);
    expect(isOneDartDoubleFinish(1)).toBe(false);
    expect(isOneDartDoubleFinish(3)).toBe(false);
  });

  it('gibt Vorbereitungs-Tipps', () => {
    expect(setupAdvice(57)).toEqual({ dart: { n: 17, m: 1 }, label: 'S17', leave: 40 });
    expect(setupAdvice(45)).toMatchObject({ label: 'S13', leave: 32 });
    expect(setupAdvice(1)).toBeNull();
  });

  it('erklärt Wege verständlich', () => {
    expect(explainRoute(40, bestCheckout(40)!)).toContain('Doppel 20');
    expect(explainRoute(100, bestCheckout(100)!)).toContain('40 Rest');
  });
});
