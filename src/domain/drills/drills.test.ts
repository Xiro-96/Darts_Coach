import { describe, expect, it } from 'vitest';
import { aimPoint, makeDart } from '../board';
import type { Dart, Target } from '../types';
import { DRILLS, getDrill, getVariant } from './catalog';
import { configKey, nextBotDart, runDrill, undoEvents, validateEvent } from './registry';
import type { DrillConfig, DrillEvent } from './types';

const S = (n: number) => makeDart(n, 1);
const D = (n: number) => makeDart(n, 2);
const T = (n: number) => makeDart(n, 3);
const MISS = makeDart(0, 0);
const darts = (...ds: Dart[]): DrillEvent[] => ds.map((dart) => ({ t: 'dart', dart }));
const rate = (value: number): DrillEvent => ({ t: 'rate', value });

/** Ein Dart, der das Ziel garantiert trifft. */
function hitOf(t: Target): Dart {
  if (t.kind === 'bullseye') return makeDart(25, 2);
  if (t.kind === 'bull' || t.n === 25) return makeDart(25, 1);
  if (t.kind === 'double') return D(t.n);
  if (t.kind === 'triple') return T(t.n);
  return S(t.n);
}

describe('Zielübung (Big Singles, Zielwechsel, Scoring)', () => {
  it('wechselt Ziele blockweise und zählt Treffer', () => {
    const config: DrillConfig = { engine: 'target', targets: [{ n: 20, kind: 'number' }, { n: 19, kind: 'number' }], rotation: 'block', blockSize: 3, totalDarts: 6, scoring: 'hits' };
    const r = runDrill(config, darts(S(20), T(20), S(1), S(19), S(7), D(19)));
    expect(r.finished).toBe(true);
    expect(r.result.metrics.hits).toBe(4);
    expect(r.result.primary.value).toBeCloseTo((4 / 6) * 100);
    expect(r.throws[3].target).toEqual({ n: 19, kind: 'number' });
  });

  it('wechselt Ziele nach jedem Dart', () => {
    const config: DrillConfig = { engine: 'target', targets: [{ n: 20, kind: 'number' }, { n: 19, kind: 'number' }, { n: 18, kind: 'number' }], rotation: 'dart', totalDarts: 6, scoring: 'hits' };
    const r = runDrill(config, darts(S(20)));
    expect(r.view.target).toEqual({ n: 19, kind: 'number' });
  });

  it('zählt Punkte auf das Zielsegment', () => {
    const config: DrillConfig = { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 3, scoring: 'points' };
    const r = runDrill(config, darts(T(20), S(5), D(20)));
    expect(r.result.primary.value).toBe(100);
  });

  it('akzeptiert Aufnahme-Summen bei Gesamtpunkten', () => {
    const config: DrillConfig = { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 6, scoring: 'total' };
    const r = runDrill(config, [{ t: 'visit', score: 85 }, ...darts(T(20), S(20), S(1))]);
    expect(r.finished).toBe(true);
    expect(r.result.primary.value).toBe(85 + 81);
    expect(validateEvent(config, darts(S(20)), { t: 'visit', score: 60 })).not.toBeNull();
  });

  it('nimmt nach Ende keine Darts mehr an', () => {
    const config: DrillConfig = { engine: 'target', targets: [{ n: 20, kind: 'number' }], rotation: 'visit', totalDarts: 1, scoring: 'hits' };
    const r = runDrill(config, darts(S(20), S(20)));
    expect(r.throws).toHaveLength(1);
  });
});

describe('Around the Clock', () => {
  const base: DrillConfig = { engine: 'atc', ring: 'number', bull: true, jump: false };

  it('springt nur bei Treffern weiter', () => {
    const r = runDrill(base, darts(S(1), S(5), S(2), MISS));
    expect(r.view.target).toEqual({ n: 3, kind: 'number' });
    expect(r.result.metrics.hits).toBe(2);
    expect(r.result.metrics.attempts).toBe(4);
  });

  it('wird mit Bull abgeschlossen und zählt die Darts', () => {
    const ev = darts(...Array.from({ length: 20 }, (_, i) => S(i + 1)), MISS, makeDart(25, 1));
    const r = runDrill(base, ev);
    expect(r.finished).toBe(true);
    expect(r.result.primary).toMatchObject({ value: 22, higherIsBetter: false });
  });

  it('Variante nur Double', () => {
    const r = runDrill({ ...base, ring: 'double' }, darts(S(1), T(1), D(1)));
    expect(r.view.target).toEqual({ n: 2, kind: 'double' });
  });

  it('Sprünge: Triple springt 3 weiter, aber nie über das Bull', () => {
    const r = runDrill({ ...base, jump: true }, darts(T(1)));
    expect(r.view.target).toEqual({ n: 4, kind: 'number' });
    const late = runDrill({ ...base, jump: true }, darts(...Array.from({ length: 18 }, (_, i) => S(i + 1)), T(19)));
    expect(late.view.target).toEqual({ n: 25, kind: 'bull' });
  });

  it('Dart-Limit beendet die Übung und wertet geschaffte Ziele', () => {
    const r = runDrill({ ...base, maxDarts: 3 }, darts(S(1), MISS, S(2)));
    expect(r.finished).toBe(true);
    expect(r.result.primary).toMatchObject({ label: 'Ziele geschafft', value: 2 });
  });
});

