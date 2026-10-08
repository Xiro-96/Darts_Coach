import { assessmentPhases, ASSESSMENT_MINUTES, completedAssessments } from './assessment';
import { recommend, skillSnapshots, type Recommendation } from './coach';
import { getDrill, SKILL_LABEL, type Skill, type TechniqueId } from './drills/catalog';
import type { DrillConfig } from './drills/types';
import type { Profile, ProgramId, SessionMinutes, SessionPhase, SessionRecord } from './models';
import { createRng, hashString, pick } from './random';
import { mean } from './statistics';
import { allThrows, DAY_MS, groupSizesFrom, hasTarget } from './stats';
import { getTechnique } from './technique';
import type { Target } from './types';

/**
 * Persönlicher Trainingsplan. Der Plan ist in Stufen (≈ Wochen) gegliedert, der
 * Aufstieg hängt aber an erfüllten Kriterien (Einheiten + Leistung), nicht am Kalender.
 */

export type Requirement =
  | { type: 'none' }
  | { type: 'baseline' }
  | { type: 'retest' }
  | { type: 'consistency'; maxGroupCm: number; minRoutine: number }
  | { type: 'rate'; skill: 'singles' | 'doubles'; min: number; minN: number }
  | { type: 'checkout'; min: number; minN: number };

export interface StageDef {
  program: ProgramId;
  index: number;
  title: string;
  subtitle: string;
  goal: string;
  skills: Skill[];
  techniques: TechniqueId[];
  requirement: Requirement;
  /** Kleine messbare Challenge am Ende jeder Einheit. */
  challenge: { drillId: string; title: string; config: DrillConfig };
}

const num = (n: number): Target => ({ n, kind: 'number' });

