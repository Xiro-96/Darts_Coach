import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { dartFromPoint, dartLabel } from '../../domain/board';
import type { Dart, Point, Target } from '../../domain/types';
import { BoardGraphic, TargetHighlight, toSvg, VIEW_R } from './BoardGraphic';

interface Marker {
  p: Point;
  label: string;
}

const LOUPE_MM = 32;

/**
 * Interaktive Dartscheibe. Tippen + Loslassen erfasst einen Dart mit Position.
 * Beim Gedrückthalten erscheint eine Lupe über dem Finger, damit man genau
 * sieht, welches Feld getroffen wird – der Finger verdeckt sonst die Stelle.
 */
export function Dartboard({
  target,
  markers = [],
  onDart,
  disabled,
  className,
}: {
  target: Target | null;
  markers?: Marker[];
  onDart: (d: Dart) => void;
  disabled?: boolean;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [probe, setProbe] = useState<{ mm: Point; px: { x: number; y: number } } | null>(null);
  const pointerId = useRef<number | null>(null);

  const toMm = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: -pt.y };
  }, []);

  const update = (e: PointerEvent) => {
    const mm = toMm(e.clientX, e.clientY);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!mm || !rect) return;
    setProbe({ mm, px: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
  };

  const onDown = (e: PointerEvent) => {
    if (disabled) return;
    pointerId.current = e.pointerId;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    update(e);
  };
  const onMove = (e: PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    update(e);
  };
  const onUp = (e: PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const mm = toMm(e.clientX, e.clientY);
    setProbe(null);
    if (!mm || disabled) return;
    if (Math.hypot(mm.x, mm.y) > VIEW_R) return; // außerhalb der Grafik: abbrechen
    navigator.vibrate?.(8);
    onDart(dartFromPoint(mm));
  };
  const onCancel = () => {
    pointerId.current = null;
    setProbe(null);
  };

  const probeDart = probe ? dartFromPoint(probe.mm) : null;
  const s = probe ? toSvg(probe.mm) : null;

  return (
    <div ref={wrapRef} className={`relative select-none ${className ?? ''}`} style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`${-VIEW_R} ${-VIEW_R} ${VIEW_R * 2} ${VIEW_R * 2}`}
        className="block h-full w-full"
        role="img"
        aria-label="Dartscheibe – tippe auf das getroffene Feld"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        data-testid="dartboard"
      >
        <BoardGraphic />
        <TargetHighlight target={target} />
        {markers.map((m, i) => {
          const p = toSvg(m.p);
          return (
            <g key={i} pointerEvents="none">
              <circle cx={p.x} cy={p.y} r={7} fill="#0a0d12" stroke="#fff" strokeWidth={2} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={800} fill="#fff">
                {m.label}
              </text>
            </g>
          );
        })}
        {s && (
          <g pointerEvents="none">
            <circle cx={s.x} cy={s.y} r={5} fill="none" stroke="var(--color-flare)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {probe && s && probeDart && (
        <div
          className="pointer-events-none absolute z-10 h-[116px] w-[116px] -translate-x-1/2 overflow-hidden rounded-full border-2 border-white/80 bg-bg shadow-2xl"
          style={{ left: probe.px.x, top: Math.max(0, probe.px.y - 150) }}
          aria-hidden
        >
          <svg viewBox={`${s.x - LOUPE_MM} ${s.y - LOUPE_MM} ${LOUPE_MM * 2} ${LOUPE_MM * 2}`} className="h-full w-full">
            <BoardGraphic showNumbers={false} />
            <TargetHighlight target={target} />
            <line x1={s.x - 6} x2={s.x + 6} y1={s.y} y2={s.y} stroke="var(--color-flare)" strokeWidth={0.8} />
            <line x1={s.x} x2={s.x} y1={s.y - 6} y2={s.y + 6} stroke="var(--color-flare)" strokeWidth={0.8} />
          </svg>
          <div className="absolute inset-x-0 bottom-1.5 text-center">
            <span className="rounded-md bg-black/75 px-1.5 py-0.5 font-display text-sm font-bold text-white">{dartLabel(probeDart)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
