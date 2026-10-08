import { Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BOGEY_NUMBERS, checkoutRoutes, explainRoute, setupAdvice, type OutMode } from '../../domain/checkout';
import { Card, Chip, cx, inputClass, PageHeader, SectionTitle, Segmented } from '../components/ui';

export function CheckoutCalc() {
  const [score, setScore] = useState(57);
  const [darts, setDarts] = useState<'1' | '2' | '3'>('3');
  const [out, setOut] = useState<OutMode>('double');
  const routes = useMemo(() => checkoutRoutes(score, Number(darts), out).slice(0, 5), [score, darts, out]);
  const advice = routes.length === 0 ? setupAdvice(score) : null;
  const bogey = (BOGEY_NUMBERS as readonly number[]).includes(score);

  return (
    <div className="pb-8">
      <PageHeader title="Checkout-Wege" subtitle="Für jede Restpunktzahl den besten Weg – mit Erklärung" backTo="/train" />
      <Card className="p-5">
        <label className="block">
          <span className="label">Restpunktzahl</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={score}
            onChange={(e) => setScore(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
            className={cx(inputClass, 'num mt-2 h-16 text-center text-4xl')}
            aria-label="Restpunktzahl"
          />
        </label>
        <input type="range" min={2} max={170} value={Math.min(170, score)} onChange={(e) => setScore(Number(e.target.value))} className="mt-3 w-full accent-[var(--color-accent)]" aria-label="Restpunktzahl wählen" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Segmented
            size="sm"
            value={darts}
            onChange={setDarts}
            ariaLabel="Darts übrig"
            options={[
              { value: '1', label: '1 Dart' },
              { value: '2', label: '2 Darts' },
              { value: '3', label: '3 Darts' },
            ]}
          />
          <Segmented
            size="sm"
            value={out}
            onChange={setOut}
            ariaLabel="Out-Modus"
            options={[
              { value: 'double', label: 'Double-Out' },
              { value: 'single', label: 'Single-Out' },
            ]}
          />
        </div>
      </Card>

      <SectionTitle>Empfohlene Wege</SectionTitle>
      {routes.length === 0 ? (
        <Card className="p-5">
          <p className="font-semibold">{bogey && darts === '3' && out === 'double' ? `${score} ist eine „Bogey-Zahl“ – mit drei Darts nicht checkbar.` : `${score} ist mit ${darts} Dart${darts === '1' ? '' : 's'} nicht checkbar.`}</p>
          {advice && (
            <p className="mt-2 text-sm text-ink-2">
              Stell dir ein Doppel: Mit <strong className="text-ink-1">{advice.label}</strong> bleiben <strong className="text-ink-1">{advice.leave}</strong> Rest (D{advice.leave / 2}).
            </p>
          )}
          {score > 60 && !advice && <p className="mt-2 text-sm text-ink-2">Punkte machen (z. B. T20) und eine checkbare Zahl übrig lassen.</p>}
        </Card>
      ) : (
        <div className="flex flex-col gap-2" data-testid="routes">
          {routes.map((r, i) => (
            <Card key={r.labels.join()} className={cx('p-4', i === 0 && 'border-accent/50')}>
              <div className="flex items-center gap-2">
                {r.labels.map((l, j) => (
                  <span key={j} className={cx('num rounded-xl px-3 py-1.5 text-2xl', j === r.labels.length - 1 ? 'bg-accent-soft text-accent' : 'bg-surface-3')}>
                    {l}
                  </span>
                ))}
                {i === 0 && (
                  <Chip tone="accent" className="ml-auto">
                    Empfehlung
                  </Chip>
                )}
              </div>
              {i === 0 && out === 'double' && <p className="mt-3 text-sm text-ink-2">{explainRoute(score, r)}</p>}
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Grundwissen Double-Out</SectionTitle>
      <Card className="p-5">
        <ul className="space-y-3 text-sm text-ink-2">
          {[
            'Der letzte Dart muss ein Doppel treffen (Bullseye zählt als Doppel 25).',
            'Gerade Restwerte bis 40 sind direkte Doppel: 32 = D16, 40 = D20.',
            'Ungerade Restwerte brauchen zuerst eine ungerade Single: 37 = S5 + D16.',
            'Rest 1 ist ein Bust – genau wie Überwerfen oder 0 ohne Doppel. Die Aufnahme zählt dann nicht.',
            'Lieblingsdoppel: D16 und D20. D16 lässt sich bei Single-Treffern halbieren (D8, D4 …).',
            'Höchstes Finish: 170 = T20 T20 Bull. Nicht checkbar mit drei Darts: 159, 162, 163, 165, 166, 168, 169.',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-flare" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
