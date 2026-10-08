/**
 * Hilfsfunktionen für Unit-Tests: erzeugen Sessions über die echten Engines,
 * damit Statistiken auf realistischen Datensätzen getestet werden.
 */
import { makeDart } from './board';
import { configKey, runDrill } from './drills/registry';
import type { DrillConfig, DrillEvent } from './drills/types';
import { DEFAULT_ROUTINE, type DrillRecord, type Profile, type SessionRecord } from './models';
import type { Dart, Target } from './types';

export function testProfile(over: Partial<Profile> = {}): Profile {
  return {
    version: 1,
    name: 'Test',
    createdAt: 0,
    level: 'beginner',
    dartType: 'steel',
    hand: 'right',
    sessionsPerWeek: 3,
    sessionMinutes: 30,
    goals: ['accuracy'],
    stableThrow: 'no',
    inputMode: 'buttons',
    sound: false,
    voice: false,
    setup: {},
    routine: DEFAULT_ROUTINE,
    techniqueStatus: {},
    techniqueNotes: {},
    plan: { program: 'foundation', stage: 0, stageStartedAt: 0, history: [] },
    ...over,
  };
}

export function drillRecord(drillId: string, config: DrillConfig, events: DrillEvent[], at: number, variantId = 'test'): DrillRecord {
  const timed = events.map((e, i) => ({ ...e, at: at + i * 1000 }));
  const run = runDrill(config, timed);
  return { drillId, variantId, configKey: configKey(config), config, events: timed, throws: run.throws, result: run.result, startedAt: at, endedAt: at + events.length * 1000 };
}

let counter = 0;
export function session(drills: DrillRecord[], at: number, over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `s${++counter}`,
    kind: 'single',
    title: 'Test',
    startedAt: at,
    endedAt: at + 600000,
    activeMs: 600000,
    drills,
    completed: true,
    xp: 0,
    ...over,
  };
}

/** n Darts auf ein Zahlenziel mit vorgegebener Trefferzahl (Fehlwürfe gehen ins angegebene Nachbarfeld). */
export function hitsOn(n: number, total: number, hits: number, missTo = 0): Dart[] {
  return Array.from({ length: total }, (_, i) => (i < hits ? makeDart(n, 1) : missTo ? makeDart(missTo, 1) : makeDart(0, 0)));
}

export function targetSession(target: Target, darts: Dart[], at: number, over: Partial<SessionRecord> = {}): SessionRecord {
  const config: DrillConfig = { engine: 'target', targets: [target], rotation: 'visit', totalDarts: darts.length, scoring: 'hits' };
  return session([drillRecord('big-singles', config, darts.map((dart) => ({ t: 'dart', dart })), at)], at, over);
}
