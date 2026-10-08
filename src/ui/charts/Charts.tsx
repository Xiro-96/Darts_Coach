import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Point } from '../../domain/types';
import { BoardGraphic, toSvg, VIEW_R } from '../board/BoardGraphic';

/**
 * Diagramme im Stil der App: dünne Linien (2 px), Marker ≥ 8 px, zurückhaltende
 * Gitterlinien, Werte im Tooltip und als Tabelle (Screenreader).
 */

export interface TrendPoint {
  x: string;
  y: number | null;
  /** Stichprobengröße (z. B. Darts) – erscheint im Tooltip. */
  n?: number;
  nLabel?: string;
}

const axisTick = { fill: 'var(--color-ink-3)', fontSize: 11 };

function TooltipBox({ active, payload, label, unit, digits }: { active?: boolean; payload?: { value: number; payload: TrendPoint }[]; label?: string; unit?: string; digits: number }) {
  if (!active || !payload?.length || payload[0].value === null || payload[0].value === undefined) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-xl">
      <div className="num text-xl text-ink-1">
        {payload[0].value.toLocaleString('de-DE', { maximumFractionDigits: digits })}
        {unit ? ` ${unit}` : ''}
      </div>
      <div className="text-xs text-ink-2">{label}</div>
      {p.n !== undefined && <div className="text-xs text-ink-3">{p.nLabel ?? `${p.n} Darts`}</div>}
    </div>
  );
}

export function TrendChart({
  data,
  unit,
  digits = 0,
  height = 180,
  domain,
  title,
  color = 'var(--color-series-1)',
}: {
  data: TrendPoint[];
  unit?: string;
  digits?: number;
  height?: number;
  domain?: [number | 'auto', number | 'auto'];
  title: string;
  color?: string;
}) {
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1} />
            <XAxis dataKey="x" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--color-axis)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={domain ?? ['auto', 'auto']} allowDecimals={digits > 0} width={48} />
            <Tooltip content={<TooltipBox unit={unit} digits={digits} />} cursor={{ stroke: 'var(--color-ink-3)', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="y"
              stroke={color}
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: color, stroke: 'var(--color-surface-1)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: color, stroke: 'var(--color-surface-1)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.x}>
                <th>{d.x}</th>
                <td>{d.y === null ? 'keine Daten' : `${d.y.toFixed(digits)}${unit ? ` ${unit}` : ''}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  n: number;
  display: string;
}

/** Horizontale Balken (z. B. Trefferquote je Zielfeld). */
export function HBarChart({ data, title, max = 100 }: { data: BarDatum[]; title: string; max?: number }) {
  const height = Math.max(120, data.length * 34 + 20);
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--color-grid)" />
            <XAxis type="number" domain={[0, max]} hide />
            <YAxis type="category" dataKey="label" tick={{ ...axisTick, fill: 'var(--color-ink-2)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--color-axis)' }} width={64} />
            <Tooltip
              cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-surface-3 px-3 py-2 shadow-xl">
                    <div className="num text-xl">{(payload[0].payload as BarDatum).display}</div>
                    <div className="text-xs text-ink-2">{(payload[0].payload as BarDatum).label}</div>
                    <div className="text-xs text-ink-3">{(payload[0].payload as BarDatum).n} Darts</div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="value" fill="var(--color-series-1)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              <LabelList dataKey="display" position="right" fill="var(--color-ink-2)" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th>{d.label}</th>
                <td>
                  {d.display} ({d.n} Darts)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Heatmap auf der Scheibe: jeder Dart als halbtransparenter Punkt; Dichte entsteht durch Überlagerung. */
export function BoardHeatmap({ points, centroid, size = 320 }: { points: Point[]; centroid?: Point | null; size?: number }) {
  const r = points.length > 400 ? 3 : points.length > 150 ? 4 : 5;
  const opacity = points.length > 400 ? 0.18 : points.length > 150 ? 0.28 : 0.45;
  return (
    <figure className="mx-auto" style={{ maxWidth: size }}>
      <svg viewBox={`${-VIEW_R} ${-VIEW_R} ${VIEW_R * 2} ${VIEW_R * 2}`} className="h-auto w-full" role="img" aria-label={`Heatmap mit ${points.length} erfassten Positionen`}>
        <BoardGraphic dim />
        {points.map((p, i) => {
          const s = toSvg(p);
          return <circle key={i} cx={s.x} cy={s.y} r={r} fill="var(--color-flare)" opacity={opacity} />;
        })}
        {centroid && (
          <g>
            <circle cx={toSvg(centroid).x} cy={toSvg(centroid).y} r={7} fill="none" stroke="#fff" strokeWidth={2.5} />
            <circle cx={toSvg(centroid).x} cy={toSvg(centroid).y} r={2} fill="#fff" />
          </g>
        )}
      </svg>
    </figure>
  );
}

/** Streubild relativ zum Zielpunkt (Mitte = Zielpunkt). */
export function OffsetPlot({ offsets, bias, size = 260 }: { offsets: Point[]; bias?: { dx: number; dy: number } | null; size?: number }) {
  const R = 60; // ±6 cm Ausschnitt
  return (
    <figure className="mx-auto" style={{ maxWidth: size }}>
      <svg viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} className="h-auto w-full rounded-2xl bg-surface-2" role="img" aria-label="Abweichung vom Zielpunkt">
        {[20, 40].map((c) => (
          <circle key={c} r={c} fill="none" stroke="var(--color-grid)" strokeWidth={0.6} />
        ))}
        <line x1={-R} x2={R} y1={0} y2={0} stroke="var(--color-axis)" strokeWidth={0.5} />
        <line y1={-R} y2={R} x1={0} x2={0} stroke="var(--color-axis)" strokeWidth={0.5} />
        {offsets.map((o, i) => {
          const x = Math.max(-R + 2, Math.min(R - 2, o.x));
          const y = Math.max(-R + 2, Math.min(R - 2, -o.y));
          return <circle key={i} cx={x} cy={y} r={1.8} fill="var(--color-series-1)" opacity={0.55} />;
        })}
        {bias && <circle cx={bias.dx} cy={-bias.dy} r={3} fill="none" stroke="var(--color-flare)" strokeWidth={1.2} />}
        <text x={R - 2} y={-R + 7} textAnchor="end" fontSize={5} fill="var(--color-ink-3)">
          Ring = 2 / 4 cm
        </text>
      </svg>
    </figure>
  );
}
