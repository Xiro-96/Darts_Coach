import { chooseBotTarget, botSigma, simulateThrow } from '../bot';
import { createRng, hashString } from '../random';
import type { Dart } from '../types';
import { aroundTheClock } from './aroundTheClock';
import { bobs27 } from './bobs27';
import { checkoutPractice } from './checkoutPractice';
import { cricket } from './cricket';
import { doublesLadder } from './doublesLadder';
import { focusDrill } from './focus';
import { followLeader } from './followLeader';
import { freeThrow } from './freeThrow';
import { grouping } from './grouping';
import { targetPractice } from './targetPractice';
import type { DrillConfig, DrillEvent, DrillResult, DrillView, EngineModule, EngineName, ThrowRecord } from './types';
import { x01Drill, type X01DrillState } from './x01Drill';

const ENGINES: Record<EngineName, EngineModule<any, any>> = {
  target: targetPractice,
  atc: aroundTheClock,
  bobs27,
  grouping,
  follow: followLeader,
  checkout: checkoutPractice,
  ladder: doublesLadder,
  cricket,
  focus: focusDrill,
  free: freeThrow,
  x01: x01Drill,
};

export interface DrillRun {
  state: unknown;
  view: DrillView;
  result: DrillResult;
  finished: boolean;
  throws: ThrowRecord[];
}

/**
 * Berechnet den aktuellen Übungszustand aus Konfiguration und Ereignissen.
 * Ungültige Ereignisse (z. B. unmögliche Punktzahl) werfen einen Fehler –
 * der Aufrufer prüft neue Eingaben mit `tryApply` vor dem Speichern.
 */
export function runDrill(config: DrillConfig, events: DrillEvent[]): DrillRun {
  const engine = ENGINES[config.engine];
  let state = engine.init(config);
  for (const e of events) state = engine.apply(state, e);
  return {
    state,
    view: engine.view(state),
    result: engine.result(state),
    finished: engine.finished(state),
    throws: engine.throws(state),
  };
}

/** Prüft, ob ein neues Ereignis gültig ist. Gibt eine Fehlermeldung zurück oder `null`. */
export function validateEvent(config: DrillConfig, events: DrillEvent[], e: DrillEvent): string | null {
  try {
    const engine = ENGINES[config.engine];
    let state = engine.init(config);
    for (const ev of events) state = engine.apply(state, ev);
    engine.apply(state, e);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Ungültige Eingabe';
  }
}

/** Undo: entfernt automatisch erzeugte Bot-Darts und danach die letzte eigene Eingabe. */
export function undoEvents(events: DrillEvent[]): DrillEvent[] {
  let i = events.length - 1;
  while (i >= 0 && events[i].t === 'dart' && (events[i] as { bot?: boolean }).bot) i--;
  return i < 0 ? [] : events.slice(0, i);
}

/**
 * Erzeugt den nächsten Bot-Dart (deterministisch über Seed + Anzahl Ereignisse),
 * falls in einem X01-Spiel der virtuelle Gegner am Zug ist.
 */
export function nextBotDart(config: DrillConfig, events: DrillEvent[]): Dart | null {
  if (config.engine !== 'x01') return null;
  const run = runDrill(config, events);
  const st = run.state as X01DrillState;
  const g = st.game;
  if (g.finished) return null;
  const spec = g.config.players[g.current];
  if (!spec.bot) return null;
  const p = g.players[g.current];
  const rng = createRng(hashString(`${config.seed}:${events.length}`));
  const target = chooseBotTarget(p.remaining, 3 - g.visitDarts.length, g.config.out, p.isIn);
  return simulateThrow(target, botSigma(spec.bot.level), rng);
}

/** Stabiler Schlüssel einer Konfiguration (ohne Seed), um vergleichbare Ergebnisse zu finden. */
export function configKey(config: DrillConfig): string {
  const { seed: _seed, ...rest } = config as DrillConfig & { seed?: number };
  void _seed;
  return stableStringify(rest);
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${k}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}
