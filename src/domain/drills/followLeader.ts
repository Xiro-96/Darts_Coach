import { dartLabel, isMiss, targetLabel } from '../board';
import { distance } from '../geometry';
import type { Dart, Target } from '../types';
import { countHits, currentVisit, DARTS_PER_VISIT, fmt, hitFeedback, pct, quickFor, record } from './helpers';
import type { DrillResult, DrillView, EngineModule, FollowConfig, ThrowRecord } from './types';

/**
 * Follow the Leader: Der erste Dart einer Aufnahme ist frei. Dart 2 und 3 sollen
 * im selben Feld landen wie Dart 1. Trainiert die Wiederholbarkeit des Wurfs.
 */
export interface FollowState {
  config: FollowConfig;
  throws: ThrowRecord[];
}

/** Zielfeld, das durch den ersten Dart vorgegeben wird. */
export function bedOf(d: Dart): Target | null {
  if (isMiss(d)) return null;
  if (d.n === 25) return { n: 25, kind: d.m === 2 ? 'bullseye' : 'bull' };
  return { n: d.n, kind: d.m === 3 ? 'triple' : d.m === 2 ? 'double' : 'single' };
}

function isDone(s: FollowState): boolean {
  return s.throws.length >= s.config.rounds * DARTS_PER_VISIT;
}

function leaderOf(s: FollowState, round: number): ThrowRecord | undefined {
  return s.throws.find((t) => t.round === round);
}

function followDistances(s: FollowState): number[] {
  const out: number[] = [];
  for (const t of s.throws) {
    const lead = leaderOf(s, t.round);
    if (!lead || lead === t || !lead.dart.p || !t.dart.p) continue;
    out.push(distance(lead.dart.p, t.dart.p));
  }
  return out;
}

export const followLeader: EngineModule<FollowConfig, FollowState> = {
  init(config) {
    return { config, throws: [] };
  },

  apply(s, e) {
    if (e.t !== 'dart' || isDone(s)) return s;
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const pos = s.throws.length % DARTS_PER_VISIT;
    const target = pos === 0 ? null : bedOf(leaderOf(s, round)!.dart);
    return { ...s, throws: [...s.throws, record(e.dart, target ?? { n: 0, kind: 'free' }, round, e.at)] };
  },

  finished: isDone,

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const done = isDone(s);
    const round = Math.floor(s.throws.length / DARTS_PER_VISIT);
    const pos = s.throws.length % DARTS_PER_VISIT;
    const lead = pos === 0 ? null : leaderOf(s, round);
    const target = lead ? bedOf(lead.dart) : null;
    const { hits, attempts } = countHits(s.throws);
    const dists = followDistances(s);
    const stats = [
      { label: 'Runde', value: `${Math.min(round + 1, s.config.rounds)}/${s.config.rounds}` },
      { label: 'Gleiches Feld', value: pct(hits, attempts) },
    ];
    if (dists.length) stats.push({ label: 'Ø Abstand', value: `${fmt(dists.reduce((a, b) => a + b, 0) / dists.length / 10)} cm` });
    let headline = 'Freier Wurf';
    let caption = 'Dart 1: Wirf auf dein Ziel (z. B. die 20). Dart 2 und 3 folgen ihm.';
    if (done) {
      headline = 'Fertig';
      caption = '';
    } else if (lead) {
      headline = target ? targetLabel(target) : 'Neu ansetzen';
      caption = target
        ? `Folge deinem ersten Dart (${dartLabel(lead.dart)}) – gleicher Ablauf, gleicher Punkt.`
        : 'Der erste Dart war daneben – wirf die restlichen Darts frei auf dein Ziel.';
    }
    return {
      target,
      headline,
      caption,
      progress: s.throws.length / (s.config.rounds * DARTS_PER_VISIT),
      stats,
      visitDarts: currentVisit(s.throws, pos === 0 && round > 0 ? round - 1 : round),
      awaiting: done ? 'done' : 'dart',
      feedback: hitFeedback(s.throws[s.throws.length - 1]),
      quick: target ? quickFor(target) : [],
    };
  },

  result(s): DrillResult {
    const { hits, attempts } = countHits(s.throws);
    const dists = followDistances(s);
    const metrics: Record<string, number> = { darts: s.throws.length, hits, attempts };
    const lines = [`Folgedarts im gleichen Feld: ${hits} von ${attempts}`];
    if (dists.length) {
      const avg = dists.reduce((a, b) => a + b, 0) / dists.length;
      metrics.followDistanceMm = avg;
      lines.push(`Ø Abstand zum ersten Dart: ${fmt(avg / 10)} cm (aus ${dists.length} Positionen)`);
    }
    return {
      primary: {
        label: 'Gleiches Feld',
        value: attempts ? (hits / attempts) * 100 : null,
        display: pct(hits, attempts),
        higherIsBetter: true,
        unit: '%',
      },
      completed: isDone(s),
      metrics,
      lines,
    };
  },
};
