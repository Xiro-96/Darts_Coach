import type { Dart, Multiplier, Point, Target } from './types';

/** Reihenfolge der Zahlen im Uhrzeigersinn, beginnend oben mit der 20. */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

/**
 * Radien einer Standard-Steeldartscheibe (Turniermaß) in Millimetern,
 * jeweils gemessen von der Scheibenmitte bis zur Außenkante des Rings.
 */
export const RADII = {
  bullseye: 6.35,
  outerBull: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  /** Außenkante der Zahlenring-Darstellung (nur Optik). */
  numberRing: 205,
} as const;

/** Segmentbreite in Grad. */
export const SEGMENT_ANGLE = 18;

/** Winkel (Grad, im Uhrzeigersinn ab 12 Uhr) der Segmentmitte einer Zahl. */
export function segmentAngle(n: number): number {
  const idx = BOARD_ORDER.indexOf(n as (typeof BOARD_ORDER)[number]);
  if (idx < 0) throw new Error(`Ungültiges Segment ${n}`);
  return idx * SEGMENT_ANGLE;
}

/** Polar (Grad im Uhrzeigersinn ab oben, Radius mm) → kartesisch (x rechts, y oben). */
export function polarToPoint(angleDeg: number, r: number): Point {
  const a = (angleDeg * Math.PI) / 180;
  return { x: r * Math.sin(a), y: r * Math.cos(a) };
}

/** Segmentzahl für einen Winkel im Uhrzeigersinn ab oben. */
export function numberAtAngle(angleDeg: number): number {
  const norm = (((angleDeg + SEGMENT_ANGLE / 2) % 360) + 360) % 360;
  return BOARD_ORDER[Math.floor(norm / SEGMENT_ANGLE) % 20];
}

/**
 * Ermittelt das getroffene Feld aus einer Position in Millimetern.
 * Treffer genau auf einem Draht werden dem inneren Feld zugeordnet.
 */
export function dartFromPoint(p: Point): Dart {
  const r = Math.hypot(p.x, p.y);
  const pos = { x: round1(p.x), y: round1(p.y) };
  if (r <= RADII.bullseye) return { n: 25, m: 2, p: pos };
  if (r <= RADII.outerBull) return { n: 25, m: 1, p: pos };
  if (r > RADII.doubleOuter) return { n: 0, m: 0, p: pos };
  const angle = (Math.atan2(p.x, p.y) * 180) / Math.PI;
  const n = numberAtAngle(angle);
  if (r <= RADII.tripleInner) return { n, m: 1, inner: true, p: pos };
  if (r <= RADII.tripleOuter) return { n, m: 3, p: pos };
  if (r <= RADII.doubleInner) return { n, m: 1, inner: false, p: pos };
  return { n, m: 2, p: pos };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Punktwert eines Darts. */
export function dartScore(d: Dart): number {
  if (d.m === 0 || d.n === 0) return 0;
  return d.n * d.m;
}

export function isDouble(d: Dart): boolean {
  return d.m === 2 && d.n > 0;
}

export function isMiss(d: Dart): boolean {
  return d.m === 0 || d.n === 0;
}

/** Kurzbezeichnung, z. B. "T20", "D16", "S5", "25", "BULL", "Miss". */
export function dartLabel(d: Dart): string {
  if (isMiss(d)) return 'Miss';
  if (d.n === 25) return d.m === 2 ? 'BULL' : '25';
  const prefix = d.m === 3 ? 'T' : d.m === 2 ? 'D' : 'S';
  return `${prefix}${d.n}`;
}

/** Erzeugt einen Dart ohne Positionsangabe (Schnelleingabe). */
export function makeDart(n: number, m: Multiplier): Dart {
  if (n === 0 || m === 0) return { n: 0, m: 0 };
  if (n === 25 && m === 3) throw new Error('Es gibt kein Triple-Bull');
  if (n !== 25 && (n < 1 || n > 20)) throw new Error(`Ungültige Zahl ${n}`);
  return { n, m };
}

/** Prüft, ob ein Dart das angegebene Ziel trifft. */
export function isHit(d: Dart, t: Target): boolean {
  if (isMiss(d)) return false;
  switch (t.kind) {
    case 'board':
    case 'free':
      return true;
    case 'bull':
      return d.n === 25;
    case 'bullseye':
      return d.n === 25 && d.m === 2;
    case 'number':
      return d.n === t.n;
    case 'single':
      return d.n === t.n && d.m === 1;
    case 'double':
      return d.n === t.n && d.m === 2;
    case 'triple':
      return d.n === t.n && d.m === 3;
  }
}

/** Beschriftung eines Ziels für die Anzeige. */
export function targetLabel(t: Target): string {
  switch (t.kind) {
    case 'board':
      return 'Scheibe';
    case 'free':
      return 'Freier Wurf';
    case 'bull':
      return 'Bull';
    case 'bullseye':
      return 'Bullseye';
    case 'number':
      return t.n === 25 ? 'Bull' : `${t.n}`;
    case 'single':
      return t.n === 25 ? '25' : `S${t.n}`;
    case 'double':
      return t.n === 25 ? 'Bullseye' : `D${t.n}`;
    case 'triple':
      return `T${t.n}`;
  }
}

/**
 * Zielpunkt (Mitte des Zielfelds) in mm. Für Segmentziele wird die Mitte des
 * großen inneren Single-Felds verwendet. `null`, wenn kein eindeutiger Punkt existiert.
 */
export function aimPoint(t: Target): Point | null {
  switch (t.kind) {
    case 'bull':
    case 'bullseye':
      return { x: 0, y: 0 };
    case 'number':
    case 'single':
      if (t.n === 25) return { x: 0, y: 0 };
      return polarToPoint(segmentAngle(t.n), (RADII.outerBull + RADII.tripleInner) / 2);
    case 'double':
      if (t.n === 25) return { x: 0, y: 0 };
      return polarToPoint(segmentAngle(t.n), (RADII.doubleInner + RADII.doubleOuter) / 2);
    case 'triple':
      return polarToPoint(segmentAngle(t.n), (RADII.tripleInner + RADII.tripleOuter) / 2);
    default:
      return null;
  }
}

/** Nachbarzahlen links und rechts eines Segments (im Uhrzeigersinn: [links, rechts]). */
export function neighbours(n: number): [number, number] {
  const idx = BOARD_ORDER.indexOf(n as (typeof BOARD_ORDER)[number]);
  if (idx < 0) throw new Error(`Ungültiges Segment ${n}`);
  return [BOARD_ORDER[(idx + 19) % 20], BOARD_ORDER[(idx + 1) % 20]];
}

/** Alle 62 möglichen Treffer mit Punkten (ohne Miss): S1–20, D1–20, T1–20, 25, BULL. */
export const ALL_SCORING_DARTS: Dart[] = (() => {
  const list: Dart[] = [];
  for (let n = 1; n <= 20; n++) {
    list.push({ n, m: 1 }, { n, m: 2 }, { n, m: 3 });
  }
  list.push({ n: 25, m: 1 }, { n: 25, m: 2 });
  return list;
})();
