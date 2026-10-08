import { describe, expect, it } from 'vitest';
import { ASSESSMENT_PARTS, assessmentPhases, compareAssessments } from './assessment';
import { makeDart } from './board';
import { challengeDone, dailyChallenge, goalReached, weeklyChallenge } from './challenges';
import { insights, nextDrillAfter, recommend, skillSnapshots, stagnatingDrills } from './coach';
import type { DrillEvent } from './drills/types';
import { badges, completedRun, levelInfo, sessionXp, xpForLevel } from './gamification';
import { advancePlan, buildPlanSession, PROGRAMS, stageStatus } from './plan';
import { activeMs, createActiveSession, finalizeSession, pause, recoverAfterGap, resume } from './session';
import { binomialTestHalf, twoProportionTest, welchTest, wilson } from './statistics';
import {
  compareRates,
  DAY_MS,
  drillHistory,
  isPersonalBest,
  missDirections,
  overview,
  personalBests,
  rate,
  segmentStats,
  weeklyTrend,
  zeroVisits,
} from './stats';
import { drillRecord, hitsOn, session, targetSession, testProfile } from './testing';
import type { Dart } from './types';

const NOW = new Date(2026, 9, 8, 18, 0, 0).getTime();
const days = (n: number) => NOW - n * DAY_MS;
const ev = (ds: Dart[]): DrillEvent[] => ds.map((dart) => ({ t: 'dart', dart }));

describe('Statistik-Grundlagen', () => {
  it('Wilson-Intervall', () => {
    const w = wilson(5, 10)!;
    expect(w.p).toBe(0.5);
    expect(w.low).toBeGreaterThan(0.2);
    expect(w.high).toBeLessThan(0.8);
    expect(wilson(0, 0)).toBeNull();
  });

  it('Zwei-Anteile-Test erkennt nur deutliche Unterschiede', () => {
    expect(twoProportionTest(30, 100, 50, 100)!.p).toBeLessThan(0.01);
    expect(twoProportionTest(3, 10, 5, 10)!.p).toBeGreaterThan(0.3);
  });

  it('Welch-Test und Binomialtest', () => {
    expect(welchTest([10, 11, 9, 10], [20, 21, 19, 20])!.p).toBeLessThan(0.001);
    expect(welchTest([10, 12, 9, 11], [11, 10, 12, 9])!.p).toBeGreaterThan(0.5);
    expect(binomialTestHalf(10, 20)).toBeCloseTo(1, 5);
    expect(binomialTestHalf(18, 20)).toBeLessThan(0.001);
  });

  it('eine einzelne gute Einheit ist keine nachhaltige Verbesserung', () => {
    expect(compareRates(rate(10, 30), rate(20, 30)).verdict).toBe('insufficient');
    expect(compareRates(rate(40, 120), rate(70, 120)).verdict).toBe('improved');
    expect(compareRates(rate(40, 120), rate(45, 120)).verdict).toBe('stable');
  });
});

