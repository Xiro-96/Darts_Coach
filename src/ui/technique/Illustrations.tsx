/** Schematische Draufsicht der Standpositionen (vereinfacht, nicht maßstabsgetreu). */
export function StanceIllustration({ hand }: { hand: 'right' | 'left' }) {
  const flip = hand === 'left' ? -1 : 1;
  const stances = [
    { title: 'Seitlich', angle: 80 },
    { title: 'Mittel (45°)', angle: 45 },
    { title: 'Frontal', angle: 10 },
  ];
  return (
    <figure>
      <div className="grid grid-cols-3 gap-2">
        {stances.map((s) => (
          <svg key={s.title} viewBox="-60 -70 120 140" className="h-auto w-full rounded-xl bg-surface-2" role="img" aria-label={`Standposition ${s.title}`}>
            {/* Scheibe oben */}
            <circle cx={0} cy={-58} r={8} fill="var(--color-board-red)" />
            <line x1={0} y1={-50} x2={0} y2={10} stroke="var(--color-ink-3)" strokeDasharray="2 3" strokeWidth={0.8} />
            {/* Abwurflinie */}
            <line x1={-55} x2={55} y1={14} y2={14} stroke="var(--color-flare)" strokeWidth={2} />
            <g transform={`translate(0 34) rotate(${flip * s.angle})`}>
              {/* Schultern */}
              <ellipse cx={0} cy={0} rx={22} ry={8} fill="var(--color-surface-3)" stroke="var(--color-ink-3)" strokeWidth={0.8} />
              {/* vorderer Fuß (Wurfseite) */}
              <ellipse cx={flip * 12} cy={-10} rx={5} ry={10} fill="var(--color-accent)" transform={`rotate(${-flip * s.angle} ${flip * 12} -10)`} />
              {/* hinterer Fuß */}
              <ellipse cx={-flip * 14} cy={10} rx={5} ry={10} fill="var(--color-ink-3)" />
            </g>
          </svg>
        ))}
      </div>
      <figcaption className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-ink-2">
        {stances.map((s) => (
          <span key={s.title}>{s.title}</span>
        ))}
      </figcaption>
      <p className="mt-2 text-xs text-ink-3">Grün = Fuß der Wurfseite vorn an der Linie, Gewicht überwiegend darauf. Vereinfachte Skizze.</p>
    </figure>
  );
}