export const PROGRAMS: Record<ProgramId, { title: string; description: string; stages: StageDef[] }> = {
  foundation: {
    title: 'Fundament',
    description: 'Vier Stufen für Einsteiger: Stand und Griff, wiederholbarer Wurf, gezielte Präzision, Fortschrittsprüfung.',
    stages: [
      {
        program: 'foundation',
        index: 0,
        title: 'Woche 1 · Grundlagen',
        subtitle: 'Stand finden, Griff stabilisieren, Startpunkt messen',
        goal: 'Einen bequemen, stabilen Stand und Griff finden – und mit dem Eingangstest deinen Startpunkt bestimmen.',
        skills: ['consistency', 'singles'],
        techniques: ['stance', 'grip', 'aim'],
        requirement: { type: 'baseline' },
        challenge: { drillId: 'highscore', title: 'Highscore · 5 Aufnahmen', config: { engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 15, scoring: 'total' } },
      },
      {
        program: 'foundation',
        index: 1,
        title: 'Woche 2 · Wiederholbarkeit',
        subtitle: 'Gleicher Wurf, enge Gruppen, eigener Rhythmus',
        goal: 'Jeden Dart mit dem gleichen Ablauf werfen. Die Gruppen sollen enger werden – Punkte sind zweitrangig.',
        skills: ['consistency', 'singles', 'routine'],
        techniques: ['rhythm', 'backswing', 'followThrough'],
        requirement: { type: 'consistency', maxGroupCm: 9, minRoutine: 60 },
        challenge: { drillId: 'follow-leader', title: 'Follow the Leader · 5 Runden', config: { engine: 'follow', rounds: 5 } },
      },
      {
        program: 'foundation',
        index: 2,
        title: 'Woche 3 · Präzision',
        subtitle: 'Zahlen gezielt treffen, Ziele wechseln, erste Doppel',
        goal: 'Mit dem stabilen Wurf gezielt Zahlen treffen – auch wenn das Ziel wechselt. Erste Doppel-Versuche.',
        skills: ['singles', 'switching', 'doubles'],
        techniques: ['release', 'followThrough', 'aim'],
        requirement: { type: 'rate', skill: 'singles', min: 30, minN: 60 },
        challenge: {
          drillId: 'checkout-doubles',
          title: 'Doppel-Check · 5 Versuche',
          config: { engine: 'checkout', mode: 'list', values: [40, 32, 20, 16, 36], attempts: 5, dartsPerAttempt: 3, out: 'double', seed: 0 },
        },
      },
      {
        program: 'foundation',
        index: 3,
        title: 'Woche 4 · Fortschrittsprüfung',
        subtitle: 'Festigen und den Eingangstest wiederholen',
        goal: 'Das Gelernte festigen und mit dem Wiederholungstest messen, was sich verbessert hat.',
        skills: ['switching', 'singles', 'doubles'],
        techniques: ['rhythm', 'stance'],
        requirement: { type: 'retest' },
        challenge: { drillId: 'atc', title: 'Around the Clock · 30 Darts', config: { engine: 'atc', ring: 'number', bull: false, jump: false, maxDarts: 30 } },
      },
    ],
  },
  build: {
    title: 'Aufbau',
    description: 'Vier Stufen für den nächsten Schritt: Scoring, Doppel, Checkouts und Spielpraxis.',
    stages: [
      {
        program: 'build',
        index: 0,
        title: 'Stufe 1 · Scoring',
        subtitle: '20er-Segment und Triples',
        goal: 'Konstant Punkte machen: das 20er-Segment beherrschen und erste Triples sammeln.',
        skills: ['scoring', 'trebles', 'singles'],
        techniques: ['rhythm', 'release'],
        requirement: { type: 'none' },
        challenge: { drillId: 'highscore', title: 'Highscore · 10 Aufnahmen', config: { engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 30, scoring: 'total' } },
      },
      {
        program: 'build',
        index: 1,
        title: 'Stufe 2 · Doppel',
        subtitle: 'D16, D20 und Druck',
        goal: 'Doppel sicherer treffen – auch unter Druck.',
        skills: ['doubles', 'checkout'],
        techniques: ['aim', 'followThrough'],
        requirement: { type: 'rate', skill: 'doubles', min: 8, minN: 60 },
        challenge: { drillId: 'd16', title: 'D16 · 15 Darts', config: { engine: 'target', targets: [{ n: 16, kind: 'double' }], rotation: 'visit', totalDarts: 15, scoring: 'hits' } },
      },
      {
        program: 'build',
        index: 2,
        title: 'Stufe 3 · Checkout',
        subtitle: 'Wege kennen, Doppel stellen',
        goal: 'Finish-Wege verstehen und kleine Checkouts sicher spielen.',
        skills: ['checkout', 'doubles', 'game'],
        techniques: ['rhythm', 'aim'],
        requirement: { type: 'checkout', min: 25, minN: 15 },
        challenge: {
          drillId: 'checkout-under40',
          title: 'Checkout · 5 Versuche',
          config: { engine: 'checkout', mode: 'list', values: [37, 24, 33, 40, 29], attempts: 5, dartsPerAttempt: 3, out: 'double', seed: 0 },
        },
      },
      {
        program: 'build',
        index: 3,
        title: 'Stufe 4 · Spielpraxis & Test',
        subtitle: '301/501 und Wiederholungstest',
        goal: 'Alles im Spiel zusammenbringen und den Fortschritt messen.',
        skills: ['game', 'scoring', 'checkout'],
        techniques: ['rhythm', 'stance'],
        requirement: { type: 'retest' },
        challenge: { drillId: 'highscore', title: 'Highscore · 10 Aufnahmen', config: { engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 30, scoring: 'total' } },
      },
    ],
  },
  adaptive: {
    title: 'Adaptiv',
    description: 'Laufendes Training: Der Coach wählt die Schwerpunkte nach deinen Daten. Alle vier Wochen ein Leistungstest.',
    stages: [
      {
        program: 'adaptive',
        index: 0,
        title: 'Adaptives Training',
        subtitle: 'Schwerpunkte nach deinen Daten',
        goal: 'Gezielt an den aktuellen Baustellen arbeiten.',
        skills: ['singles', 'switching', 'doubles', 'trebles', 'checkout', 'consistency', 'scoring'],
        techniques: ['stance', 'grip', 'aim', 'backswing', 'release', 'followThrough', 'rhythm'],
        requirement: { type: 'none' },
        challenge: { drillId: 'highscore', title: 'Highscore · 10 Aufnahmen', config: { engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 30, scoring: 'total' } },
      },
    ],
  },
};

