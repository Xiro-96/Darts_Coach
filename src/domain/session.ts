import { goalReached } from './challenges';
import { configKey, runDrill } from './drills/registry';
import { sessionXp } from './gamification';
import type { ActiveSession, DrillRecord, SessionPhase, SessionRecord } from './models';
import { isPersonalBest } from './stats';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createActiveSession(spec: Omit<ActiveSession, 'startedAt' | 'pausedMs' | 'phaseIdx' | 'progress'> & { startedAt?: number }): ActiveSession {
  return {
    ...spec,
    startedAt: spec.startedAt ?? Date.now(),
    pausedMs: 0,
    phaseIdx: 0,
    progress: spec.phases.map(() => ({ events: [] })),
  };
}

/** Aktive Trainingszeit ohne Pausen. */
export function activeMs(s: ActiveSession, now = Date.now()): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export function pause(s: ActiveSession, now = Date.now()): ActiveSession {
  return s.pausedAt ? s : { ...s, pausedAt: now };
}

export function resume(s: ActiveSession, now = Date.now()): ActiveSession {
  if (!s.pausedAt) return s;
  return { ...s, pausedMs: s.pausedMs + (now - s.pausedAt), pausedAt: undefined };
}

/** Wurde die App längere Zeit geschlossen, zählt die Zeit dazwischen als Pause. */
export function recoverAfterGap(s: ActiveSession, lastSeen: number, now = Date.now(), maxGapMs = 5 * 60 * 1000): ActiveSession {
  if (s.pausedAt || now - lastSeen < maxGapMs) return s;
  return { ...s, pausedAt: lastSeen };
}

export function phaseRun(phase: SessionPhase, s: ActiveSession, idx: number) {
  return runDrill(phase.config, s.progress[idx].events);
}

function toRecord(phase: SessionPhase, s: ActiveSession, idx: number): DrillRecord | null {
  const p = s.progress[idx];
  if (p.skipped || p.events.length === 0) return null;
  const run = runDrill(phase.config, p.events);
  return {
    drillId: phase.drillId,
    variantId: phase.variantId,
    configKey: configKey(phase.config),
    config: phase.config,
    phaseTitle: phase.title,
    events: p.events,
    throws: run.throws,
    result: run.result,
    startedAt: p.startedAt ?? s.startedAt,
    endedAt: p.endedAt ?? Date.now(),
  };
}

export interface FinalizeOutcome {
  record: SessionRecord;
  personalBests: DrillRecord[];
  xp: ReturnType<typeof sessionXp>;
}

/**
 * Wandelt die laufende Einheit in einen gespeicherten Datensatz um.
 * Optionale Phasen (Warm-up) zählen für "abgeschlossen" nicht mit.
 */
export function finalizeSession(s: ActiveSession, previous: SessionRecord[], now = Date.now()): FinalizeOutcome {
  const drills: DrillRecord[] = [];
  let mandatory = 0;
  let finishedMandatory = 0;
  s.phases.forEach((phase, i) => {
    const rec = toRecord(phase, s, i);
    if (rec) drills.push(rec);
    if (phase.optionalInput) return;
    mandatory++;
    if (rec?.result.completed) finishedMandatory++;
  });
  // Abgeschlossen = mindestens 3/4 der Pflichtphasen vollständig beendet
  const allDone = mandatory === 0 ? drills.length > 0 : finishedMandatory / mandatory >= 0.75;
  const pbs = drills.filter((d) => isPersonalBest(previous, d));
  const challengeSuccess = s.challenge ? drills.some((d) => goalReached(d.result, s.challenge!.goal)) : undefined;
  const base: SessionRecord = {
    id: s.id,
    kind: s.kind,
    title: s.title,
    startedAt: s.startedAt,
    endedAt: now,
    activeMs: activeMs(s, now),
    drills,
    completed: allDone && drills.length > 0,
    plan: s.plan,
    techniqueFocus: s.techniqueFocus,
    challengeId: s.challenge?.id,
    challengeSuccess,
    xp: 0,
  };
  const xp = sessionXp(base, previous, pbs.length);
  return { record: { ...base, xp: xp.total }, personalBests: pbs, xp };
}
