import { memo, type ReactNode } from 'react';
import { BOARD_ORDER, RADII, SEGMENT_ANGLE, segmentAngle } from '../../domain/board';
import type { Point, Target } from '../../domain/types';

/** SVG-Koordinaten: Millimeter, Ursprung Mitte, y nach unten (Domain: y nach oben). */
export const VIEW_R = 228;

export function toSvg(p: Point): { x: number; y: number } {
  return { x: p.x, y: -p.y };
}

function pt(angleDeg: number, r: number): string {
  const a = (angleDeg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(3)} ${(-r * Math.cos(a)).toFixed(3)}`;
}

export function wedgePath(a0: number, a1: number, r0: number, r1: number): string {
  return `M ${pt(a0, r1)} A ${r1} ${r1} 0 0 1 ${pt(a1, r1)} L ${pt(a1, r0)} A ${r0} ${r0} 0 0 0 ${pt(a0, r0)} Z`;
}

const half = SEGMENT_ANGLE / 2;

/** Die statische Scheibe (gemessen an Turniermaßen). */
export const BoardGraphic = memo(function BoardGraphic({ dim = false, showNumbers = true }: { dim?: boolean; showNumbers?: boolean }) {
  return (
    <g opacity={dim ? 0.45 : 1}>
      <circle r={VIEW_R - 2} fill="#0d1014" />
      <circle r={RADII.numberRing} fill="var(--color-board-black)" />
      {BOARD_ORDER.map((n, i) => {
        const c = i * SEGMENT_ANGLE;
        const a0 = c - half;
        const a1 = c + half;
        const dark = i % 2 === 0;
        const single = dark ? 'var(--color-board-black)' : 'var(--color-board-cream)';
        const ring = dark ? 'var(--color-board-red)' : 'var(--color-board-green)';
        return (
          <g key={n}>
            <path d={wedgePath(a0, a1, RADII.outerBull, RADII.tripleInner)} fill={single} />
            <path d={wedgePath(a0, a1, RADII.tripleInner, RADII.tripleOuter)} fill={ring} />
            <path d={wedgePath(a0, a1, RADII.tripleOuter, RADII.doubleInner)} fill={single} />
            <path d={wedgePath(a0, a1, RADII.doubleInner, RADII.doubleOuter)} fill={ring} />
          </g>
        );
      })}
      <circle r={RADII.outerBull} fill="var(--color-board-green)" />
      <circle r={RADII.bullseye} fill="var(--color-board-red)" />
      {/* Drähte */}
      <g stroke="var(--color-board-wire)" strokeWidth={0.6} fill="none" opacity={0.75}>
        {[RADII.outerBull, RADII.tripleInner, RADII.tripleOuter, RADII.doubleInner, RADII.doubleOuter, RADII.bullseye].map((r) => (
          <circle key={r} r={r} />
        ))}
        {BOARD_ORDER.map((n, i) => {
          const a = i * SEGMENT_ANGLE - half;
          return <path key={n} d={`M ${pt(a, RADII.outerBull)} L ${pt(a, RADII.doubleOuter)}`} />;
        })}
      </g>
      {showNumbers &&
        BOARD_ORDER.map((n, i) => {
          const a = (i * SEGMENT_ANGLE * Math.PI) / 180;
          const r = 189;
          return (
            <text
              key={n}
              x={r * Math.sin(a)}
              y={-r * Math.cos(a)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={24}
              fontWeight={700}
              fontFamily="var(--font-display)"
              fill="#e9edf1"
            >
              {n}
            </text>
          );
        })}
    </g>
  );
});

/** Hervorhebung des aktuellen Ziels. */
export function TargetHighlight({ target }: { target: Target | null }) {
  if (!target || target.kind === 'free' || target.kind === 'board') return null;
  const style = { fill: 'rgb(52 209 127 / 0.22)', stroke: 'var(--color-accent)', strokeWidth: 2.5 } as const;
  let shapes: ReactNode;
  if (target.n === 25 || target.kind === 'bull' || target.kind === 'bullseye') {
    shapes = <circle r={target.kind === 'bullseye' || (target.kind === 'double' && target.n === 25) ? RADII.bullseye : RADII.outerBull} {...style} />;
  } else {
    const c = segmentAngle(target.n);
    const a0 = c - half;
    const a1 = c + half;
    switch (target.kind) {
      case 'number':
        shapes = <path d={wedgePath(a0, a1, RADII.outerBull, RADII.doubleOuter)} {...style} />;
        break;
      case 'single':
        shapes = (
          <>
            <path d={wedgePath(a0, a1, RADII.outerBull, RADII.tripleInner)} {...style} />
            <path d={wedgePath(a0, a1, RADII.tripleOuter, RADII.doubleInner)} {...style} />
          </>
        );
        break;
      case 'double':
        shapes = <path d={wedgePath(a0, a1, RADII.doubleInner, RADII.doubleOuter)} {...style} />;
        break;
      case 'triple':
        shapes = <path d={wedgePath(a0, a1, RADII.tripleInner, RADII.tripleOuter)} {...style} />;
        break;
    }
  }
  return (
    <g pointerEvents="none" className="target-glow">
      {shapes}
    </g>
  );
}
