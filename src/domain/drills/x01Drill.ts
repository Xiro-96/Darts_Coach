import { dartLabel, makeDart } from '../board';
import { bestCheckout, isOneDartDoubleFinish, setupAdvice } from '../checkout';
import type { Dart, Target } from '../types';
import { applyDart, applyVisit, createX01, playerStats, type X01State } from '../x01';
import { DARTS_PER_VISIT, fmt } from './helpers';
import type { DrillResult, DrillView, EngineModule, ThrowRecord, X01DrillConfig } from './types';

/** 301/501 als Trainingsspiel, optional gegen einen virtuellen Gegner. Spieler 0 bist du. */
export interface X01DrillState {
  config: X01DrillConfig;
  game: X01State;
  throws: ThrowRecord[];
  visitCount: number;
}

function doubleTarget(rem: number): Target | null {
  if (!isOneDartDoubleFinish(rem)) return null;
  return rem === 50 ? { n: 25, kind: 'bullseye' } : { n: rem / 2, kind: 'double' };
}

const SCORING_QUICK: Dart[] = [makeDart(20, 3), makeDart(20, 1), makeDart(1, 1), makeDart(5, 1), makeDart(19, 3), makeDart(19, 1), makeDart(0, 0)];

export const x01Drill: EngineModule<X01DrillConfig, X01DrillState> = {
  init(config) {
    return { config, game: createX01(config.game), throws: [], visitCount: 0 };
  },

  apply(s, e) {
    if (s.game.finished) return s;
    const pi = s.game.current;
    const isHuman = pi === 0;
    if (e.t === 'dart') {
      if (Boolean(e.bot) === isHuman) return s; // Eingabe passt nicht zum Spieler am Zug
      const p = s.game.players[pi];
      const tgt = s.config.game.out === 'double' && p.isIn ? doubleTarget(p.remaining) : null;
      const game = applyDart(s.game, e.dart);
      const throws = isHuman
        ? [...s.throws, { dart: e.dart, target: tgt, hit: tgt ? e.dart.n === tgt.n && e.dart.m === 2 : null, round: s.visitCount, at: e.at }]
        : s.throws;
      const visitEnded = game.current !== pi || game.finished || game.leg !== s.game.leg;
      return { ...s, game, throws, visitCount: isHuman && visitEnded ? s.visitCount + 1 : s.visitCount };
    }
    if (e.t === 'visit' && isHuman) {
      const game = applyVisit(s.game, e.score, { darts: e.darts, doubleDarts: e.doubleDarts });
      return { ...s, game, visitCount: s.visitCount + 1 };
    }
    return s;
  },

  finished(s) {
    return s.game.finished;
  },

  throws(s) {
    return s.throws;
  },

  view(s): DrillView {
    const g = s.game;
    const me = g.players[0];
    const cur = g.players[g.current];
    const curIsBot = Boolean(g.config.players[g.current].bot);
    const dartsLeft = DARTS_PER_VISIT - g.visitDarts.length;
    const route = cur.isIn ? bestCheckout(cur.remaining, dartsLeft, g.config.out) : null;
    let hint: string | undefined;
    if (!g.finished && !curIsBot) {
      if (!cur.isIn) hint = 'Double-In: Erst ein Doppel öffnet das Spiel.';
      else if (route) hint = `Checkout-Weg: ${route.labels.join(' → ')}`;
      else if (cur.remaining <= 60) {
        const adv = setupAdvice(cur.remaining);
        if (adv) hint = `Kein Finish mit ${dartsLeft} Dart${dartsLeft > 1 ? 's' : ''} – ${adv.label} stellt dir ${adv.leave}.`;
      }
    }
    let feedback: DrillView['feedback'];
    const fb = g.lastFeedback;
    if (fb?.kind === 'bust') feedback = { tone: 'bad', text: `${g.config.players[fb.player].name}: Bust!` };
    if (fb?.kind === 'checkout') feedback = { tone: 'good', text: `${g.config.players[fb.player].name} checkt ${fb.score}!` };
    if (fb?.kind === 'visit') feedback = { tone: 'info', text: `${g.config.players[fb.player].name}: ${fb.score}` };

    const st0 = playerStats(g, 0);
    let quick: Dart[] = SCORING_QUICK;
    const dt = doubleTarget(cur.remaining);
    if (route) {
      quick = [route.darts[0]];
      if (dt) quick.push(makeDart(dt.n, 2), makeDart(dt.n, 1));
      quick.push(...SCORING_QUICK.slice(0, 3), makeDart(0, 0));
    }
    const uniqueQuick = quick.filter((d, i) => quick.findIndex((q) => q.n === d.n && q.m === d.m) === i);
    return {
      target: curIsBot ? null : doubleTarget(cur.remaining),
      headline: g.finished ? (g.winner === 0 ? 'Gewonnen!' : 'Verloren') : `${me.remaining}`,
      caption: g.finished ? undefined : curIsBot ? `${g.config.players[g.current].name} ist am Zug …` : `Leg ${g.leg + 1} · Rest`,
      progress: 1 - me.remaining / g.config.start,
      stats: [
        { label: 'Ø 3 Darts', value: fmt(st0.average) },
        { label: 'Darts', value: `${st0.dartsThrown}` },
        { label: 'Doppelquote', value: st0.checkoutRate === null ? '–' : `${Math.round(st0.checkoutRate * 100)} %` },
      ],
      visitDarts: g.visitDarts.map((d) => ({ label: dartLabel(d), hit: null })),
      awaiting: g.finished ? 'done' : 'dart',
      hint,
      feedback,
      quick: curIsBot ? [] : uniqueQuick,
      allowVisitTotal: !curIsBot && g.visitDarts.length === 0,
      panel: {
        type: 'x01',
        currentIsBot: curIsBot,
        visitStart: g.visitStart,
        legsToWin: g.config.legsToWin,
        players: g.players.map((p, i) => ({
          name: g.config.players[i].name,
          remaining: p.remaining,
          legsWon: p.legsWon,
          average: playerStats(g, i).average,
          isBot: Boolean(g.config.players[i].bot),
          active: i === g.current && !g.finished,
        })),
      },
    };
  },

  result(s): DrillResult {
    const g = s.game;
    const st = playerStats(g, 0);
    const won = g.finished && g.winner === 0;
    const opponent = g.config.players.length > 1 ? g.config.players[1].name : undefined;
    const lines = [
      `3-Dart-Average: ${fmt(st.average)}`,
      `First-9-Average: ${fmt(st.first9Average)}`,
      `Darts aufs Doppel: ${st.dartsAtDouble}, Checkouts: ${st.checkouts}${st.checkoutRate !== null ? ` (${Math.round(st.checkoutRate * 100)} %)` : ''}`,
    ];
    if (st.highestFinish) lines.push(`Höchstes Finish: ${st.highestFinish}`);
    if (st.bestLegDarts) lines.push(`Bestes Leg: ${st.bestLegDarts} Darts`);
    if (opponent && g.finished) lines.unshift(won ? `Sieg gegen ${opponent}!` : `Niederlage gegen ${opponent}`);
    const metrics: Record<string, number> = {
      darts: st.dartsThrown,
      points: st.pointsScored,
      dartsAtDouble: st.dartsAtDouble,
      checkouts: st.checkouts,
      legsWon: st.legsWon,
      highestFinish: st.highestFinish,
      tons: st.tons + st.ton40s + st.max180s,
      won: won ? 1 : 0,
    };
    if (st.average !== null) metrics.avg3 = st.average;
    if (st.first9Average !== null) metrics.first9 = st.first9Average;
    if (st.bestLegDarts !== null) metrics.bestLegDarts = st.bestLegDarts;
    return {
      primary: { label: '3-Dart-Average', value: st.average, display: fmt(st.average), higherIsBetter: true },
      completed: g.finished,
      metrics,
      lines,
      x01: { stats: st, won, opponentName: opponent },
    };
  },
};
