import { Award, ChevronRight, RotateCcw, Sparkles, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../data/store';
import { nextDrillAfter } from '../../domain/coach';
import { findDrill, getVariant } from '../../domain/drills/catalog';
import { sessionXp } from '../../domain/gamification';
import type { SessionRecord } from '../../domain/models';
import { hasTarget, isPersonalBest, previousComparable, rate, sessionDarts } from '../../domain/stats';
import { navigate } from '../router';
import { startSingleDrill } from '../startSession';
import { Button, Card, Chip, cx, EmptyState, formatDuration, formatPct, Sheet, StatTile } from '../components/ui';

export function SessionSummary({ id }: { id: string }) {
  const sessions = useApp((s) => s.sessions);
  const last = useApp((s) => s.lastSummary);
  const deleteSession = useApp((s) => s.deleteSession);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const record = sessions.find((s) => s.id === id);
  if (!record) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <EmptyState icon={<Trophy />} title="Einheit nicht gefunden" text="Diese Trainingseinheit existiert nicht (mehr)." action={<Button onClick={() => navigate('/')}>Zum Dashboard</Button>} />
      </div>
    );
  }
  const previous = sessions.filter((s) => s.startedAt < record.startedAt);
  const fromStore = last?.record.id === id ? last : null;
  const pbs = fromStore ? fromStore.personalBests : record.drills.filter((d) => isPersonalBest(previous, d));
  const xp = fromStore?.xp ?? sessionXp(record, previous, pbs.length);
  const throws = record.drills.filter((d) => d.config.engine !== 'grouping' && d.config.engine !== 'follow').flatMap((d) => d.throws).filter(hasTarget);
  const hit = rate(throws.filter((t) => t.hit).length, throws.length);
  const main = [...record.drills].reverse().find((d) => findDrill(d.drillId) && d.result.completed && d.config.engine !== 'free' && d.config.engine !== 'focus') ?? record.drills[record.drills.length - 1];
  const next = main && findDrill(main.drillId) ? nextDrillAfter([...previous, record], main) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#123222] via-surface-1 to-surface-1 p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="label text-accent">{record.completed ? 'Training abgeschlossen' : 'Training gespeichert'}</div>
        <h1 className="mt-1 text-3xl font-bold" data-testid="summary-title">
          {record.completed ? 'Stark gemacht!' : 'Gut, dass du drangeblieben bist.'}
        </h1>
        <p className="mt-1 text-ink-2">{record.title}</p>
        {fromStore?.planMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 font-semibold text-accent">
            <Award size={20} /> {fromStore.planMessage}
          </div>
        )}
        {record.challengeId && (
          <div className={cx('mt-4 rounded-2xl px-4 py-3 font-semibold', record.challengeSuccess ? 'bg-flare-soft text-flare' : 'bg-surface-2 text-ink-2')}>
            {record.challengeSuccess ? 'Challenge geschafft!' : 'Challenge diesmal nicht geschafft – morgen gibt es eine neue.'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Trainingszeit" value={formatDuration(record.activeMs)} />
        <StatTile label="Geworfene Darts" value={sessionDarts(record)} />
        <StatTile label="Zieltreffer" value={formatPct(hit.rate)} sub={hit.attempts ? `${hit.hits} von ${hit.attempts}` : 'keine Zielwürfe'} tone="accent" />
        <StatTile label="XP" value={`+${xp.total}`} tone="flare" sub={`${pbs.length} Rekord${pbs.length === 1 ? '' : 'e'}`} />
      </div>

      <h2 className="label mb-3 mt-7">Übungen</h2>
      <div className="flex flex-col gap-3">
        {record.drills.map((d, i) => (
          <DrillResultCard key={i} d={d} previous={previous} pb={pbs.includes(d)} />
        ))}
      </div>

      {next && (
        <>
          <h2 className="label mb-3 mt-7">Empfehlung des Coaches</h2>
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="font-semibold">
                  Nächste Übung: {findDrill(next.drillId)?.name} · {getVariant(findDrill(next.drillId)!, next.variantId).label}
                </div>
                <p className="mt-1 text-sm text-ink-2" data-testid="coach-next">
                  {next.reason}
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      <h2 className="label mb-3 mt-7">Erfahrungspunkte</h2>
      <Card className="divide-y divide-line">
        {xp.lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-ink-2">{l.label}</span>
            <span className="font-semibold text-flare">+{l.xp}</span>
          </div>
        ))}
        {xp.lines.length === 0 && <div className="px-5 py-3 text-sm text-ink-3">Keine XP für diese Einheit.</div>}
      </Card>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <Button block onClick={() => navigate('/')}>
          Zum Dashboard
        </Button>
        {record.kind === 'single' && main && (
          <Button block variant="secondary" onClick={() => startSingleDrill(main.drillId, main.variantId, main.config)}>
            <RotateCcw size={18} /> Nochmal
          </Button>
        )}
      </div>
      <button onClick={() => setConfirmDelete(true)} className="mx-auto mt-6 flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-bad">
        <Trash2 size={14} /> Einheit löschen
      </button>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Einheit löschen?">
        <p className="mb-4 text-sm text-ink-2">Die Einheit wird aus allen Statistiken entfernt. Das ist sinnvoll, wenn du versehentlich falsche Daten erfasst hast.</p>
        <Button
          block
          variant="danger"
          onClick={async () => {
            await deleteSession(record.id);
            navigate('/profile/history', { replace: true });
          }}
        >
          Endgültig löschen
        </Button>
      </Sheet>
    </div>
  );
}

function DrillResultCard({ d, previous, pb }: { d: SessionRecord['drills'][number]; previous: SessionRecord[]; pb: boolean }) {
  const def = findDrill(d.drillId);
  const prev = previousComparable(previous, d);
  const p = d.result.primary;
  let delta: { text: string; good: boolean } | null = null;
  if (prev && p.value !== null && d.result.completed) {
    const diff = p.value - prev.value;
    if (Math.abs(diff) > 1e-9) {
      const good = p.higherIsBetter ? diff > 0 : diff < 0;
      const unit = p.unit === '%' ? ' %-Pkt.' : p.unit === 'cm' ? ' cm' : '';
      delta = { text: `${diff > 0 ? '+' : ''}${p.unit === 'cm' ? diff.toFixed(1).replace('.', ',') : Math.round(diff)}${unit} ggü. letztem Mal (${prev.display})`, good };
    } else delta = { text: `gleich wie letztes Mal (${prev.display})`, good: true };
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink-3">{d.phaseTitle ?? def?.name}</div>
          <div className="font-semibold">{def?.name ?? d.drillId}</div>
        </div>
        {pb && (
          <Chip tone="flare">
            <Trophy size={12} /> Rekord
          </Chip>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-ink-3">{p.label}</div>
          <div className="num text-3xl">{p.display}</div>
        </div>
        {def && (
          <button onClick={() => navigate(`/train/drill/${def.id}`)} className="flex items-center text-sm font-semibold text-ink-3 hover:text-ink-1">
            Übung <ChevronRight size={16} />
          </button>
        )}
      </div>
      {delta && <div className={cx('mt-2 text-sm', delta.good ? 'text-good' : 'text-ink-2')}>{delta.text}</div>}
      {!d.result.completed && <div className="mt-2 text-sm text-flare">Vorzeitig beendet</div>}
      <ul className="mt-3 space-y-0.5 text-sm text-ink-2">
        {d.result.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Card>
  );
}