describe("Bob's 27", () => {
  const classic: DrillConfig = { engine: 'bobs27', bull: true, elimination: 'below' };

  it('addiert Treffer und zieht bei drei Fehlwürfen ab', () => {
    let r = runDrill(classic, darts(D(1), MISS, D(1)));
    expect(r.result.metrics.score).toBe(27 + 4);
    r = runDrill(classic, darts(D(1), MISS, D(1), MISS, MISS, MISS));
    expect(r.result.metrics.score).toBe(31 - 4);
  });

  it('scheidet klassisch erst unter 0 aus', () => {
    // 27 − 2 − 4 − 6 − 8 = 7, dann −10 → −3 → raus
    const misses = Array.from({ length: 15 }, () => MISS);
    const r = runDrill(classic, darts(...misses));
    expect(r.finished).toBe(true);
    expect(r.result.metrics.eliminated).toBe(1);
    expect(r.result.metrics.score).toBe(-3);
    expect(r.result.metrics.doublesPlayed).toBe(5);
  });

  it('Variante "zero" scheidet bei genau 0 aus', () => {
    // 27 + 2 (1 Treffer D1) = 29 → −4 = 25 → −6 = 19 → −8 = 11 → −10 = 1 → −12 = −11
    const ev = darts(D(1), MISS, MISS, ...Array.from({ length: 12 }, () => MISS));
    const r = runDrill({ ...classic, elimination: 'zero' }, ev);
    expect(r.result.metrics.score).toBe(1);
    expect(r.finished).toBe(false);
  });

  it('Anfängermodus spielt alle 21 Doppel', () => {
    const r = runDrill({ ...classic, elimination: 'none' }, darts(...Array.from({ length: 63 }, () => MISS)));
    expect(r.finished).toBe(true);
    expect(r.result.metrics.eliminated).toBe(0);
    expect(r.result.metrics.score).toBe(27 - 420 - 50);
  });

  it('Maximum 1437', () => {
    const all: Dart[] = [];
    for (let n = 1; n <= 20; n++) all.push(D(n), D(n), D(n));
    all.push(makeDart(25, 2), makeDart(25, 2), makeDart(25, 2));
    expect(runDrill(classic, darts(...all)).result.primary.value).toBe(1437);
  });
});

describe('Grouping', () => {
  const pos = (x: number, y: number): Dart => ({ n: 25, m: 2, p: { x, y } });

  it('misst die Gruppengröße aus Positionen', () => {
    const config: DrillConfig = { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds: 1, measure: 'positions' };
    const r = runDrill(config, darts(pos(0, 0), pos(30, 0), pos(0, 40)));
    expect(r.finished).toBe(true);
    expect(r.result.metrics.groupSizeMm).toBeCloseTo(50);
    expect(r.result.primary).toMatchObject({ value: 5, higherIsBetter: false });
  });

  it('fragt ohne Positionen nach einer Selbsteinschätzung', () => {
    const config: DrillConfig = { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds: 2, measure: 'positions' };
    let r = runDrill(config, darts(S(20), S(20), S(20)));
    expect(r.view.awaiting).toBe('rating');
    r = runDrill(config, [...darts(S(20), S(20), S(20)), rate(2)]);
    expect(r.view.awaiting).toBe('dart');
  });

  it('Selbsteinschätzungsmodus wertet den Anteil enger Gruppen', () => {
    const config: DrillConfig = { engine: 'grouping', targets: [{ n: 25, kind: 'bull' }], rounds: 2, measure: 'self' };
    const r = runDrill(config, [...darts(S(1), S(1), S(1)), rate(1), ...darts(S(1), S(1), S(1)), rate(4)]);
    expect(r.finished).toBe(true);
    expect(r.result.primary.value).toBe(50);
    expect(r.result.lines.join(' ')).toContain('Selbsteinschätzung');
  });
});

