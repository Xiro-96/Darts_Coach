import { useApp } from '../data/store';
import { assessmentPhases } from '../domain/assessment';
import type { Challenge } from '../domain/challenges';
import { getDrill, getVariant } from '../domain/drills/catalog';
import type { DrillConfig } from '../domain/drills/types';
import { buildPlanSession } from '../domain/plan';
import { createActiveSession, newId } from '../domain/session';
import { hashString } from '../domain/random';
import { navigate } from './router';

function begin(a: Parameters<typeof createActiveSession>[0]): void {
  const st = useApp.getState();
  if (st.active) {
    st.showToast('Es läuft bereits ein Training – es wird fortgesetzt.', 'info');
    navigate('/session');
    return;
  }
  st.startSession(createActiveSession(a));
  navigate('/session');
}

/** Startet eine einzelne Übung aus der Bibliothek. */
export function startSingleDrill(drillId: string, variantId: string, config?: DrillConfig): void {
  const def = getDrill(drillId);
  const variant = getVariant(def, variantId);
  const id = newId();
  const cfg = config ? withFreshSeed(config, id) : variant.make(hashString(id));
  begin({
    id,
    kind: 'single',
    title: def.name,
    subtitle: variant.label,
    phases: [
      {
        id: 'main',
        title: def.name,
        coach: `${def.goal} ${def.why}`,
        drillId,
        variantId: variant.id,
        config: cfg,
        minutes: def.durationMin,
      },
    ],
    techniqueFocus: def.technique,
  });
}

function withFreshSeed(config: DrillConfig, id: string): DrillConfig {
  if (config.engine === 'checkout' && config.mode === 'random') return { ...config, seed: hashString(id) };
  if (config.engine === 'x01') return { ...config, seed: hashString(id) };
  return config;
}

/** Startet die vom Plan empfohlene Einheit. */
export function startPlanSession(): void {
  const { profile, sessions } = useApp.getState();
  if (!profile) return;
  const id = newId();
  const planned = buildPlanSession(profile, sessions, id);
  begin({
    id,
    kind: planned.kind,
    title: planned.title,
    subtitle: planned.subtitle,
    phases: planned.phases,
    plan: planned.plan,
    techniqueFocus: planned.techniqueFocus,
  });
}

export function startAssessment(): void {
  const { profile } = useApp.getState();
  begin({
    id: newId(),
    kind: 'assessment',
    title: 'Leistungstest',
    subtitle: 'Gruppierung, Singles, Zielwechsel, Doppel, Scoring',
    phases: assessmentPhases(),
    plan: profile ? { program: profile.plan.program, stage: profile.plan.stage } : undefined,
  });
}

export function startChallenge(c: Challenge): void {
  const def = getDrill(c.drillId);
  begin({
    id: newId(),
    kind: 'challenge',
    title: `Tageschallenge · ${c.title}`,
    phases: [{ id: 'challenge', title: c.title, coach: `${c.goalText} ${c.description}`, drillId: c.drillId, variantId: 'daily', config: c.config, minutes: def.durationMin }],
    challenge: { id: c.id, goal: c.goal, text: c.goalText },
  });
}