export function currentStage(profile: Profile): StageDef {
  const p = PROGRAMS[profile.plan.program];
  return p.stages[Math.min(profile.plan.stage, p.stages.length - 1)];
}

export function requiredSessions(profile: Profile): number {
  return Math.max(2, Math.min(5, profile.sessionsPerWeek));
}

export function stageSessions(profile: Profile, sessions: SessionRecord[]): SessionRecord[] {
  const { program, stage, stageStartedAt } = profile.plan;
  return sessions.filter(
    (s) => s.completed && s.plan && s.plan.program === program && s.plan.stage === stage && s.startedAt >= stageStartedAt && (s.kind === 'plan' || s.kind === 'assessment'),
  );
}

export interface StageStatus {
  stage: StageDef;
  sessionsDone: number;
  sessionsRequired: number;
  requirementMet: boolean;
  requirementText: string;
  progressText: string;
  canAdvance: boolean;
  /** Aufstieg trotz nicht erfülltem Leistungskriterium (nach zusätzlichen Einheiten). */
  advanceDespite: boolean;
  nextIsAssessment: boolean;
  totalStages: number;
}

function stageThrowRate(sessions: SessionRecord[], skill: 'singles' | 'doubles'): { hits: number; n: number } {
  let hits = 0;
  let n = 0;
  for (const t of allThrows(sessions)) {
    if (!hasTarget(t)) continue;
    const k = t.target.kind;
    const isSkill = skill === 'doubles' ? k === 'double' || k === 'bullseye' : (k === 'number' || k === 'single') && t.target.n !== 25;
    if (!isSkill) continue;
    n++;
    if (t.hit) hits++;
  }
  return { hits, n };
}

