import { CalendarDays, ChevronRight, Flame, Gauge, HeartPulse, Lightbulb, Play, RotateCcw, Sparkles, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useApp } from '../../data/store';
import { challengeDone, dailyChallenge, weeklyChallenge } from '../../domain/challenges';
import { insights, type Insight } from '../../domain/coach';
import { levelInfo, totalXp, trainingStreak, weeklyProgress } from '../../domain/gamification';
import { buildPlanSession, fastTrackSuggestion, PROGRAMS, stageStatus } from '../../domain/plan';
import { overview, sessionsInLastDays } from '../../domain/stats';
import { navigate } from '../router';
import { startChallenge, startPlanSession } from '../startSession';
import { Button, Card, Chip, cx, formatDuration, formatPct, ProgressBar, Ring, SectionTitle } from '../components/ui';

export function Dashboard() {
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const active = useApp((s) => s.active);
  const updateProfile = useApp((s) => s.updateProfile);

  const data = useMemo(() => {
    const now = Date.now();
    const analysis = insights(sessions, now);
    const status = stageStatus(profile, sessions);
    const planned = buildPlanSession(profile, sessions, 'preview', now);
    const xp = totalXp(sessions);
    return {
      analysis,
      status,
      planned,
      level: levelInfo(xp),
      xp,
      streak: trainingStreak(sessions, now),
      week: weeklyProgress(profile, sessions, now),
      daily: dailyChallenge(profile, sessions, now),
      weekly: weeklyChallenge(profile, sessions, now),
      last30: overview(sessionsInLastDays(sessions, 30, now)),
      fastTrack: fastTrackSuggestion(profile, sessions),
    };
  }, [profile, sessions]);

  const { analysis, status, planned, level } = data;
  const rec = planned.recommendation;
  const dailyDone = challengeDone(sessions, data.daily.id);
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const topInsights = analysis.insights.filter((i) => i.id !== 'welcome').slice(0, 3);

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between gap-4 pb-5 pt-2">
        <div>
          <p className="text-sm text-ink-3">{greet},</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
        </div>
        <button onClick={() => navigate('/profile')} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-1 py-1.5 pl-3 pr-1.5" aria-label={`Level ${level.level}, ${data.xp} XP`}>
          <div className="text-right">
            <div className="text-[11px] text-ink-3">Level {level.level}</div>
            <div className="text-sm font-semibold">{level.name}</div>
          </div>
          <Ring value={level.progress} size={44} stroke={5} tone="flare">
            <span className="num text-base">{level.level}</span>
          </Ring>
        </button>
      </header>

      {active && (
        <Card className="mb-4 flex items-center gap-3 border-flare/40 p-4" onClick={() => navigate('/session')} as="button">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-flare-soft text-flare">
            <RotateCcw size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Training fortsetzen</div>
            <div className="truncate text-sm text-ink-2">
              {active.title} · Phase {active.phaseIdx + 1}/{active.phases.length}
            </div>
          </div>
          <ChevronRight className="text-ink-3" />
        </Card>
      )}

      {/* Coach & heutiges Training */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0f2a1d] via-surface-1 to-surface-1 p-5" data-testid="today-card">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="flex items-center gap-2">
          <Chip tone="accent">
            <Sparkles size={12} /> Dein Coach
          </Chip>
          <Chip>
            {PROGRAMS[profile.plan.program].title} · {status.stage.title}
          </Chip>
        </div>
        <h2 className="mt-3 text-xl font-bold leading-snug">{planned.kind === 'assessment' ? planned.title : `Heute: ${planned.subtitle.split(' · ').slice(1).join(' · ')}`}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2" data-testid="coach-reason">
          {planned.kind === 'assessment' ? planned.subtitle : rec.focusReason} {planned.kind === 'plan' && rec.techniqueReason}
        </p>
        {rec.loadReason && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-sm text-info">
            <HeartPulse size={16} className="mt-0.5 shrink-0" /> {rec.loadReason}
          </p>
        )}
        <ol className="mt-4 grid gap-1.5">
          {planned.phases.map((p, i) => (
            <li key={p.id + i} className="flex items-center gap-3 text-sm">
              <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-3 text-xs">{i + 1}</span>
              <span className="flex-1 truncate">{p.title}</span>
              <span className="tabular text-ink-3">{p.minutes} Min.</span>
            </li>
          ))}
        </ol>
        <Button size="lg" block className="mt-5" onClick={startPlanSession} disabled={Boolean(active)} data-testid="start-plan">
          <Play size={18} /> {planned.kind === 'assessment' ? 'Test starten' : `Training starten · ${planned.minutes} Min.`}
        </Button>
      </section>

      {data.fastTrack && (
        <Card className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <Zap className="mt-0.5 shrink-0 text-flare" size={20} />
            <div className="flex-1">
              <p className="text-sm text-ink-2">{data.fastTrack}</p>
              <Button
                size="sm"
                variant="flare"
                className="mt-3"
                onClick={() => updateProfile((p) => ({ ...p, plan: { program: 'build', stage: 0, stageStartedAt: Date.now(), history: [...p.plan.history, { program: p.plan.program, stage: p.plan.stage, endedAt: Date.now(), reason: 'Wechsel nach starkem Eingangstest' }] } }))}
              >
                Zum Aufbau-Programm wechseln
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Woche & Plan */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="label">Diese Woche</div>
            {data.streak > 0 && (
              <Chip tone="flare">
                <Flame size={12} /> {data.streak} {data.streak === 1 ? 'Tag' : 'Tage'} in Folge
              </Chip>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="num text-4xl">{data.week.done}</span>
            <span className="text-ink-3">/ {data.week.goal} Einheiten</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
              <div key={d} className={cx('flex h-8 flex-1 items-center justify-center rounded-lg text-[11px] font-semibold', data.week.days.includes(i) ? 'bg-accent text-[#05170d]' : 'bg-surface-2 text-ink-3')}>
                {d}
              </div>
            ))}
          </div>
          {data.week.done >= data.week.goal && <p className="mt-3 text-sm text-accent">Wochenziel erreicht! Mehr ist nicht nötig – Erholung zählt auch.</p>}
        </Card>
        <Card className="p-4" onClick={() => navigate('/train?tab=plan')} as="button">
          <div className="flex items-center justify-between">
            <div className="label">Trainingsplan</div>
            <ChevronRight size={18} className="text-ink-3" />
          </div>
          <div className="mt-3 font-semibold">{status.stage.title}</div>
          <div className="mt-1 text-sm text-ink-2">
            {status.sessionsDone} von {status.sessionsRequired} Einheiten
            {status.stage.requirement.type !== 'none' && ` · ${status.progressText}`}
          </div>
          <ProgressBar className="mt-3" value={Math.min(1, status.sessionsDone / status.sessionsRequired) * (status.requirementMet ? 1 : 0.9)} />
          {profile.plan.program !== 'adaptive' && (
            <div className="mt-2 text-xs text-ink-3">
              Stufe {profile.plan.stage + 1} von {status.totalStages}
            </div>
          )}
        </Card>
      </div>

      {/* Challenges */}
      <SectionTitle action={<button onClick={() => navigate('/train?tab=challenges')} className="text-sm font-semibold text-ink-3">Alle</button>}>Challenges</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-flare" />
            <span className="label">Tageschallenge</span>
            {dailyDone && <Chip tone="accent">geschafft</Chip>}
          </div>
          <div className="mt-2 font-semibold">{data.daily.title}</div>
          <p className="mt-1 text-sm text-ink-2">{data.daily.goalText}</p>
          <Button size="sm" variant={dailyDone ? 'secondary' : 'flare'} className="mt-3" onClick={() => startChallenge(data.daily)} disabled={Boolean(active)} data-testid="start-daily">
            {dailyDone ? 'Nochmal versuchen' : 'Annehmen'}
          </Button>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-info" />
            <span className="label">Wochenchallenge</span>
            {data.weekly.done && <Chip tone="accent">geschafft</Chip>}
          </div>
          <div className="mt-2 font-semibold">{data.weekly.title}</div>
          <p className="mt-1 text-sm text-ink-2">{data.weekly.description}</p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={data.weekly.current / data.weekly.goal} tone="info" />
            <span className="shrink-0 text-sm tabular text-ink-2">
              {data.weekly.current}/{data.weekly.goal}
            </span>
          </div>
        </Card>
      </div>

      {/* Zahlen */}
      <SectionTitle action={<button onClick={() => navigate('/stats')} className="text-sm font-semibold text-ink-3">Statistik</button>}>Letzte 30 Tage</SectionTitle>
      {sessions.length === 0 ? (
        <Card className="p-5 text-sm text-ink-2">Noch keine Trainingsdaten. Nach deiner ersten Einheit siehst du hier Trainingstage, Darts und Trefferquote – ausschließlich aus deinen echten Würfen.</Card>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={<CalendarDays size={16} />} label="Trainingstage" value={String(data.last30.trainingDays)} sub={formatDuration(data.last30.activeMs)} />
          <MiniStat icon={<Target size={16} />} label="Darts" value={data.last30.darts.toLocaleString('de-DE')} sub={`${data.last30.sessions} Einheiten`} />
          <MiniStat icon={<Gauge size={16} />} label="Zieltreffer" value={formatPct(data.last30.target.rate)} sub={data.last30.target.attempts ? `bei ${data.last30.target.attempts} Darts` : 'noch keine'} />
        </div>
      )}

      {topInsights.length > 0 && (
        <>
          <SectionTitle>Erkenntnisse</SectionTitle>
          <div className="flex flex-col gap-3">
            {topInsights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-3">
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="truncate text-xs">{label}</span>
      </div>
      <div className="num mt-2 text-2xl">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

export function InsightCard({ insight }: { insight: Insight }) {
  const icon =
    insight.kind === 'positive' ? <TrendingUp size={18} /> : insight.kind === 'care' ? <HeartPulse size={18} /> : insight.kind === 'pattern' ? <Target size={18} /> : <Lightbulb size={18} />;
  const tone = insight.kind === 'positive' ? 'bg-accent-soft text-accent' : insight.kind === 'focus' ? 'bg-flare-soft text-flare' : insight.kind === 'care' ? 'bg-info-soft text-info' : 'bg-surface-3 text-ink-2';
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tone)}>{icon}</div>
        <div className="min-w-0">
          <div className="font-semibold">{insight.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{insight.text}</p>
          {insight.evidence && <p className="mt-1.5 text-xs text-ink-3">Datenbasis: {insight.evidence}</p>}
        </div>
      </div>
    </Card>
  );
}
