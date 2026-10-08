import type { Point } from './types';

export function centroid(points: Point[]): Point | null {
  if (points.length === 0) return null;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  return { x: sx / points.length, y: sy / points.length };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Gruppengröße = größter Abstand zweier Darts (wie beim Schießen: "Extreme Spread"). */
export function groupSize(points: Point[]): number | null {
  if (points.length < 2) return null;
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) max = Math.max(max, distance(points[i], points[j]));
  }
  return max;
}

/** Mittlerer Abstand der Darts vom gemeinsamen Mittelpunkt. */
export function meanRadius(points: Point[]): number | null {
  const c = centroid(points);
  if (!c || points.length < 2) return null;
  return points.reduce((s, p) => s + distance(p, c), 0) / points.length;
}

export interface BiasAnalysis {
  /** Mittlere Abweichung vom Zielpunkt in mm (x rechts, y oben). */
  dx: number;
  dy: number;
  /** Standardabweichung je Achse in mm. */
  sdX: number;
  sdY: number;
  n: number;
  /** Ist die mittlere Abweichung deutlich größer als die Messunsicherheit? */
  significantX: boolean;
  significantY: boolean;
}

function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * Systematische Abweichung (Bias) gegenüber dem Zielpunkt.
 * Als "deutlich" gilt eine Abweichung erst bei ausreichender Stichprobe (n ≥ 15),
 * wenn sie größer als 2 Standardfehler und größer als die angenommene Tipp-Ungenauigkeit (8 mm) ist.
 */
export function biasAnalysis(offsets: Point[], tapUncertaintyMm = 8): BiasAnalysis | null {
  const n = offsets.length;
  if (n < 3) return null;
  const xs = offsets.map((o) => o.x);
  const ys = offsets.map((o) => o.y);
  const dx = xs.reduce((a, b) => a + b, 0) / n;
  const dy = ys.reduce((a, b) => a + b, 0) / n;
  const sdX = sd(xs);
  const sdY = sd(ys);
  const seX = sdX / Math.sqrt(n);
  const seY = sdY / Math.sqrt(n);
  return {
    dx,
    dy,
    sdX,
    sdY,
    n,
    significantX: n >= 15 && Math.abs(dx) > 2 * seX && Math.abs(dx) > tapUncertaintyMm,
    significantY: n >= 15 && Math.abs(dy) > 2 * seY && Math.abs(dy) > tapUncertaintyMm,
  };
}