export function stageStatus(profile: Profile, sessions: SessionRecord[]): StageStatus {
  const stage = currentStage(profile);
  const inStage = stageSessions(profile, sessions);
  const required = requiredSessions(profile);
  const done = inStage.length;
  const req = stage.requirement;
  let met = true;
  let text = 'Keine zusätzliche Bedingung';
  let progress = '';
  let nextIsAssessment = false;
  const isAdaptive = profile.plan.program === 'adaptive';

  switch (req.type) {
    case 'baseline': {
      const has = completedAssessments(sessions).length > 0;
      met = has;
      text = 'Eingangstest absolvieren';
      progress = has ? 'Eingangstest erledigt' : 'Eingangstest steht noch aus';
      nextIsAssessment = !has;
      break;
    }
    case 'retest': {
      const has = inStage.some((s) => s.kind === 'assessment');
      met = has;
      text = 'Leistungstest wiederholen';
      progress = has ? 'Wiederholungstest erledigt' : 'Wiederholungstest am Ende der Stufe';
      nextIsAssessment = !has && done >= required - 1;
      break;
    }
    case 'consistency': {
      const groups = groupSizesFrom(inStage);
      const g = mean(groups.map((x) => x.mm));
      const ratings: number[] = [];
      for (const s of inStage) for (const d of s.drills) if (d.config.engine === 'focus') for (const e of d.events) if (e.t === 'rate') ratings.push(e.value === 2 ? 100 : e.value === 1 ? 50 : 0);
      const r = mean(ratings);
      const groupOk = groups.length >= 5 && g !== null && g / 10 <= req.maxGroupCm;
      const routineOk = ratings.length >= 10 && r !== null && r >= req.minRoutine;
      met = groupOk || routineOk;
      text = `Ø Gruppe ≤ ${req.maxGroupCm} cm (mind. 5 Gruppen) oder Routine-Treue ≥ ${req.minRoutine} % (mind. 10 Runden)`;
      progress = `Gruppe: ${g === null ? '–' : `${(g / 10).toFixed(1).replace('.', ',')} cm`} (${groups.length}) · Routine: ${r === null ? '–' : `${Math.round(r)} %`} (${ratings.length})`;
      break;
    }
    case 'rate': {
      const { hits, n } = stageThrowRate(inStage, req.skill);
      const pctv = n ? (hits / n) * 100 : 0;
      met = n >= req.minN && pctv >= req.min;
      text = `${SKILL_LABEL[req.skill]}: mind. ${req.min} % Trefferquote bei mind. ${req.minN} Darts in dieser Stufe`;
      progress = `${n ? Math.round(pctv) : '–'} % bei ${n} Darts`;
      break;
    }
    case 'checkout': {
      let succ = 0;
      let att = 0;
      for (const s of inStage) for (const d of s.drills) if (d.config.engine === 'checkout') {
        succ += d.result.metrics.successes ?? 0;
        att += d.result.metrics.attempts ?? 0;
      }
      const pctv = att ? (succ / att) * 100 : 0;
      met = att >= req.minN && pctv >= req.min;
      text = `Checkout-Quote mind. ${req.min} % bei mind. ${req.minN} Versuchen in dieser Stufe`;
      progress = `${att ? Math.round(pctv) : '–'} % bei ${att} Versuchen`;
      break;
    }
    case 'none':
      break;
  }

  const enough = done >= required;
  const isTest = req.type === 'baseline' || req.type === 'retest';
  const despite = !met && !isTest && done >= required + 3;
  const program = PROGRAMS[profile.plan.program];
  return {
    stage,
    sessionsDone: done,
    sessionsRequired: required,
    requirementMet: met,
    requirementText: text,
    progressText: progress,
    canAdvance: !isAdaptive && ((enough && met) || despite),
    advanceDespite: despite,
    nextIsAssessment: nextIsAssessment || (isAdaptive && adaptiveRetestDue(sessions)),
    totalStages: program.stages.length,
  };
}

function adaptiveRetestDue(sessions: SessionRecord[]): boolean {
  const tests = completedAssessments(sessions);
  if (!tests.length) return true;
  return Date.now() - tests[tests.length - 1].startedAt > 28 * DAY_MS;
}

/** Wendet einen Stufenaufstieg auf das Profil an (falls möglich). */
export function advancePlan(profile: Profile, sessions: SessionRecord[], now = Date.now()): { profile: Profile; advanced: boolean; message?: string } {
  const st = stageStatus(profile, sessions);
  if (!st.canAdvance) return { profile, advanced: false };
  const program = PROGRAMS[profile.plan.program];
  const reason = st.advanceDespite
    ? 'Weiter nach zusätzlichen Einheiten – Fortschritt verläuft nicht linear.'
    : `${st.sessionsDone} Einheiten absolviert${st.stage.requirement.type !== 'none' ? `, Kriterium erfüllt (${st.progressText})` : ''}.`;
  const history = [...profile.plan.history, { program: profile.plan.program, stage: profile.plan.stage, endedAt: now, reason }];
  let next: Profile['plan'];
  let message: string;
  if (profile.plan.stage + 1 < program.stages.length) {
    next = { ...profile.plan, stage: profile.plan.stage + 1, stageStartedAt: now, history };
    message = `${st.stage.title} geschafft! Weiter mit ${program.stages[profile.plan.stage + 1].title}.`;
  } else if (profile.plan.program === 'foundation') {
    next = { program: 'build', stage: 0, stageStartedAt: now, history };
    message = 'Programm „Fundament“ abgeschlossen! Weiter mit dem Programm „Aufbau“.';
  } else {
    next = { program: 'adaptive', stage: 0, stageStartedAt: now, history };
    message = 'Programm „Aufbau“ abgeschlossen! Ab jetzt plant der Coach adaptiv nach deinen Daten.';
  }
  return { profile: { ...profile, plan: next }, advanced: true, message };
}

