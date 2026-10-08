import { dartLabel, isHit, makeDart, neighbours } from '../board';
import type { Dart, Target } from '../types';
import type { DrillView, ThrowRecord } from './types';

export const DARTS_PER_VISIT = 3;

/** Prozentwert ohne Nachkommastellen; "–" bei fehlender Basis. */
export function pct(hits: number, total: number): string {
  if (total <= 0) return '–';
  return `${Math.round((hits / total) * 100)} %`;
}

export function ratio(hits: number, total: number): number | null {
  return total > 0 ? hits / total : null;
}

export function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Schnelltasten passend zum Ziel: Nachbarfelder, Single, Double, Triple, Miss. */
export function quickFor(t: Target | null): Dart[] {
  if (!t || t.kind === 'board' || t.kind === 'free') return [];
  if (t.n === 25 || t.kind === 'bull' || t.kind === 'bullseye') {
    return [makeDart(25, 1), makeDart(25, 2), makeDart(0, 0)];
  }
  const [left, right] = neighbours(t.n);
  if (t.kind === 'double') {
    return [makeDart(left, 2), makeDart(t.n, 2), makeDart(right, 2), makeDart(t.n, 1), makeDart(0, 0)];
  }
  if (t.kind === 'triple') {
    return [makeDart(left, 3), makeDart(t.n, 3), makeDart(right, 3), makeDart(t.n, 1), makeDart(left, 1), makeDart(right, 1), makeDart(0, 0)];
  }
  return [makeDart(left, 1), makeDart(t.n, 1), makeDart(right, 1), makeDart(t.n, 2), makeDart(t.n, 3), makeDart(0, 0)];
}

export function record(dart: Dart, target: Target | null, round: number, at?: number): ThrowRecord {
  const hit = target && target.kind !== 'free' ? isHit(dart, target) : null;
  return { dart, target, hit, round, at };
}

/** Darts der aktuell laufenden Aufnahme (Runde) für die Anzeige. */
export function currentVisit(throws: ThrowRecord[], round: number): DrillView['visitDarts'] {
  return throws.filter((t) => t.round === round).map((t) => ({ label: dartLabel(t.dart), hit: t.hit }));
}

export function hitFeedback(last: ThrowRecord | undefined): DrillView['feedback'] {
  if (!last || last.hit === null) return undefined;
  return last.hit ? { tone: 'good', text: `Treffer: ${dartLabel(last.dart)}` } : { tone: 'neutral', text: `${dartLabel(last.dart)} – weiter so, gleicher Ablauf.` };
}

export function countHits(throws: ThrowRecord[]): { hits: number; attempts: number } {
  let hits = 0;
  let attempts = 0;
  for (const t of throws) {
    if (t.hit === null) continue;
    attempts++;
    if (t.hit) hits++;
  }
  return { hits, attempts };
}