describe('Follow the Leader', () => {
  it('Dart 2 und 3 müssen das Feld von Dart 1 treffen', () => {
    const r = runDrill({ engine: 'follow', rounds: 2 }, darts(S(5), S(5), T(5), MISS, S(1), S(2)));
    expect(r.result.metrics.attempts).toBe(2);
    expect(r.result.metrics.hits).toBe(1);
  });

  it('misst den Abstand zum ersten Dart, wenn Positionen vorliegen', () => {
    const a: Dart = { ...S(20), p: { x: 0, y: 50 } };
    const b: Dart = { ...S(20), p: { x: 0, y: 70 } };
    const r = runDrill({ engine: 'follow', rounds: 1 }, darts(a, b, b));
    expect(r.result.metrics.followDistanceMm).toBeCloseTo(20);
  });
});

describe('Checkout-Training', () => {
  const list = (values: number[], dartsPerAttempt: 3 | 6 | 9 = 3): DrillConfig => ({ engine: 'checkout', mode: 'list', values, attempts: values.length, dartsPerAttempt, out: 'double', seed: 1 });

  it('erkennt Erfolg und startet den nächsten Versuch', () => {
    const r = runDrill(list([40, 32]), darts(MISS, D(20)));
    expect(r.view.headline).toBe('32');
    expect(r.result.metrics.successes).toBe(1);
  });

  it('Bust setzt auf den Aufnahmestart zurück und verbraucht die Aufnahme', () => {
    const r = runDrill(list([40], 6), darts(S(20), S(19)));
    // 40 − 20 = 20, dann 19 → Rest 1 → Bust → zurück auf 40, zweite Aufnahme beginnt
    expect(r.view.headline).toBe('40');
    expect(r.view.stats.find((s) => s.label === 'Darts übrig')?.value).toBe('3');
  });

  it('Misserfolg nach aufgebrauchtem Budget', () => {
    const r = runDrill(list([40]), darts(S(20), S(10), S(4)));
    expect(r.finished).toBe(true);
    expect(r.result.primary.value).toBe(0);
  });

  it('zählt Darts aufs Doppel nur bei echten Doppel-Chancen', () => {
    const r = runDrill(list([41]), darts(S(1), MISS, D(20)));
    expect(r.result.metrics.dartsAtDouble).toBe(2);
    expect(r.result.metrics.doubleHits).toBe(1);
  });

  it('121-Leiter: +1 bei Erfolg, −1 bei Misserfolg, nie unter Start', () => {
    const config: DrillConfig = { engine: 'checkout', mode: 'ladder', start: 121, attempts: 3, dartsPerAttempt: 9, out: 'double', seed: 1 };
    let r = runDrill(config, darts(T(20), T(11), D(14)));
    expect(r.view.headline).toBe('122');
    r = runDrill(config, darts(T(20), T(11), D(14), ...Array.from({ length: 9 }, () => MISS)));
    expect(r.view.headline).toBe('121');
    expect(r.result.primary.value).toBe(121);
  });

  it('Zufallszahlen sind reproduzierbar und checkbar', () => {
    const config: DrillConfig = { engine: 'checkout', mode: 'random', min: 2, max: 40, evenOnly: true, attempts: 5, dartsPerAttempt: 3, out: 'double', seed: 99 };
    const a = runDrill(config, []).view.headline;
    const b = runDrill(config, []).view.headline;
    expect(a).toBe(b);
    expect(Number(a) % 2).toBe(0);
  });
});

describe('Doppel-Leiter', () => {
  it('kostet bei aufgebrauchtem Budget ein Leben', () => {
    const config: DrillConfig = { engine: 'ladder', lives: 2, stages: [{ n: 20, budget: 2 }, { n: 16, budget: 1 }] };
    let r = runDrill(config, darts(D(20)));
    expect(r.view.target).toEqual({ n: 16, kind: 'double' });
    r = runDrill(config, darts(D(20), MISS, MISS));
    expect(r.finished).toBe(true);
    expect(r.result.primary.value).toBe(1);
  });
});

describe('Cricket', () => {
  it('schließt Felder und berechnet MPR', () => {
    const ev: Dart[] = [];
    for (const n of [20, 19, 18, 17, 16, 15]) ev.push(T(n));
    ev.push(makeDart(25, 2), makeDart(25, 1));
    const r = runDrill({ engine: 'cricket', maxRounds: 20 }, darts(...ev));
    expect(r.finished).toBe(true);
    expect(r.result.metrics.marks).toBe(21);
    expect(r.result.primary.value).toBeCloseTo((21 / 8) * 3);
  });

  it('Marks über drei zählen nicht', () => {
    const r = runDrill({ engine: 'cricket', maxRounds: 20 }, darts(T(20), T(20), S(1)));
    expect(r.result.metrics.marks).toBe(3);
  });
});

