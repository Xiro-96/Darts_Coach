import { ALL_SCORING_DARTS, dartLabel, dartScore } from './board';
import type { Dart } from './types';

export type OutMode = 'double' | 'single' | 'master';

export interface CheckoutRoute {
  darts: Dart[];
  labels: string[];
  /** Interne Bewertung – kleiner ist besser. */
  cost: number;
}

/**
 * Bevorzugte Finish-Doppel. D16 und D20 gelten als Standard, weil sie sich
 * gut halbieren lassen (32 → 16 → 8 → 4) bzw. direkt neben der 20 liegen.
 */
const DOUBLE_PREFERENCE: Record<number, number> = {
  20: 0,
  16: 0.3,
  8: 1.2,
  10: 1.5,
  18: 1.8,
  12: 1.8,
  4: 2.6,
  14: 2.8,
  6: 3,
  2: 3.5,
  19: 4,
  17: 4,
  13: 4.2,
  15: 4.2,
  9: 4.5,
  11: 4.5,
  7: 4.6,
  5: 4.6,
  3: 5,
  1: 6,
  25: 3.2, // Bullseye als Finish
};

const TREBLE_PREFERENCE: Record<number, number> = { 20: 0, 19: 0.4, 18: 0.7, 17: 0.9, 16: 1, 15: 1.3 };

function finishCost(d: Dart): number {
  return DOUBLE_PREFERENCE[d.n] ?? 5;
}

function setupCost(d: Dart): number {
  if (d.n === 25) return d.m === 2 ? 5 : 3;
  if (d.m === 1) return 1 + (d.n >= 10 ? 0 : 0.2);
  if (d.m === 3) return 2.5 + (TREBLE_PREFERENCE[d.n] ?? 1.8);
  return 6; // Doppel als Vorbereitungsdart vermeiden
}

function isValidFinisher(d: Dart, out: OutMode): boolean {
  if (out === 'single') return true;
  if (out === 'master') return d.m === 2 || d.m === 3;
  return d.m === 2;
}

function routeCost(darts: Dart[], out: OutMode): number {
  const last = darts[darts.length - 1];
  let cost = darts.length * 100;
  cost += out === 'double' ? finishCost(last) : last.m === 1 ? 0 : 1;
  for (let i = 0; i < darts.length - 1; i++) cost += setupCost(darts[i]);
  return cost;
}

const cache = new Map<string, CheckoutRoute[]>();

/**
 * Berechnet alle Checkout-Wege (max. `maxDarts` Darts) für eine Restpunktzahl,
 * sortiert nach Empfehlung. Reihenfolge der Vorbereitungsdarts wird normiert,
 * damit z. B. "T20 T19 BULL" und "T19 T20 BULL" nicht doppelt erscheinen.
 */
export function checkoutRoutes(score: number, maxDarts = 3, out: OutMode = 'double'): CheckoutRoute[] {
  const key = `${score}|${maxDarts}|${out}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const routes: CheckoutRoute[] = [];
  const seen = new Set<string>();
  const finishers = ALL_SCORING_DARTS.filter((d) => isValidFinisher(d, out));

  const add = (darts: Dart[]) => {
    const setup = darts.slice(0, -1);
    // Vorbereitung sortieren: höchster Wert zuerst (so wirft man es auch)
    setup.sort((a, b) => dartScore(b) - dartScore(a) || b.m - a.m);
    const ordered = [...setup, darts[darts.length - 1]];
    const labels = ordered.map(dartLabel);
    const id = labels.join(' ');
    if (seen.has(id)) return;
    seen.add(id);
    routes.push({ darts: ordered, labels, cost: routeCost(ordered, out) });
  };

  if (score >= 1 && score <= 180) {
    for (const f of finishers) {
      const fv = dartScore(f);
      if (fv === score) add([f]);
      if (maxDarts >= 2) {
        for (const a of ALL_SCORING_DARTS) {
          const av = dartScore(a);
          if (av + fv === score) add([a, f]);
          if (maxDarts >= 3) {
            const rest = score - fv - av;
            if (rest <= 0) continue;
            for (const b of ALL_SCORING_DARTS) {
              if (dartScore(b) === rest) add([a, b, f]);
            }
          }
        }
      }
    }
  }

  routes.sort((a, b) => a.cost - b.cost || a.labels.join().localeCompare(b.labels.join()));
  cache.set(key, routes);
  return routes;
}

/** Bester Checkout-Weg oder `null`, wenn kein Finish möglich ist. */
export function bestCheckout(score: number, dartsLeft = 3, out: OutMode = 'double'): CheckoutRoute | null {
  return checkoutRoutes(score, dartsLeft, out)[0] ?? null;
}

/** Ist die Restpunktzahl mit höchstens `dartsLeft` Darts checkbar? */
export function isFinishable(score: number, dartsLeft = 3, out: OutMode = 'double'): boolean {
  return bestCheckout(score, dartsLeft, out) !== null;
}

/** Restwerte, die mit einem einzigen Doppel (inkl. Bullseye) beendet werden können. */
export function isOneDartDoubleFinish(score: number): boolean {
  return (score >= 2 && score <= 40 && score % 2 === 0) || score === 50;
}

/** Restwerte ≤ 170, die mit drei Darts nicht beendet werden können (Double-Out). */
export const BOGEY_NUMBERS = [159, 162, 163, 165, 166, 168, 169] as const;

/** Bevorzugte "Leaves" (Restwerte), die man sich für das nächste Doppel stellen möchte. */
const PREFERRED_LEAVES = [32, 40, 16, 36, 24, 20, 8, 12, 18, 28, 10, 4, 34, 38, 30, 26, 22, 14, 6, 2];

export interface SetupAdvice {
  dart: Dart;
  label: string;
  leave: number;
}

/**
 * Vorbereitungs-Empfehlung, wenn mit den verbleibenden Darts kein Finish möglich ist:
 * Welcher (möglichst einfache) Single-Wurf hinterlässt ein gutes Doppel?
 */
export function setupAdvice(score: number): SetupAdvice | null {
  if (score <= 1) return null;
  for (const leave of PREFERRED_LEAVES) {
    const need = score - leave;
    if (need >= 1 && need <= 20) return { dart: { n: need, m: 1 }, label: `S${need}`, leave };
  }
  for (const leave of PREFERRED_LEAVES) {
    if (score - leave === 25) return { dart: { n: 25, m: 1 }, label: '25', leave };
  }
  return null;
}

/**
 * Kurze, verständliche Erklärung eines Checkout-Wegs für Anfänger.
 */
export function explainRoute(score: number, route: CheckoutRoute): string {
  const last = route.darts[route.darts.length - 1];
  const finish = last.n === 25 ? 'das Bullseye (zählt als Doppel)' : `die Doppel ${last.n}`;
  if (route.darts.length === 1) {
    return `${score} ist ein direktes Finish: Triff ${finish}.`;
  }
  const setup = route.labels.slice(0, -1).join(' + ');
  const setupPoints = route.darts.slice(0, -1).reduce((s, d) => s + dartScore(d), 0);
  let tip = '';
  if (last.n === 16 || last.n === 20 || last.n === 8) {
    tip =
      last.n === 16
        ? ' D16 ist beliebt: Triffst du nur die Single 16, bleibt D8 – und danach D4.'
        : last.n === 8
          ? ' D8 lässt sich bei einem Single-Treffer auf D4 halbieren.'
          : ' D20 liegt an der Stelle, auf die du ohnehin am meisten wirfst.';
  }
  return `Mit ${setup} (${setupPoints} Punkte) stellst du dir ${score - setupPoints} Rest – dann ${finish}.${tip}`;
}
