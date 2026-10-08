import { Delete, Grid3x3, Hash, Target as TargetIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { dartLabel, makeDart } from '../../domain/board';
import type { DrillView } from '../../domain/drills/types';
import type { Dart, InputMode, Multiplier } from '../../domain/types';
import { Dartboard } from '../board/Dartboard';
import { cx } from '../components/ui';

type Mode = InputMode | 'total';

/**
 * Treffererfassung: Scheibe (mit Position), Tasten (schnell) oder Aufnahme-Summe.
 * Optimiert für ein Smartphone, das neben dem Board liegt: große Flächen, wenige Klicks.
 */
export function ThrowInput({
  view,
  defaultMode,
  onDart,
  onVisitTotal,
  markers,
  disabled,
}: {
  view: DrillView;
  defaultMode: InputMode;
  onDart: (d: Dart) => void;
  onVisitTotal?: (score: number) => void;
  markers?: { p: { x: number; y: number }; label: string }[];
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(view.preferBoard ? 'board' : defaultMode);
  const effective: Mode = mode === 'total' && !view.allowVisitTotal ? 'buttons' : mode;

  const tabs: { id: Mode; label: string; icon: ReactNode }[] = [
    { id: 'board', label: 'Scheibe', icon: <TargetIcon size={16} /> },
    { id: 'buttons', label: 'Tasten', icon: <Grid3x3 size={16} /> },
  ];
  if (view.allowVisitTotal && onVisitTotal) tabs.push({ id: 'total', label: 'Summe', icon: <Hash size={16} /> });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-2xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Eingabeart">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={effective === t.id}
            onClick={() => setMode(t.id)}
            className={cx(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold',
              effective === t.id ? 'bg-surface-3 text-ink-1' : 'text-ink-3',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {view.preferBoard && effective !== 'board' && (
        <p className="rounded-xl bg-flare-soft px-3 py-2 text-xs text-flare">Für die Gruppenmessung bitte über die Scheibe erfassen – sonst fragt die App nach einer Selbsteinschätzung.</p>
      )}
      {effective === 'board' && (
        <div className="flex flex-col items-center gap-2">
          <Dartboard target={view.target} markers={markers} onDart={onDart} disabled={disabled} className="aspect-square w-full max-w-[min(92vw,460px)]" />
          <button
            onClick={() => onDart(makeDart(0, 0))}
            disabled={disabled}
            className="h-11 w-full max-w-[460px] rounded-2xl border border-line bg-surface-2 text-sm font-semibold text-ink-2 active:scale-[0.98]"
          >
            Daneben / Bounce-out (ohne Position)
          </button>
        </div>
      )}
      {effective === 'buttons' && <Keypad quick={view.quick ?? []} onDart={onDart} disabled={disabled} />}
      {effective === 'total' && onVisitTotal && <TotalPad onSubmit={onVisitTotal} disabled={disabled} />}
    </div>
  );
}

export function Keypad({ quick, onDart, disabled }: { quick: Dart[]; onDart: (d: Dart) => void; disabled?: boolean }) {
  const [full, setFull] = useState(quick.length === 0);
  const [mult, setMult] = useState<Multiplier>(1);
  const tap = (d: Dart) => {
    navigator.vibrate?.(8);
    onDart(d);
    setMult(1);
  };
  return (
    <div className="flex flex-col gap-3">
      {quick.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="quick-buttons">
          {quick.map((d, i) => (
            <button
              key={`${d.n}-${d.m}-${i}`}
              disabled={disabled}
              onClick={() => tap(d)}
              className={cx(
                'num h-16 rounded-2xl border text-2xl transition-transform active:scale-95',
                d.m === 0 ? 'border-line bg-surface-2 text-ink-2' : d.m === 3 ? 'border-flare/30 bg-flare-soft text-flare' : d.m === 2 ? 'border-info/30 bg-info-soft text-info' : 'border-line bg-surface-3 text-ink-1',
              )}
            >
              {dartLabel(d)}
            </button>
          ))}
        </div>
      )}
      {quick.length > 0 && (
        <button onClick={() => setFull((v) => !v)} className="text-sm font-semibold text-ink-3 hover:text-ink-2">
          {full ? 'Alle Felder ausblenden' : 'Alle Felder anzeigen'}
        </button>
      )}
      {full && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as Multiplier[]).map((m) => (
              <button
                key={m}
                onClick={() => setMult(m)}
                aria-pressed={mult === m}
                className={cx(
                  'h-11 rounded-xl text-sm font-bold',
                  mult === m ? (m === 3 ? 'bg-flare text-[#1d0d02]' : m === 2 ? 'bg-info text-[#04121f]' : 'bg-ink-1 text-bg') : 'bg-surface-2 text-ink-2',
                )}
              >
                {m === 1 ? 'Single' : m === 2 ? 'Double' : 'Triple'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <button key={n} disabled={disabled} onClick={() => tap(makeDart(n, mult))} className="num h-12 rounded-xl bg-surface-3 text-xl active:scale-95">
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button disabled={disabled || mult === 3} onClick={() => tap(makeDart(25, 1))} className="h-12 rounded-xl bg-[rgb(29_138_77/0.25)] font-bold text-good">
              25
            </button>
            <button disabled={disabled || mult === 3} onClick={() => tap(makeDart(25, 2))} className="h-12 rounded-xl bg-bad-soft font-bold text-bad">
              BULL
            </button>
            <button disabled={disabled} onClick={() => tap(makeDart(0, 0))} className="h-12 rounded-xl bg-surface-2 font-bold text-ink-2">
              Miss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const COMMON = [26, 41, 45, 60, 81, 85, 100, 140];

export function TotalPad({ onSubmit, disabled, max = 180 }: { onSubmit: (score: number) => void; disabled?: boolean; max?: number }) {
  const [val, setVal] = useState('');
  const num = val === '' ? null : Number(val);
  const invalid = num !== null && num > max;
  const push = (d: string) => setVal((v) => (v.length >= 3 ? v : v === '0' ? d : v + d));
  const submit = (v: number | null) => {
    if (v === null || v > max) return;
    onSubmit(v);
    setVal('');
  };
  return (
    <div className="flex flex-col gap-2" data-testid="total-pad">
      <div className={cx('num flex h-16 items-center justify-center rounded-2xl border bg-surface-2 text-4xl', invalid ? 'border-bad text-bad' : 'border-line')}>
        {val || <span className="text-ink-3">0</span>}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {COMMON.map((c) => (
          <button key={c} onClick={() => submit(c)} disabled={disabled} className="num h-10 shrink-0 rounded-xl bg-surface-3 px-3 text-lg">
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => push(d)} className="num h-14 rounded-xl bg-surface-3 text-2xl active:scale-95">
            {d}
          </button>
        ))}
        <button onClick={() => setVal((v) => v.slice(0, -1))} aria-label="Löschen" className="grid h-14 place-items-center rounded-xl bg-surface-2 text-ink-2">
          <Delete size={22} />
        </button>
        <button onClick={() => push('0')} className="num h-14 rounded-xl bg-surface-3 text-2xl">
          0
        </button>
        <button onClick={() => submit(num ?? 0)} disabled={disabled || invalid} className="h-14 rounded-xl bg-accent font-bold text-[#05170d] disabled:opacity-40">
          OK
        </button>
      </div>
    </div>
  );
}