describe('Auswertungen über Sessions', () => {
  const sessions = [
    targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 12, 5), days(10)),
    targetSession({ n: 19, kind: 'number' }, hitsOn(19, 30, 6, 7), days(9)),
    session(
      [
        drillRecord(
          'x01',
          { engine: 'x01', seed: 1, game: { start: 101, out: 'double', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }] } },
          ev([makeDart(20, 3), makeDart(1, 1), makeDart(0, 0), makeDart(0, 0), makeDart(20, 2)]),
          days(2),
        ),
      ],
      days(2),
    ),
  ];

  it('Übersicht zählt Darts, Treffer, Average und Checkout korrekt', () => {
    const o = overview(sessions);
    expect(o.darts).toBe(65);
    expect(o.target.hits).toBe(18 + 1); // + 1 Doppeltreffer im X01-Finish
    expect(o.gameAverage.value).toBeCloseTo((101 / 5) * 3);
    expect(o.gameCheckout.hits).toBe(1);
    expect(o.gameCheckout.attempts).toBe(3); // drei Darts bei 40 Rest aufs Doppel
    expect(o.trainingDays).toBe(3);
  });

  it('Segmentstatistik und Fehlwurf-Richtung', () => {
    const seg = segmentStats(sessions);
    expect(seg.find((s) => s.label === '20')).toMatchObject({ hits: 12, attempts: 30 });
    const dir = missDirections(sessions).find((m) => m.n === 20)!;
    expect(dir).toMatchObject({ left: 18, right: 0, leftN: 5, rightN: 1 });
    expect(dir.p).toBeLessThan(0.001);
  });

  it('Wochentrend', () => {
    const w = weeklyTrend(sessions, 3, NOW);
    expect(w).toHaveLength(3);
    expect(w.reduce((a, x) => a + x.darts, 0)).toBe(65);
  });

  it('Null-Aufnahmen', () => {
    const z = zeroVisits(sessions);
    expect(z.visits).toBe(20);
    expect(z.zero).toBe(6 + 8); // 20: 12 Treffer in den ersten 4 Aufnahmen; 19: 6 Treffer in 2 Aufnahmen
  });

  it('Bestleistungen nur aus vollständigen Durchgängen; erster Durchgang ist kein Rekord', () => {
    const a = targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 3), days(5));
    const b = targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 5), days(4));
    expect(isPersonalBest([], a.drills[0])).toBe(false);
    expect(isPersonalBest([a], b.drills[0])).toBe(true);
    expect(isPersonalBest([a, b], a.drills[0])).toBe(false);
    const pb = personalBests([a, b]);
    expect(pb[0].value).toBeCloseTo((5 / 9) * 100);
    expect(drillHistory([a, b], 'big-singles')).toHaveLength(2);
  });
});

describe('Coach', () => {
  it('erkennt echte Verbesserung erst mit ausreichender Datenbasis', () => {
    const before = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 8), days(30 + i)));
    const after = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 18), days(1 + i)));
    const snap = skillSnapshots([...before, ...after], NOW).find((s) => s.skill === 'singles')!;
    expect(snap.trend).toBe('improved');
    const ins = insights([...before, ...after], NOW);
    expect(ins.insights.some((i) => i.kind === 'positive' && i.id === 'up-singles')).toBe(true);

    const one = skillSnapshots([before[0], after[0]], NOW).find((s) => s.skill === 'singles')!;
    expect(one.trend).toBe('insufficient');
  });

  it('meldet Fehlwurf-Muster nur als Muster, nicht als Ursache', () => {
    const s = [0, 1].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 10, 5), days(i + 1)));
    const ins = insights(s, NOW).insights.find((i) => i.id === 'dir-20')!;
    expect(ins.kind).toBe('pattern');
    expect(ins.text).toContain('keine Diagnose');
  });

  it('empfiehlt die schwächste Fähigkeit der Stufe und erklärt warum', () => {
    const s = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 5), days(i + 1)));
    const rec = recommend(testProfile(), s, ['consistency', 'singles'], ['stance', 'grip'], NOW);
    expect(rec.focusSkill).toBe('singles');
    expect(rec.focusReason).toContain('Baustelle');
    expect(rec.technique).toBe('stance');
  });

  it('rotiert den Technikschwerpunkt und überspringt "sitzt"', () => {
    const last = session([], days(1), { techniqueFocus: 'stance' });
    const rec = recommend(testProfile({ techniqueStatus: { grip: 'solid' } }), [last], ['singles'], ['stance', 'grip', 'aim'], NOW);
    expect(rec.technique).toBe('aim');
  });

  it('empfiehlt Pause bei hoher Belastung', () => {
    const s = [0, 1, 2, 3, 4, 5].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 3), days(i) - 3600000));
    expect(recommend(testProfile(), s, ['singles'], ['stance'], NOW).load).toBe('light');
  });

  it('Folgeübung: erst nach mehreren guten Durchgängen eine Stufe höher', () => {
    const cfg = { engine: 'target' as const, targets: [{ n: 20, kind: 'number' as const }, { n: 19, kind: 'number' as const }], rotation: 'block' as const, blockSize: 12, totalDarts: 24, scoring: 'hits' as const };
    const mk = (hits: number, at: number) => session([drillRecord('big-singles', cfg, ev(hitsOn(20, 24, hits)), at, 'easy')], at);
    const s1 = mk(20, days(3));
    expect(nextDrillAfter([s1], s1.drills[0]).drillId).toBe('big-singles');
    expect(nextDrillAfter([s1], s1.drills[0]).reason).toContain('Erster Durchgang');
    const s2 = mk(19, days(2));
    const next = nextDrillAfter([s1, s2], s2.drills[0]);
    expect(next).toMatchObject({ drillId: 'big-singles', variantId: 'number' });
  });

  it('erkennt Plateaus', () => {
    const s = [6, 5, 4, 3, 2, 1].map((d, i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 12 + (i % 2)), days(d)));
    expect(stagnatingDrills(s).length).toBe(1);
  });
});