/** Schlägt nach starkem Eingangstest einen Wechsel ins Aufbau-Programm vor. */
export function fastTrackSuggestion(profile: Profile, sessions: SessionRecord[]): string | null {
  if (profile.plan.program !== 'foundation' || profile.plan.stage > 1) return null;
  const tests = completedAssessments(sessions);
  if (!tests.length) return null;
  const skills = skillSnapshots(tests);
  const singles = skills.find((s) => s.skill === 'singles');
  const cons = skills.find((s) => s.skill === 'consistency');
  if (singles && singles.value !== null && singles.value >= 55 && cons && cons.value !== null && cons.value <= 6) {
    return `Starker Eingangstest: ${singles.display} auf große Singles und ${cons.display} Gruppengröße. Du kannst direkt ins Programm „Aufbau“ wechseln.`;
  }
  return null;
}

// ---------------- Einheit zusammenstellen ----------------

export interface PlannedSession {
  kind: 'plan' | 'assessment';
  title: string;
  subtitle: string;
  phases: SessionPhase[];
  plan: { program: ProgramId; stage: number };
  techniqueFocus?: TechniqueId;
  recommendation: Recommendation;
  minutes: number;
}

const dartsFor = (minutes: number) => Math.max(9, Math.round((minutes * 5) / 3) * 3);
const roundsFor = (minutes: number) => Math.max(3, Math.round(minutes * 1.6));

