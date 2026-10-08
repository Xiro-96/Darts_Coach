import { Bot, Clock, Info, Play, Star, Trophy } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../data/store';
import { BOT_LEVELS } from '../../domain/bot';
import { CATEGORY_INFO, findDrill, LEVEL_LABEL, SKILL_LABEL, defaultVariantFor, getVariant } from '../../domain/drills/catalog';
import { configKey } from '../../domain/drills/registry';
import type { DrillConfig } from '../../domain/drills/types';
import { hashString } from '../../domain/random';
import { drillHistory, personalBests } from '../../domain/stats';
import { getTechnique } from '../../domain/technique';
import { navigate } from '../router';
import { startSingleDrill } from '../startSession';
import { TrendChart } from '../charts/Charts';
import { Button, Card, Chip, cx, EmptyState, PageHeader, SectionTitle } from '../components/ui';

export function DrillDetail({ id }: { id: string }) {
  const def = findDrill(id);
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const active = useApp((s) => s.active);
  const [variantId, setVariantId] = useState(() => (def ? defaultVariantFor(def, profile.level === 'beginner').id : ''));
  const [x01, setX01] = useState(() => {
    const c = def ? defaultVariantFor(def, profile.level === 'beginner').make(1) : null;
    const g = c?.engine === 'x01' ? c.game : null;
    return { start: g?.start ?? 501, out: (g?.out === 'single' ? 'single' : 'double') as 'double' | 'single', doubleIn: false, legs: 1, bot: 0 };
  });

  const variant = def ? getVariant(def, variantId) : null;
  const config: DrillConfig | null = useMemo(() => {
    if (!def || !variant) return null;
    if (def.id !== 'x01') return variant.make(1);
    return {
      engine: 'x01',
      seed: 1,
      game: {
        start: x01.start,
        out: x01.out,
        in: x01.doubleIn ? 'double' : 'straight',
        legsToWin: x01.legs,
        players: x01.bot ? [{ name: 'Du' }, { name: `Bot · Stufe ${x01.bot}`, bot: { level: x01.bot } }] : [{ name: 'Du' }],
      },
    };
  }, [def, variant, x01]);

  const history = useMemo(() => (def && config ? drillHistory(sessions, def.id, configKey(config)) : []), [sessions, def, config]);

  if (!def || !variant || !config) {
    return <EmptyState icon={<Info />} title="Übung nicht gefunden" text="Diese Übung gibt es nicht." action={<Button onClick={() => navigate('/train')}>Zur Bibliothek</Button>} />;
  }

  const pbPoint = personalBests(sessions).find((p) => p.drillId === def.id && p.configKey === configKey(config)) ?? null;

  const start = () => {
    if (def.id === 'x01') startSingleDrill(def.id, variant.id, { ...(config as Extract<DrillConfig, { engine: 'x01' }>), seed: hashString(String(Date.now())) });
    else startSingleDrill(def.id, variant.id);
  };

  return (
    <div className="pb-6">
      <PageHeader title={def.name} subtitle={CATEGORY_INFO[def.category].label} backTo="/train" />
      <div className="flex flex-wrap gap-2">
        <Chip tone={def.level === 1 ? 'accent' : def.level === 2 ? 'info' : 'flare'}>{LEVEL_LABEL[def.level]}</Chip>
        <Chip>
          <Clock size={12} /> ca. {def.durationMin} Min.
        </Chip>
        {def.skills.map((s) => (
          <Chip key={s}>{SKILL_LABEL[s]}</Chip>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="label">Ziel der Übung</div>
        <p className="mt-1.5 text-lg font-semibold leading-snug">{def.goal}</p>
        <div className="label mt-4">Warum das hilft</div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{def.why}</p>
        {def.technique && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            Passend zum Technikthema <button className="font-semibold text-accent underline" onClick={() => navigate(`/technique/${def.technique}`)}>{getTechnique(def.technique).title}</button>
          </p>
        )}
      </Card>

      <SectionTitle>Variante</SectionTitle>
      <div className="grid gap-2" role="radiogroup" aria-label="Variante">
        {def.variants.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={v.id === variant.id}
            onClick={() => {
              setVariantId(v.id);
              const c = v.make(1);
              if (c.engine === 'x01') setX01((x) => ({ ...x, start: c.game.start, out: c.game.out === 'single' ? 'single' : 'double' }));
            }}
            className={cx('flex items-start justify-between gap-3 rounded-2xl border p-4 text-left', v.id === variant.id ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface-1')}
          >
            <span>
              <span className="block font-semibold">{v.label}</span>
              <span className="block text-sm text-ink-2">{v.description}</span>
            </span>
            {def.beginnerVariant === v.id && (
              <Chip tone="accent">
                <Star size={11} /> Einsteiger
              </Chip>
            )}
          </button>
        ))}
      </div>

      {def.id === 'x01' && (
        <>
          <SectionTitle>Spiel einstellen</SectionTitle>
          <Card className="flex flex-col gap-4 p-5">
            <Opt label="Startpunkte">
              {[101, 170, 301, 501].map((n) => (
                <Pill key={n} on={x01.start === n} onClick={() => setX01({ ...x01, start: n })}>
                  {n}
                </Pill>
              ))}
            </Opt>
            <Opt label="Out">
              <Pill on={x01.out === 'double'} onClick={() => setX01({ ...x01, out: 'double' })}>
                Double-Out
              </Pill>
              <Pill on={x01.out === 'single'} onClick={() => setX01({ ...x01, out: 'single' })}>
                Single-Out
              </Pill>
            </Opt>
            <Opt label="In">
              <Pill on={!x01.doubleIn} onClick={() => setX01({ ...x01, doubleIn: false })}>
                Straight-In
              </Pill>
              <Pill on={x01.doubleIn} onClick={() => setX01({ ...x01, doubleIn: true })}>
                Double-In
              </Pill>
            </Opt>
            <Opt label="Legs (First to)">
              {[1, 2, 3].map((n) => (
                <Pill key={n} on={x01.legs === n} onClick={() => setX01({ ...x01, legs: n })}>
                  {n}
                </Pill>
              ))}
            </Opt>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-ink-2">
                  <Bot size={16} /> Virtueller Gegner
                </span>
                <span className="text-ink-3">{x01.bot ? `Stufe ${x01.bot} · Ø ca. ${BOT_LEVELS[x01.bot - 1].approxAverage}` : 'aus'}</span>
              </div>
              <input type="range" min={0} max={10} value={x01.bot} onChange={(e) => setX01({ ...x01, bot: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" aria-label="Stärke des Gegners" />
              <p className="mt-1 text-xs text-ink-3">{x01.bot ? `${BOT_LEVELS[x01.bot - 1].label}. Der Bot wirft realistisch gestreut – auch er verfehlt Doppel.` : 'Ohne Gegner spielst du solo gegen die Uhr.'}</p>
            </div>
          </Card>
        </>
      )}

      <SectionTitle>Anleitung</SectionTitle>
      <Card className="p-5">
        <ol className="space-y-2.5">
          {def.howTo.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-3 text-xs">{i + 1}</span>
              <span className="text-ink-1">{s}</span>
            </li>
          ))}
        </ol>
        <div className="label mt-5">Regeln</div>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
          {def.rules.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {r}
            </li>
          ))}
        </ul>
        <div className="label mt-5">Auswertung</div>
        <p className="mt-2 text-sm text-ink-2">{def.metricInfo}</p>
      </Card>

      <SectionTitle>Dein Verlauf · {variant.label}</SectionTitle>
      {history.length === 0 ? (
        <Card className="p-5 text-sm text-ink-2">Noch keine vollständigen Durchgänge mit dieser Variante. Nach dem ersten Durchgang siehst du hier deinen Verlauf.</Card>
      ) : (
        <Card className="p-4">
          {pbPoint && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <Trophy size={16} className="text-flare" />
              <span className="text-ink-2">Bestwert:</span>
              <span className="font-semibold">{pbPoint.display}</span>
              <span className="text-ink-3">· {history.length} Durchgänge</span>
            </div>
          )}
          {history.length >= 2 ? (
            <TrendChart title={`Verlauf ${def.name}`} data={history.slice(-20).map((h) => ({ x: new Date(h.time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), y: Math.round(h.value * 10) / 10 }))} digits={1} />
          ) : (
            <p className="text-sm text-ink-3">Ein Durchgang: {history[0].display}. Ab zwei Durchgängen erscheint hier ein Verlauf.</p>
          )}
        </Card>
      )}

      <div className="sticky bottom-20 z-10 mt-6 md:bottom-4">
        <Button size="lg" block onClick={start} disabled={Boolean(active)} data-testid="start-drill">
          <Play size={18} /> {active ? 'Es läuft bereits ein Training' : 'Übung starten'}
        </Button>
      </div>
    </div>
  );
}

function Opt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cx('h-10 rounded-xl px-4 text-sm font-semibold', on ? 'bg-accent text-[#05170d]' : 'bg-surface-3 text-ink-2')}>
      {children}
    </button>
  );
}