describe('Trainingsplan', () => {
  it('beginnt mit dem Eingangstest', () => {
    const plan = buildPlanSession(testProfile(), [], 'abc', NOW);
    expect(plan.kind).toBe('assessment');
    expect(plan.phases).toHaveLength(ASSESSMENT_PARTS.length);
  });

  it('stellt nach dem Test eine 30-Minuten-Einheit in fünf Phasen zusammen', () => {
    const test = session([], days(1), { kind: 'assessment', plan: { program: 'foundation', stage: 0 } });
    const plan = buildPlanSession(testProfile(), [test], 'abc', NOW);
    expect(plan.kind).toBe('plan');
    expect(plan.phases.map((p) => p.id)).toEqual(['warmup', 'technique', 'main', 'switch', 'challenge']);
    expect(plan.phases.reduce((a, p) => a + p.minutes, 0)).toBe(30);
    expect(plan.phases[0].optionalInput).toBe(true);
    expect(plan.techniqueFocus).toBeDefined();
  });

  it('passt die Länge an die verfügbare Zeit an', () => {
    const test = session([], days(1), { kind: 'assessment', plan: { program: 'foundation', stage: 0 } });
    expect(buildPlanSession(testProfile({ sessionMinutes: 10 }), [test], 'x', NOW).phases).toHaveLength(3);
    expect(buildPlanSession(testProfile({ sessionMinutes: 45 }), [test], 'x', NOW).phases).toHaveLength(6);
  });

  it('steigt erst nach Einheiten UND erfülltem Kriterium auf', () => {
    const profile = testProfile({ plan: { program: 'foundation', stage: 2, stageStartedAt: days(20), history: [] } });
    const weak = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 5), days(10 - i), { kind: 'plan', plan: { program: 'foundation', stage: 2 } }));
    let st = stageStatus(profile, weak);
    expect(st.sessionsDone).toBe(3);
    expect(st.requirementMet).toBe(false);
    expect(st.canAdvance).toBe(false);
    const strong = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 14), days(5 - i), { kind: 'plan', plan: { program: 'foundation', stage: 2 } }));
    st = stageStatus(profile, [...weak, ...strong]);
    expect(st.requirementMet).toBe(true);
    const adv = advancePlan(profile, [...weak, ...strong], NOW);
    expect(adv.advanced).toBe(true);
    expect(adv.profile.plan.stage).toBe(3);
    expect(adv.profile.plan.history).toHaveLength(1);
  });

  it('geht nach zusätzlichen Einheiten trotzdem weiter (kein Feststecken)', () => {
    const profile = testProfile({ plan: { program: 'foundation', stage: 2, stageStartedAt: 0, history: [] } });
    const weak = [0, 1, 2, 3, 4, 5].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 3), days(10 - i), { kind: 'plan', plan: { program: 'foundation', stage: 2 } }));
    const st = stageStatus(profile, weak);
    expect(st.canAdvance).toBe(true);
    expect(st.advanceDespite).toBe(true);
  });

  it('Stufe 4 endet mit dem Wiederholungstest und wechselt ins Aufbau-Programm', () => {
    const profile = testProfile({ plan: { program: 'foundation', stage: 3, stageStartedAt: 0, history: [] } });
    const plans = [0, 1].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 10), days(5 - i), { kind: 'plan', plan: { program: 'foundation', stage: 3 } }));
    expect(buildPlanSession(profile, plans, 'x', NOW).kind).toBe('assessment');
    const retest = session([], days(1), { kind: 'assessment', plan: { program: 'foundation', stage: 3 } });
    const adv = advancePlan(profile, [...plans, retest], NOW);
    expect(adv.profile.plan.program).toBe('build');
    expect(PROGRAMS.foundation.stages).toHaveLength(4);
  });
});

