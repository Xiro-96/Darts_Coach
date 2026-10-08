import { aimPoint, dartFromPoint } from './board';
import { bestCheckout, setupAdvice, type OutMode } from './checkout';
import { gaussian, type Rng } from './random';
import type { Dart, Target } from './types';

/**
 * Virtueller Gegner. Jeder Dart wird physikalisch plausibel simuliert:
 * Der Bot zielt auf die Mitte eines Feldes, die tatsächliche Position streut
 * normalverteilt (Standardabweichung σ in mm) um den Zielpunkt. Daraus ergibt
 * sich automatisch eine realistische Mischung aus Treffern, Nachbarfeldern
 * und Fehlwürfen.
 *
 * Die σ-Werte wurden per Simulation so gewählt, dass der 3-Dart-Average
 * ungefähr den angegebenen Werten entspricht (siehe Unit-Test).
 */
export const BOT_LEVELS: { level: number; sigma: number; approxAverage: number; label: string }[] = [
  { level: 1, sigma: 66, approxAverage: 12, label: 'Einsteiger' },
  { level: 2, sigma: 48, approxAverage: 18, label: 'Gelegenheitsspieler' },
  { level: 3, sigma: 35, approxAverage: 24, label: 'Hobbyspieler' },
  { level: 4, sigma: 27.3, approxAverage: 31, label: 'Kneipenspieler' },
  { level: 5, sigma: 21.6, approxAverage: 37, label: 'Vereinsspieler' },
  { level: 6, sigma: 17.3, approxAverage: 46, label: 'Ligaspieler' },
  { level: 7, sigma: 14.5, approxAverage: 54, label: 'Starker Ligaspieler' },
  { level: 8, sigma: 12.4, approxAverage: 62, label: 'Regionale Spitze' },
  { level: 9, sigma: 9.8, approxAverage: 74, label: 'Semi-Profi' },
  { level: 10, sigma: 7.6, approxAverage: 90, label: 'Profi-Niveau' },
];

export function botSigma(level: number): number {
  const l = BOT_LEVELS.find((b) => b.level === Math.round(level));
  return l ? l.sigma : BOT_LEVELS[0].sigma;
}

/** Simuliert einen Wurf auf ein Ziel. */
export function simulateThrow(target: Target, sigma: number, rng: Rng): Dart {
  const aim = aimPoint(target) ?? { x: 0, y: 0 };
  return dartFromPoint({ x: aim.x + gaussian(rng) * sigma, y: aim.y + gaussian(rng) * sigma });
}

function dartToTarget(d: Dart): Target {
  if (d.n === 25) return { n: 25, kind: d.m === 2 ? 'bullseye' : 'bull' };
  return { n: d.n, kind: d.m === 3 ? 'triple' : d.m === 2 ? 'double' : 'single' };
}

/** Wählt das Ziel des Bots für den nächsten Dart. */
export function chooseBotTarget(remaining: number, dartsLeft: number, out: OutMode, isIn: boolean): Target {
  if (!isIn) return { n: 20, kind: 'double' };
  const route = bestCheckout(remaining, dartsLeft, out);
  if (route) return dartToTarget(route.darts[0]);
  if (remaining <= 60) {
    const advice = setupAdvice(remaining);
    if (advice) return dartToTarget(advice.dart);
  }
  if (remaining - 60 === 1 || remaining - 60 < 0) return { n: 19, kind: 'triple' };
  return { n: 20, kind: 'triple' };
}