function mainPhase(skill: Skill, minutes: number, beginner: boolean, rngSeed: number, tech: TechniqueId): Omit<SessionPhase, 'id' | 'title'> {
  const darts = dartsFor(minutes);
  const why = (drillId: string) => getDrill(drillId).why;
  switch (skill) {
    case 'consistency': {
      const rounds = Math.max(4, Math.round(minutes * 1.4));
      return {
        coach: `Grouping: Drei Darts möglichst eng zusammen – Punkte sind egal. Tippe die Positionen an, damit die App die Gruppengröße misst. ${why('grouping')}`,
        drillId: 'grouping',
        variantId: 'plan',
        config: { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds, measure: 'positions' },
        minutes,
      };
    }
    case 'singles': {
      const block = beginner ? Math.max(6, Math.round(darts / 2 / 3) * 3) : 9;
      const targets = beginner ? [num(20), num(19)] : [num(20), num(19), num(18), num(17)];
      const total = beginner ? block * 2 : Math.max(18, Math.round(darts / 9) * 9);
      return {
        coach: `Big Singles: Ziele auf die großen Single-Felder (${targets.map((t) => t.n).join(', ')}). Erfasse auch Fehlwürfe in Nachbarfelder – daraus erkennt der Coach Muster. ${why('big-singles')}`,
        drillId: 'big-singles',
        variantId: 'plan',
        config: { engine: 'target', targets, rotation: 'block', blockSize: block, totalDarts: total, scoring: 'hits' },
        minutes,
      };
    }
    case 'switching':
      return {
        coach: `Zielwechsel: ${beginner ? 'Nach jeder Aufnahme' : 'Nach jedem Dart'} wechselt das Ziel (20 → 19 → 18). Stand bleibt, nur Blick und Arm richten sich neu aus. ${why('target-switch')}`,
        drillId: 'target-switch',
        variantId: 'plan',
        config: { engine: 'target', targets: [num(20), num(19), num(18)], rotation: beginner ? 'visit' : 'dart', totalDarts: darts, scoring: 'hits' },
        minutes,
      };
    case 'doubles': {
      if (!beginner && minutes >= 12) {
        return { coach: `Bob's 27: je drei Darts auf jedes Doppel. ${why('bobs27')}`, drillId: 'bobs27', variantId: 'easy', config: { engine: 'bobs27', bull: true, elimination: 'none' }, minutes };
      }
      return {
        coach: `Doppel-Training: abwechselnd eine Aufnahme auf D20 und D16. Doppel sind schwer – zähle jeden Treffer als Erfolg. ${why('d16')}`,
        drillId: 'd16',
        variantId: 'plan',
        config: { engine: 'target', targets: [{ n: 20, kind: 'double' }, { n: 16, kind: 'double' }], rotation: 'visit', totalDarts: darts, scoring: 'hits' },
        minutes,
      };
    }
    case 'trebles':
      return {
        coach: `Triple-Training auf die T20. Erfasse auch, ob du links (5) oder rechts (1) daneben liegst. ${why('t20')}`,
        drillId: 't20',
        variantId: 'plan',
        config: { engine: 'target', targets: [{ n: 20, kind: 'triple' }], rotation: 'visit', totalDarts: darts, scoring: 'hits' },
        minutes,
      };
    case 'scoring':
      return {
        coach: `20er-Training: Sammle Punkte im 20er-Segment. ${why('twenty-training')}`,
        drillId: 'twenty-training',
        variantId: 'plan',
        config: { engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: darts, scoring: 'points' },
        minutes,
      };
    case 'checkout':
      return {
        coach: `Checkout-Training: Restwerte bis 40 mit Doppel-Out beenden. Die App zeigt dir jeweils den Weg. ${why('checkout-under40')}`,
        drillId: 'checkout-under40',
        variantId: 'plan',
        config: { engine: 'checkout', mode: 'random', min: 2, max: 40, evenOnly: beginner, attempts: Math.max(5, Math.round(minutes * 0.9)), dartsPerAttempt: 3, out: 'double', seed: rngSeed },
        minutes,
      };
    case 'game':
      return {
        coach: `Spieltraining 301: Scoring, Stellen und Checkout unter echten Regeln. ${why('x01')}`,
        drillId: 'x01',
        variantId: 'plan',
        config: { engine: 'x01', seed: rngSeed, game: { start: 301, out: beginner ? 'single' : 'double', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }] } },
        minutes,
      };
    case 'routine':
    default: {
      const topic = getTechnique(tech);
      return {
        coach: `Routine-Runden: Führe vor jedem Dart deine komplette Pre-Throw-Routine aus. Schwerpunkt bleibt: ${topic.title}.`,
        drillId: 'tech-routine',
        variantId: 'plan',
        config: { engine: 'focus', targets: [num(20)], rounds: roundsFor(minutes), cue: 'Komplette Routine vor jedem Dart', question: 'Routine vor jedem Dart vollständig?' },
        minutes,
      };
    }
  }
}

const LAYOUTS: Record<SessionMinutes, { warm: number; tech: number; main: number; switch?: number; second?: number; challenge?: number }> = {
  10: { warm: 2, tech: 3, main: 5 },
  20: { warm: 3, tech: 5, main: 8, challenge: 4 },
  30: { warm: 5, tech: 5, main: 10, switch: 5, challenge: 5 },
  45: { warm: 5, tech: 8, main: 12, switch: 8, second: 7, challenge: 5 },
};

