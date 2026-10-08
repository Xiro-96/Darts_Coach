import { Calculator, CheckCircle2, ChevronRight, Circle, ClipboardCheck, Clock, Lock, Play, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../data/store';
import { ASSESSMENT_MINUTES, completedAssessments } from '../../domain/assessment';
import { challengeDone, dailyChallenge, weeklyChallenge } from '../../domain/challenges';
import { CATEGORY_INFO, DRILLS, findDrill, LEVEL_LABEL, getVariant, type Category, type DrillDef } from '../../domain/drills/catalog';
import { completedRun } from '../../domain/gamification';
import { buildPlanSession, PROGRAMS, stageStatus } from '../../domain/plan';
import { personalBests } from '../../domain/stats';
import { navigate, useRoute } from '../router';
import { startAssessment, startChallenge, startPlanSession, startSingleDrill } from '../startSession';
import { Button, Card, Chip, cx, PageHeader, ProgressBar, Segmented, SectionTitle } from '../components/ui';

type Tab = 'plan' | 'library' | 'challenges';

export function Train() {
  const route = useRoute();
  const tab = (route.query.get('tab') as Tab) || 'library';
  const setTab = (t: Tab) => navigate(`/train?tab=${t}`, { replace: true });
  return (
    <div>
      <PageHeader title="Trainieren" subtitle="Empfohlenes Training starten oder eigene Übung wählen" />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        ariaLabel="Bereich"
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'library', label: 'Bibliothek' },
          { value: 'challenges', label: 'Challenges' },
        ]}
      />
      <div className="mt-5">
        {tab === 'plan' && <PlanTab />}
        {tab === 'library' && <LibraryTab />}
        {tab === 'challenges' && <ChallengesTab />}
      </div>
    </div>
  );
}

