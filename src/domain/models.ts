import type { ChallengeGoal } from './challenges';
import type { TechniqueId } from './drills/catalog';
import type { DrillConfig, DrillEvent, DrillResult, ThrowRecord } from './drills/types';
import type { InputMode } from './types';

export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';
export type DartType = 'steel' | 'soft';
export type Hand = 'right' | 'left';
export type SessionMinutes = 10 | 20 | 30 | 45;
export type Goal = 'accuracy' | 'consistency' | 'scoring' | 'doubles' | 'checkout' | 'games';
export type TechniqueStatus = 'new' | 'working' | 'solid';
export type ProgramId = 'foundation' | 'build' | 'adaptive';

export interface RoutineStep {
  id: string;
  label: string;
  cue: string;
  seconds: number;
}

export interface DartSetup {
  weight?: string;
  barrel?: string;
  shaft?: string;
  flight?: string;
  grip?: string;
  standMark?: string;
  notes?: string;
}

export interface PlanState {
  program: ProgramId;
  stage: number;
  stageStartedAt: number;
  history: { program: ProgramId; stage: number; endedAt: number; reason: string }[];
}

export interface Profile {
  version: 1;
  name: string;
  createdAt: number;
  level: PlayerLevel;
  dartType: DartType;
  hand: Hand;
  sessionsPerWeek: number;
  sessionMinutes: SessionMinutes;
  goals: Goal[];
  stableThrow: 'yes' | 'unsure' | 'no';
  inputMode: InputMode;
  sound: boolean;
  voice: boolean;
  setup: DartSetup;
  routine: RoutineStep[];
  techniqueStatus: Partial<Record<TechniqueId, TechniqueStatus>>;
  techniqueNotes: Partial<Record<TechniqueId, string>>;
  plan: PlanState;
}

export type SessionKind = 'single' | 'plan' | 'assessment' | 'challenge';

/** Gespeichertes Ergebnis einer einzelnen Übung innerhalb einer Session. */
export interface DrillRecord {
  drillId: string;
  variantId: string;
  configKey: string;
  config: DrillConfig;
  phaseTitle?: string;
  events: DrillEvent[];
  throws: ThrowRecord[];
  result: DrillResult;
  startedAt: number;
  endedAt: number;
}

/** Abgeschlossene (oder vorzeitig beendete) Trainingseinheit. */
export interface SessionRecord {
  id: string;
  kind: SessionKind;
  title: string;
  startedAt: number;
  endedAt: number;
  /** Aktive Zeit ohne Pausen. */
  activeMs: number;
  drills: DrillRecord[];
  completed: boolean;
  plan?: { program: ProgramId; stage: number };
  techniqueFocus?: TechniqueId;
  challengeId?: string;
  challengeSuccess?: boolean;
  xp: number;
  notes?: string;
}

/** Eine Phase einer geführten Trainingseinheit. */
export interface SessionPhase {
  id: string;
  title: string;
  /** Was, wie und warum – der Coach-Text vor der Phase. */
  coach: string;
  drillId: string;
  variantId: string;
  config: DrillConfig;
  minutes: number;
  /** Warm-up: Eingabe optional, Phase kann nach Timer beendet werden. */
  optionalInput?: boolean;
}

export interface PhaseProgress {
  events: DrillEvent[];
  startedAt?: number;
  endedAt?: number;
  skipped?: boolean;
}

/** Laufende Einheit – wird bei jeder Eingabe gespeichert und nach einem Absturz wiederhergestellt. */
export interface ActiveSession {
  id: string;
  kind: SessionKind;
  title: string;
  subtitle?: string;
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
  phases: SessionPhase[];
  phaseIdx: number;
  progress: PhaseProgress[];
  plan?: { program: ProgramId; stage: number };
  techniqueFocus?: TechniqueId;
  challenge?: { id: string; goal: ChallengeGoal; text: string };
}

export const DEFAULT_ROUTINE: RoutineStep[] = [
  { id: 'stand', label: 'Stand', cue: 'Füße an die Markierung, Gewicht nach vorn', seconds: 2 },
  { id: 'grip', label: 'Griff', cue: 'Griff prüfen – locker, nicht klammern', seconds: 2 },
  { id: 'aim', label: 'Ziel', cue: 'Kleinen Punkt fixieren, ruhig atmen', seconds: 2 },
  { id: 'back', label: 'Ausholen', cue: 'Ruhig zurück, Ellbogen bleibt', seconds: 1 },
  { id: 'throw', label: 'Wurf', cue: 'Locker durchziehen und loslassen', seconds: 1 },
  { id: 'follow', label: 'Halten', cue: 'Hand zeigt aufs Ziel – kurz halten', seconds: 1 },
];