/** Stellt die heutige Einheit zusammen. */
export function buildPlanSession(profile: Profile, sessions: SessionRecord[], sessionId: string, now = Date.now()): PlannedSession {
  const stage = currentStage(profile);
  const status = stageStatus(profile, sessions);
  const rec = recommend(profile, sessions, stage.skills, stage.techniques, now);
  const plan = { program: profile.plan.program, stage: profile.plan.stage };

  if (status.nextIsAssessment) {
    const first = completedAssessments(sessions).length === 0;
    return {
      kind: 'assessment',
      title: first ? 'Eingangstest' : 'Leistungstest (Wiederholung)',
      subtitle: first ? 'Bestimme deinen Startpunkt – fünf kurze Tests' : 'Gleiche Aufgaben wie beim Eingangstest – jetzt siehst du deinen Fortschritt',
      phases: assessmentPhases(),
      plan,
      recommendation: rec,
      minutes: ASSESSMENT_MINUTES,
    };
  }

  const seed = hashString(sessionId);
  const rng = createRng(seed);
  const beginner = profile.level === 'beginner';
  let minutes: SessionMinutes = profile.sessionMinutes;
  if (rec.load !== 'normal') minutes = minutes >= 30 ? 20 : 10;
  const L = LAYOUTS[minutes];
  const topic = getTechnique(rec.technique);
  const phases: SessionPhase[] = [];

  phases.push({
    id: 'warmup',
    title: 'Warm-up',
    coach: 'Locker einwerfen: Körpergefühl und Rhythmus finden. Keine Zahlen im Kopf – nur ein entspanntes Gefühl für den Wurf. Die Eingabe ist hier optional.',
    drillId: 'free',
    variantId: 'plan',
    config: { engine: 'free', maxDarts: dartsFor(L.warm) },
    minutes: L.warm,
    optionalInput: true,
  });

  phases.push({
    id: 'technique',
    title: `Technik · ${topic.title}`,
    coach: `Heute nur ein Schwerpunkt: ${topic.title}. ${topic.short} Bei jedem Dart: „${topic.routineCue}“. Nach jeder Runde bewertest du ehrlich, ob es geklappt hat. ${rec.techniqueReason}`,
    drillId: topic.drillId,
    variantId: 'plan',
    config: {
      engine: 'focus',
      targets: [rec.technique === 'aim' ? { n: 25, kind: 'bull' } : num(20)],
      rounds: roundsFor(L.tech),
      cue: topic.routineCue,
      question: `${topic.title}: sauber umgesetzt?`,
    },
    minutes: L.tech,
  });

  const main = mainPhase(rec.focusSkill, L.main, beginner, seed, rec.technique);
  phases.push({ id: 'main', title: `Schwerpunkt · ${SKILL_LABEL[rec.focusSkill]}`, ...main, coach: `${main.coach} Warum heute: ${rec.focusReason}` });

  if (L.switch) {
    const alt = rec.focusSkill === 'switching' ? 'singles' : 'switching';
    phases.push({ id: 'switch', title: alt === 'switching' ? 'Zielwechsel' : 'Big Singles', ...mainPhase(alt, L.switch, beginner, seed + 1, rec.technique) });
  }
  if (L.second) {
    const others = stage.skills.filter((s) => s !== rec.focusSkill && s !== 'switching' && s !== 'routine');
    const second = others.length ? pick(rng, others) : 'doubles';
    phases.push({ id: 'second', title: `Ergänzung · ${SKILL_LABEL[second]}`, ...mainPhase(second, L.second, beginner, seed + 2, rec.technique) });
  }
  if (L.challenge) {
    phases.push({
      id: 'challenge',
      title: `Challenge · ${stage.challenge.title}`,
      coach: `Zum Abschluss eine kleine, messbare Herausforderung – immer gleich aufgebaut, damit du dich mit dir selbst vergleichen kannst. Bleib bei deiner Routine, auch wenn es zählt.`,
      drillId: stage.challenge.drillId,
      variantId: 'plan-challenge',
      config: stage.challenge.config,
      minutes: L.challenge,
    });
  }

  return {
    kind: 'plan',
    title: stage.title,
    subtitle: `${minutes} Minuten · Schwerpunkt ${SKILL_LABEL[rec.focusSkill]} · Technik: ${topic.title}`,
    phases,
    plan,
    techniqueFocus: rec.technique,
    recommendation: rec,
    minutes,
  };
}