function PlanTab() {
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const active = useApp((s) => s.active);
  const status = useMemo(() => stageStatus(profile, sessions), [profile, sessions]);
  const planned = useMemo(() => buildPlanSession(profile, sessions, 'preview'), [profile, sessions]);
  const program = PROGRAMS[profile.plan.program];
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="label">Programm {program.title}</div>
        <p className="mt-1 text-sm text-ink-2">{program.description}</p>
        <Button size="lg" block className="mt-4" onClick={startPlanSession} disabled={Boolean(active)}>
          <Play size={18} /> {planned.kind === 'assessment' ? planned.title : 'Heutiges Training'} · {planned.minutes} Min.
        </Button>
      </Card>
      <ol className="flex flex-col gap-3" data-testid="plan-stages">
        {program.stages.map((s, i) => {
          const current = i === profile.plan.stage;
          const done = i < profile.plan.stage;
          return (
            <li key={s.title}>
              <Card className={cx('p-4', current && 'border-accent/50')}>
                <div className="flex items-start gap-3">
                  <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', done ? 'bg-accent text-[#05170d]' : current ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-ink-3')}>
                    {done ? <CheckCircle2 size={18} /> : current ? <Circle size={18} /> : <Lock size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-ink-2">{s.goal}</div>
                    {current && (
                      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-ink-3">Einheiten</span>
                          <span className="font-semibold tabular">
                            {status.sessionsDone} / {status.sessionsRequired}
                          </span>
                        </div>
                        <ProgressBar className="my-2" value={status.sessionsDone / status.sessionsRequired} />
                        <div className="text-ink-3">Kriterium: {status.requirementText}</div>
                        {status.progressText && <div className="mt-0.5 font-semibold">{status.progressText}</div>}
                        {status.requirementMet && status.sessionsDone < status.sessionsRequired && <div className="mt-1 text-accent">Kriterium erfüllt – noch {status.sessionsRequired - status.sessionsDone} Einheit(en).</div>}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      {profile.plan.history.length > 0 && (
        <>
          <SectionTitle>Verlauf</SectionTitle>
          <Card className="divide-y divide-line">
            {profile.plan.history.map((h, i) => (
              <div key={i} className="px-4 py-3 text-sm">
                <div className="font-semibold">{PROGRAMS[h.program].stages[h.stage]?.title}</div>
                <div className="text-ink-3">
                  {new Date(h.endedAt).toLocaleDateString('de-DE')} · {h.reason}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function LibraryTab() {
  const profile = useApp((s) => s.profile)!;
  const [level, setLevel] = useState<'all' | '1' | '2' | '3'>(profile.level === 'beginner' ? '1' : 'all');
  const cats = Object.keys(CATEGORY_INFO) as Category[];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-3">Niveau:</span>
        <div className="flex-1">
          <Segmented
            size="sm"
            value={level}
            onChange={setLevel}
            ariaLabel="Niveau"
            options={[
              { value: 'all', label: 'Alle' },
              { value: '1', label: 'Einsteiger' },
              { value: '2', label: 'Fortgeschr.' },
              { value: '3', label: 'Experte' },
            ]}
          />
        </div>
      </div>
      <Card className="mt-2 flex items-center gap-3 p-4" onClick={() => navigate('/checkout')} as="button">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info">
          <Calculator size={20} />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Checkout-Wege verstehen</div>
          <div className="text-sm text-ink-2">Rechner mit Erklärungen für jede Restpunktzahl</div>
        </div>
        <ChevronRight className="text-ink-3" />
      </Card>
      {cats.map((c) => {
        const list = DRILLS.filter((d) => d.category === c && (level === 'all' || d.level === Number(level)));
        if (!list.length) return null;
        return (
          <section key={c}>
            <SectionTitle>{CATEGORY_INFO[c].label}</SectionTitle>
            <p className="-mt-2 mb-3 text-sm text-ink-3">{CATEGORY_INFO[c].description}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((d) => (
                <DrillCard key={d.id} d={d} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function DrillCard({ d }: { d: DrillDef }) {
  return (
    <Card className="p-4" onClick={() => navigate(`/train/drill/${d.id}`)} as="button">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{d.name}</div>
        <Chip tone={d.level === 1 ? 'accent' : d.level === 2 ? 'info' : 'flare'}>{LEVEL_LABEL[d.level]}</Chip>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{d.goal}</p>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
        <Clock size={13} /> ca. {d.durationMin} Min.
      </div>
    </Card>
  );
}

function ChallengesTab() {
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const active = useApp((s) => s.active);
  const daily = useMemo(() => dailyChallenge(profile, sessions), [profile, sessions]);
  const weekly = useMemo(() => weeklyChallenge(profile, sessions), [profile, sessions]);
  const pbs = useMemo(() => personalBests(sessions).sort((a, b) => b.time - a.time).slice(0, 12), [sessions]);
  const run = completedRun(sessions);
  const tests = completedAssessments(sessions);
  return (
    <div className="flex flex-col gap-3">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-flare" />
          <span className="label">Tageschallenge</span>
          {challengeDone(sessions, daily.id) && <Chip tone="accent">geschafft</Chip>}
        </div>
        <div className="mt-2 text-lg font-bold">{daily.title}</div>
        <p className="mt-1 text-sm text-ink-2">{daily.goalText}</p>
        <p className="mt-1 text-xs text-ink-3">{daily.description}</p>
        <Button className="mt-4" variant="flare" onClick={() => startChallenge(daily)} disabled={Boolean(active)}>
          Challenge starten
        </Button>
      </Card>
      <Card className="p-5">
        <div className="label">Wochenchallenge</div>
        <div className="mt-2 text-lg font-bold">{weekly.title}</div>
        <p className="mt-1 text-sm text-ink-2">{weekly.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={weekly.current / weekly.goal} tone="info" />
          <span className="text-sm tabular">
            {weekly.current}/{weekly.goal}
          </span>
        </div>
      </Card>
      <Card className="p-5">
        <div className="label">Drei am Stück</div>
        <p className="mt-2 text-sm text-ink-2">Schließe drei Trainingseinheiten hintereinander vollständig ab.</p>
        <div className="mt-3 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx('h-3 flex-1 rounded-full', i < Math.min(3, run.current) ? 'bg-accent' : 'bg-surface-3')} />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Aktuell: {run.current} in Folge · Bestwert: {run.best}</p>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-info" />
          <span className="label">Fortschrittsprüfung</span>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          Der Leistungstest misst Gruppierung, große Singles, Zielwechsel, Doppel und Scoring – immer mit identischen Aufgaben. ca. {ASSESSMENT_MINUTES} Min.
        </p>
        <p className="mt-1 text-xs text-ink-3">{tests.length ? `${tests.length} Test(s) absolviert – Vergleich unter Statistik.` : 'Noch kein Test absolviert.'}</p>
        <Button className="mt-4" variant="secondary" onClick={startAssessment} disabled={Boolean(active)}>
          Leistungstest starten
        </Button>
      </Card>
      <SectionTitle>Rekord jagen</SectionTitle>
      {pbs.length === 0 ? (
        <Card className="p-5 text-sm text-ink-2">Sobald du Übungen vollständig gespielt hast, erscheinen hier deine Rekorde – zum direkten Neuversuch.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pbs.map((pb) => {
            const def = findDrill(pb.drillId);
            if (!def) return null;
            const session = sessions.find((s) => s.drills.some((d) => d.configKey === pb.configKey));
            const cfg = session?.drills.find((d) => d.configKey === pb.configKey)?.config;
            const variant = def.variants.find((v) => v.id === pb.variantId);
            return (
              <Card key={pb.drillId + pb.configKey} className="p-4">
                <div className="text-sm text-ink-3">{def.name}{variant ? ` · ${variant.label}` : ''}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="num text-3xl text-flare">{pb.display}</span>
                  <span className="text-xs text-ink-3">{pb.label}</span>
                </div>
                <Button size="sm" variant="secondary" className="mt-3" disabled={Boolean(active)} onClick={() => startSingleDrill(def.id, variant?.id ?? getVariant(def).id, cfg)}>
                  Rekord angreifen
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