describe('Leistungstest-Vergleich', () => {
  function runAssessment(at: number, hitsPerPart: number, groupSpread: number) {
    const drills = assessmentPhases().map((p, i) => {
      const t0 = at + i * 60000;
      if (p.config.engine === 'grouping') {
        const ds: Dart[] = [];
        for (let r = 0; r < 5; r++) ds.push({ n: 25, m: 1, p: { x: 0, y: 0 } }, { n: 25, m: 1, p: { x: groupSpread, y: 0 } }, { n: 25, m: 1, p: { x: 0, y: groupSpread + r } });
        return drillRecord(p.drillId, p.config, ev(ds), t0, p.variantId);
      }
      const n = p.config.engine === 'target' ? p.config.totalDarts : 0;
      const ds: Dart[] = [];
      const run = (k: number) => {
        if (p.config.engine !== 'target') return makeDart(0, 0);
        const c = p.config;
        const idx = c.rotation === 'dart' ? k % c.targets.length : c.rotation === 'visit' ? Math.floor(k / 3) % c.targets.length : Math.floor(k / (c.blockSize ?? 3)) % c.targets.length;
        const t = c.targets[idx];
        return k < hitsPerPart ? makeDart(t.n, t.kind === 'double' ? 2 : 1) : makeDart(0, 0);
      };
      for (let k = 0; k < n; k++) ds.push(run(k));
      return drillRecord(p.drillId, p.config, ev(ds), t0, p.variantId);
    });
    return session(drills, at, { kind: 'assessment' });
  }

  it('vergleicht Teiltests mit Signifikanzprüfung', () => {
    const base = runAssessment(days(30), 4, 120);
    const re = runAssessment(days(1), 16, 40);
    const cmp = compareAssessments(base, re);
    const singles = cmp.find((c) => c.part.id === 'singles')!;
    expect(singles.before.value).toBeCloseTo((4 / 27) * 100);
    expect(singles.after.value).toBeCloseTo((16 / 27) * 100);
    expect(singles.trend.verdict).toBe('improved');
    const grouping = cmp.find((c) => c.part.id === 'grouping')!;
    expect(grouping.after.value!).toBeLessThan(grouping.before.value!);
    expect(grouping.trend.verdict).toBe('improved');
  });
});

describe('Gamification', () => {
  it('Level-Schwellen steigen', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(2));
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(4) + 1).level).toBe(4);
  });

  it('XP belohnen Abschluss und Plan, Darts nur begrenzt pro Tag', () => {
    const s = targetSession({ n: 20, kind: 'number' }, hitsOn(20, 300, 100), days(0), { kind: 'plan' });
    const xp = sessionXp(s, [], 1);
    expect(xp.lines.find((l) => l.label === 'Geworfene Darts')!.xp).toBe(40);
    expect(xp.total).toBe(50 + 25 + 40 + 20);
    const again = sessionXp(s, [s], 0);
    expect(again.lines.find((l) => l.label === 'Geworfene Darts')).toBeUndefined();
  });

  it('Abzeichen werden aus den Daten abgeleitet', () => {
    const s = [0, 1, 2].map((i) => targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 3), days(3 - i)));
    const b = badges(testProfile(), s, NOW);
    expect(b.find((x) => x.id === 'first')!.earned).toBe(true);
    expect(b.find((x) => x.id === 'three-in-row')!.earned).toBe(true);
    expect(b.find((x) => x.id === 'streak3')!.earned).toBe(true);
    expect(b.find((x) => x.id === 'baseline')!.earned).toBe(false);
    expect(completedRun([...s, session([], days(0), { completed: false })]).current).toBe(0);
  });
});

