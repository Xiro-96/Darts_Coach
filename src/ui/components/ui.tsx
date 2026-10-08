import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { back } from '../router';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'flare';

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-[transform,background,opacity] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 select-none';
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-12 px-5 text-[15px]', lg: 'h-14 px-6 text-base' };
  const variants: Record<Variant, string> = {
    primary: 'bg-accent text-[#05170d] hover:bg-[#45dc8d] shadow-[0_8px_24px_-12px_rgb(52_209_127/0.7)]',
    secondary: 'bg-surface-3 text-ink-1 hover:bg-[#283442] border border-line',
    ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink-1',
    danger: 'bg-bad-soft text-bad hover:bg-[rgb(239_83_80/0.22)]',
    flare: 'bg-flare text-[#1d0d02] hover:bg-[#ff9a57]',
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], block && 'w-full', className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({ className, children, onClick, as = 'div' }: { className?: string; children: ReactNode; onClick?: () => void; as?: 'div' | 'button' | 'section' }) {
  const Comp = as;
  return (
    <Comp
      onClick={onClick}
      className={cx('card', onClick && 'text-left transition-transform duration-150 active:scale-[0.99] hover:border-line-strong w-full', className)}
    >
      {children}
    </Comp>
  );
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'flare' | 'info' | 'bad'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    accent: 'bg-accent-soft text-accent',
    flare: 'bg-flare-soft text-flare',
    info: 'bg-info-soft text-info',
    bad: 'bg-bad-soft text-bad',
  };
  return <span className={cx('inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, backTo, right }: { title: string; subtitle?: string; backTo?: string | true; right?: ReactNode }) {
  return (
    <header className="flex items-start gap-3 pb-4 pt-2">
      {backTo && (
        <button aria-label="Zurück" onClick={() => back(typeof backTo === 'string' ? backTo : '/')} className="-ml-2 mt-0.5 grid h-10 w-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2">
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="label">{children}</h2>
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', className }: { value: number; tone?: 'accent' | 'flare' | 'info'; className?: string }) {
  const color = tone === 'accent' ? 'bg-accent' : tone === 'flare' ? 'bg-flare' : 'bg-info';
  const track = tone === 'accent' ? 'bg-accent-soft' : tone === 'flare' ? 'bg-flare-soft' : 'bg-info-soft';
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full', track, className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, children, tone = 'accent' }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'accent' | 'flare' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === 'accent' ? 'var(--color-accent)' : 'var(--color-flare)';
  const track = tone === 'accent' ? 'var(--color-accent-soft)' : 'var(--color-flare-soft)';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'flare' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-4">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className={cx('num mt-1.5 text-[32px]', tone === 'accent' && 'text-accent', tone === 'flare' && 'text-flare')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', ariaLabel }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; ariaLabel?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex rounded-2xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl font-semibold transition-colors',
            size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
            o.value === value ? 'bg-surface-3 text-ink-1 shadow' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="card relative max-h-[90dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-b-none p-5 safe-bottom sm:rounded-b-[var(--radius-card)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          <button aria-label="Schließen" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-surface-2">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-3 text-ink-2">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-ink-3">{description}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3')}
      >
        <span className={cx('absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-ink-1 placeholder:text-ink-3 focus:border-accent focus:outline-none';

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  return `${h} Std. ${min % 60} Min.`;
}

export function formatDate(t: number, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  return new Date(t).toLocaleDateString('de-DE', opts);
}

export function formatPct(v: number | null, digits = 0): string {
  if (v === null || Number.isNaN(v)) return '–';
  return `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: digits })} %`;
}

export function formatNum(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