describe('Technik-Übung', () => {
  it('verlangt nach jeder Runde eine Bewertung', () => {
    const config: DrillConfig = { engine: 'focus', targets: [{ n: 20, kind: 'number' }], rounds: 2, cue: 'Follow-through halten', question: 'Gehalten?' };
    let r = runDrill(config, darts(S(20), S(1), S(20)));
    expect(r.view.awaiting).toBe('rating');
    // Darts werden ignoriert, solange die Bewertung fehlt
    r = runDrill(config, darts(S(20), S(1), S(20), S(20)));
    expect(r.throws).toHaveLength(3);
    r = runDrill(config, [...darts(S(20), S(1), S(20)), rate(2), ...darts(S(20), S(20), S(20)), rate(1)]);
    expect(r.finished).toBe(true);
    expect(r.result.primary.value).toBe(75);
  });
});

describe('X01 als Übung mit Bot', () => {
  const config: DrillConfig = {
    engine: 'x01',
    seed: 5,
    game: { start: 101, out: 'double', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }, { name: 'Bot', bot: { level: 5 } }] },
  };

  it('lässt nach der eigenen Aufnahme den Bot werfen und Undo entfernt beides', () => {
    let events: DrillEvent[] = darts(S(20), S(20), S(20));
    const botDart = nextBotDart(config, events);
    expect(botDart).not.toBeNull();
    events = [...events, { t: 'dart', dart: botDart!, bot: true }];
    expect(runDrill(config, events).throws).toHaveLength(3);
    expect(undoEvents(events)).toHaveLength(2);
  });

  it('kein Bot-Dart, wenn der Mensch am Zug ist', () => {
    expect(nextBotDart(config, [])).toBeNull();
  });

  it('ignoriert Bot-Darts, wenn der Mensch am Zug ist', () => {
    const r = runDrill(config, [{ t: 'dart', dart: S(20), bot: true }]);
    expect(r.view.panel?.type === 'x01' && r.view.panel.players[0].remaining).toBe(101);
  });

  it('Bot spielt ein Spiel deterministisch zu Ende', () => {
    let events: DrillEvent[] = [];
    for (let i = 0; i < 400; i++) {
      const run = runDrill(config, events);
      if (run.finished) break;
      const bot = nextBotDart(config, events);
      events = [...events, bot ? { t: 'dart', dart: bot, bot: true } : { t: 'dart', dart: MISS }];
    }
    const r = runDrill(config, events);
    expect(r.finished).toBe(true);
    expect(r.result.x01?.won).toBe(false);
  });
});

describe('Katalog', () => {
  it('jede Übung hat Pflichtangaben und lauffähige Varianten', () => {
    const ids = new Set<string>();
    for (const d of DRILLS) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      expect(d.name && d.goal && d.why && d.metricInfo).toBeTruthy();
      expect(d.rules.length).toBeGreaterThan(0);
      expect(d.howTo.length).toBeGreaterThan(0);
      for (const v of d.variants) {
        const r = runDrill(v.make(1), []);
        expect(r.view.awaiting).not.toBe('done');
        expect(r.result.primary.label).toBeTruthy();
      }
      if (d.beginnerVariant) expect(getVariant(d, d.beginnerVariant).id).toBe(d.beginnerVariant);
    }
    expect(DRILLS.length).toBeGreaterThanOrEqual(30);
  });

  it('jede Variante lässt sich mit simulierten Würfen zu Ende spielen', () => {
    for (const d of DRILLS) {
      for (const v of d.variants) {
        const config = v.make(3);
        if (config.engine === 'free' && !config.maxDarts) continue; // endet nur durch den Spieler
        let events: DrillEvent[] = [];
        let guard = 0;
        let run = runDrill(config, events);
        while (!run.finished && guard++ < 1500) {
          if (run.view.awaiting === 'rating') events = [...events, rate(run.view.rating!.options[0].value)];
          else {
            const bot = nextBotDart(config, events);
            const t = run.view.target;
            const aim = t ? aimPoint(t) : null;
            const perfect = config.engine === 'x01' ? run.view.quick?.[0] : undefined;
            const dart: Dart = bot ?? perfect ?? (aim && guard % 2 === 0 ? hitOf(t!) : guard % 3 === 0 ? D(20) : S(20));
            events = [...events, { t: 'dart', dart, bot: Boolean(bot) || undefined }];
          }
          run = runDrill(config, events);
        }
        expect(run.finished, `${d.id}/${v.id}`).toBe(true);
      }
    }
  });

  it('configKey ignoriert den Seed', () => {
    const v = getVariant(getDrill('checkout-doubles'));
    expect(configKey(v.make(1))).toBe(configKey(v.make(2)));
    expect(configKey(v.make(1))).not.toBe(configKey(getVariant(getDrill('checkout-doubles'), 'easy').make(1)));
  });
});