describe('Challenges', () => {
  it('Tageschallenge ist pro Tag stabil und wechselt täglich', () => {
    const p = testProfile();
    const a = dailyChallenge(p, [], NOW);
    expect(dailyChallenge(p, [], NOW + 1000).id).toBe(a.id);
    const b = dailyChallenge(p, [], NOW + DAY_MS);
    expect(b.id).not.toBe(a.id);
    expect(b.title).not.toBe(a.title);
  });

  it('Zielprüfung', () => {
    const s = targetSession({ n: 20, kind: 'number' }, hitsOn(20, 30, 12), days(0));
    expect(goalReached(s.drills[0].result, { metric: 'hits', op: '>=', value: 10 })).toBe(true);
    expect(goalReached(s.drills[0].result, { metric: 'hits', op: '>=', value: 13 })).toBe(false);
    expect(challengeDone([{ ...s, challengeId: 'x', challengeSuccess: true }], 'x')).toBe(true);
  });

  it('Wochenchallenge zählt nur die aktuelle Woche', () => {
    const w = weeklyChallenge(testProfile(), [], NOW);
    expect(w.current).toBe(0);
    expect(w.goal).toBeGreaterThan(0);
  });
});

describe('Session-Lebenszyklus', () => {
  const phases = [
    { id: 'w', title: 'Warm-up', coach: '', drillId: 'free', variantId: 'x', config: { engine: 'free' as const, maxDarts: 3 }, minutes: 1, optionalInput: true },
    {
      id: 'm',
      title: 'Haupt',
      coach: '',
      drillId: 'big-singles',
      variantId: 'x',
      config: { engine: 'target' as const, targets: [{ n: 20, kind: 'number' as const }], rotation: 'visit' as const, totalDarts: 3, scoring: 'hits' as const },
      minutes: 1,
    },
  ];

  it('Pausen zählen nicht zur Trainingszeit; lange Lücken werden als Pause gewertet', () => {
    let a = createActiveSession({ id: 'x', kind: 'single', title: 'T', phases, startedAt: 0 });
    a = pause(a, 60000);
    a = resume(a, 120000);
    expect(activeMs(a, 180000)).toBe(120000);
    const gap = recoverAfterGap(a, 200000, 2000000);
    expect(gap.pausedAt).toBe(200000);
  });

  it('Abschluss: optionales Warm-up ohne Eingabe stört nicht, XP und Rekorde', () => {
    const a = createActiveSession({ id: 'x', kind: 'single', title: 'T', phases, startedAt: NOW - 600000 });
    a.progress[1].events = ev(hitsOn(20, 3, 2));
    const out = finalizeSession(a, [], NOW);
    expect(out.record.completed).toBe(true);
    expect(out.record.drills).toHaveLength(1);
    expect(out.record.xp).toBeGreaterThan(0);
    const b = createActiveSession({ id: 'y', kind: 'single', title: 'T', phases, startedAt: NOW - 300000 });
    b.progress[1].events = ev(hitsOn(20, 3, 3));
    const out2 = finalizeSession(b, [out.record], NOW);
    expect(out2.personalBests).toHaveLength(1);
  });

  it('abgebrochene Einheit gilt nicht als abgeschlossen', () => {
    const a = createActiveSession({ id: 'z', kind: 'single', title: 'T', phases, startedAt: NOW - 600000 });
    a.progress[1].events = ev(hitsOn(20, 1, 1));
    expect(finalizeSession(a, [], NOW).record.completed).toBe(false);
  });
});
