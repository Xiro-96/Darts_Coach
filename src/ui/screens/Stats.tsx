import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, HelpCircle, Trophy } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../data/store';
import { compareAssessments, completedAssessments } from '../../domain/assessment';
import { insights, skillSnapshots, type SkillSnapshot } from '../../domain/coach';
import { findDrill } from '../../domain/drills/catalog';
import { centroid } from '../../domain/geometry';
import { sampleLabel } from '../../domain/statistics';
import {
  aimOffsets,
  biasFrom,
  bucketTrend,
  heatmapPoints,
  missDirections,
  overview,
  personalBests,
  segmentStats,
  sessionsInLastDays,
  visitScoreSpread,
  type TrendVerdict,
} from '../../domain/stats';
import { navigate } from '../router';
import { BoardHeatmap, HBarChart, OffsetPlot, TrendChart } from '../charts/Charts';
import { Card, Chip, cx, EmptyState, formatDuration, formatNum, formatPct, PageHeader, Segmented, SectionTitle, StatTile } from '../components/ui';
import { InsightCard } from './Dashboard';

type Period = '7' | '30' | '90' | 'all';

export function Stats() {
  const sessions = useApp((s) => s.sessions);
  const [period, setPeriod] = useState<Period>('30');

  const data = useMemo(() => {
    const now = Date.now();
    const days = period === 'all' ? null : Number(period);
    const scoped = sessionsInLastDays(sessions, days, now);
    const firstSession = sessions.length ? sessions[0].startedAt : now;
    const allWeeks = Math.min(26, Math.max(4, Math.ceil((now - firstSession) / (7 * 86400000)) + 1));
    const trend = period === '7' ? bucketTrend(sessions, 'day', 7, now) : bucketTrend(sessions, 'week', period === '30' ? 5 : period === '90' ? 13 : allWeeks, now);
    const segs = segmentStats(scoped).filter((s) => s.attempts >= 10);
    const offsets = aimOffsets(scoped);
    return {
      scoped,
      ov: overview(scoped),
      trend,
      skills: skillSnapshots(sessions, now),
      segs,
      dirs: missDirections(scoped).filter((m) => m.left + m.right >= 8),
      heat: heatmapPoints(scoped),
      offsets,
      bias: biasFrom(scoped),
      spread: visitScoreSpread(scoped),
      pbs: personalBests(sessions).sort((a, b) => b.time - a.time),
      insights: insights(sessions, now).insights,
      tests: completedAssessments(sessions),
    };
  }, [sessions, period]);

  if (sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Statistiken" subtitle="Leistung und Entwicklung analysieren" />
        <EmptyState icon={<BarChart3 />} title="Noch keine Daten" text="Hier erscheinen deine Statistiken – berechnet ausschließlich aus deinen erfassten Würfen. Starte dein erstes Training!" />
      </div>
    );
  }

  const { ov } = data;
  const trendData = data.trend.map((t) => ({ x: t.label, y: t.target.attempts >= 10 && t.target.rate !== null ? Math.round(t.target.rate * 1000) / 10 : null, n: t.target.attempts }));
  const groupData = data.trend.map((t) => ({ x: t.label, y: t.groupMm !== null && t.groupRounds >= 3 ? Math.round(t.groupMm) / 10 : null, n: t.groupRounds, nLabel: `${t.groupRounds} Gruppen` }));
  const zeroData = data.trend.map((t) => ({ x: t.label, y: t.zeroShare !== null && t.visits >= 5 ? Math.round(t.zeroShare * 100) : null, n: t.visits, nLabel: `${t.visits} Aufnahmen` }));
  const hasGroup = groupData.some((g) => g.y !== null);
  const hasZero = zeroData.some((g) => g.y !== null);
  const worst = [...data.segs].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).slice(0, 10);
  const center = centroid(data.heat);

  return (
    <div className="pb-6">
      <PageHeader title="Statistiken" subtitle="Nur Kennzahlen, die aus deinen Daten wirklich berechenbar sind" />
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        ariaLabel="Zeitraum"
        options={[
          { value: '7', label: '7 Tage' },
          { value: '30', label: '30 Tage' },
          { value: '90', label: '90 Tage' },
          { value: 'all', label: 'Gesamt' },
        ]}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kpis">
        <StatTile label="Trainingstage" value={ov.trainingDays} sub={`${ov.sessions} Einheiten`} />
        <StatTile label="Trainingszeit" value={formatDuration(ov.activeMs)} />
        <StatTile label="Geworfene Darts" value={ov.darts.toLocaleString('de-DE')} />
        <StatTile label="Zieltrefferquote" value={formatPct(ov.target.rate)} sub={ov.target.attempts ? `${ov.target.attempts} Zielwürfe · ${sampleLabel(ov.target.attempts)}` : 'keine Zielwürfe'} tone="accent" />
        <StatTile label="Doppelquote" value={formatPct(ov.doubles.rate)} sub={ov.doubles.attempts ? `${ov.doubles.hits} von ${ov.doubles.attempts}` : 'noch keine Doppel'} />
        <StatTile label="3-Dart-Average (Spiel)" value={formatNum(ov.gameAverage.value)} sub={ov.gameAverage.darts ? `aus ${ov.gameAverage.darts} Darts 301/501` : 'noch kein 301/501'} />
        <StatTile label="3-Dart-Average (Scoring)" value={formatNum(ov.scoringAverage.value)} sub={ov.scoringAverage.darts ? `aus ${ov.scoringAverage.darts} Darts` : 'noch keine Scoring-Übung'} />
        <StatTile
          label="Checkout-Quote"
          value={formatPct(ov.drillCheckout.attempts ? ov.drillCheckout.rate : ov.gameCheckout.rate)}
          sub={ov.drillCheckout.attempts ? `${ov.drillCheckout.hits}/${ov.drillCheckout.attempts} Versuche (Training)` : ov.gameCheckout.attempts ? `${ov.gameCheckout.hits}/${ov.gameCheckout.attempts} Darts aufs Doppel` : 'noch keine Checkouts'}
        />
      </div>

      <SectionTitle>Fähigkeiten</SectionTitle>
      <Card className="divide-y divide-line">
        {data.skills.length === 0 && <div className="p-4 text-sm text-ink-3">Noch zu wenige Daten.</div>}
        {data.skills.map((s) => (
          <SkillRow key={s.skill} s={s} />
        ))}
        <div className="flex items-start gap-2 p-4 text-xs text-ink-3">
          <HelpCircle size={14} className="mt-0.5 shrink-0" />
          „Deutlich besser“ erscheint nur, wenn sich neuere und ältere Daten statistisch klar unterscheiden (mind. 40 Darts je Zeitraum, p &lt; 0,05). Eine einzelne gute Einheit reicht dafür nicht.
        </div>
      </Card>

      <SectionTitle>Entwicklung der Zieltrefferquote</SectionTitle>
      <Card className="p-4">
        {trendData.some((d) => d.y !== null) ? (
          <TrendChart title="Zieltrefferquote" data={trendData} unit="%" digits={1} domain={[0, 'auto']} />
        ) : (
          <p className="text-sm text-ink-3">Mindestens 10 Zielwürfe pro {period === '7' ? 'Tag' : 'Woche'} nötig, damit ein Punkt erscheint.</p>
        )}
        <p className="mt-2 text-xs text-ink-3">{period === '7' ? 'Je Tag' : 'Je Woche'} · Punkte erst ab 10 Zielwürfen · Tooltip zeigt die Anzahl Darts</p>
      </Card>

      <SectionTitle>Konstanz</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="font-semibold">Gruppengröße</div>
          <p className="mb-2 text-xs text-ink-3">Ø größter Abstand von 3 Darts (cm) – kleiner ist besser. Nur gemessene Gruppen.</p>
          {hasGroup ? <TrendChart title="Gruppengröße" data={groupData} unit="cm" digits={1} domain={[0, 'auto']} color="var(--color-series-3)" /> : <p className="text-sm text-ink-3">Noch keine gemessenen Gruppen (Grouping über die Scheibe erfassen).</p>}
        </Card>
        <Card className="p-4">
          <div className="font-semibold">Aufnahmen ohne Treffer</div>
          <p className="mb-2 text-xs text-ink-3">Anteil der Aufnahmen, in denen keiner der 3 Darts das Ziel traf – kleiner ist besser.</p>
          {hasZero ? <TrendChart title="Aufnahmen ohne Treffer" data={zeroData} unit="%" domain={[0, 100]} color="var(--color-series-2)" /> : <p className="text-sm text-ink-3">Noch zu wenige Aufnahmen in Zielübungen.</p>}
        </Card>
      </div>
      {data.spread.sd !== null && data.spread.visits >= 10 && (
        <p className="mt-2 text-sm text-ink-2">
          Streuung deiner Aufnahme-Punkte (Scoring/301/501): ± {formatNum(data.spread.sd)} Punkte bei {data.spread.visits} Aufnahmen.
        </p>
      )}

      <SectionTitle>Schwachstellen – Erfolg je Zielfeld</SectionTitle>
      <Card className="p-4">
        {worst.length ? (
          <>
            <HBarChart title="Trefferquote je Zielfeld" data={worst.map((s) => ({ label: s.label, value: (s.rate ?? 0) * 100, n: s.attempts, display: `${Math.round((s.rate ?? 0) * 100)} %` }))} />
            <p className="mt-2 text-xs text-ink-3">Schwächste Ziele zuerst · nur Ziele mit mindestens 10 Darts · Werte bei kleinen Stichproben sind unsicher.</p>
          </>
        ) : (
          <p className="text-sm text-ink-3">Noch zu wenige Darts pro Zielfeld (mind. 10).</p>
        )}
      </Card>

      {data.dirs.length > 0 && (
        <>
          <SectionTitle>Wohin gehen Fehlwürfe?</SectionTitle>
          <Card className="divide-y divide-line">
            {data.dirs.map((m) => (
              <div key={m.n} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="num w-10 text-xl">{m.n}</span>
                <div className="flex flex-1 items-center gap-2">
                  <span className="w-14 text-right tabular text-ink-2">
                    {m.leftN}: {m.left}×
                  </span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-series-2" style={{ width: `${(m.left / Math.max(1, m.left + m.right)) * 100}%` }} />
                    <div className="h-full bg-series-3" style={{ width: `${(m.right / Math.max(1, m.left + m.right)) * 100}%` }} />
                  </div>
                  <span className="w-14 tabular text-ink-2">
                    {m.right}× :{m.rightN}
                  </span>
                </div>
                <span className="w-24 text-right text-xs text-ink-3">{m.p < 0.05 && m.left + m.right >= 15 ? 'klares Muster' : 'kein klares Muster'}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Trefferbild (Heatmap)</SectionTitle>
      <Card className="p-4">
        {data.heat.length >= 5 ? (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div>
              <BoardHeatmap points={data.heat} centroid={center} />
              <p className="mt-2 text-center text-xs text-ink-3">{data.heat.length} Positionen · weißer Kreis = Mittelpunkt aller Darts</p>
            </div>
            <div>
              <div className="font-semibold">Abweichung vom Zielpunkt</div>
              <p className="mb-2 text-xs text-ink-3">Nur Ziele mit eindeutigem Zielpunkt (Single-/Double-/Triple-Feld, Bull). Mitte = Zielpunkt.</p>
              {data.offsets.length >= 3 ? (
                <>
                  <OffsetPlot offsets={data.offsets} bias={data.bias} />
                  {data.bias && (
                    <p className="mt-2 text-sm text-ink-2">
                      Mittlere Abweichung: {formatNum(Math.abs(data.bias.dx) / 10)} cm {data.bias.dx < 0 ? 'links' : 'rechts'}, {formatNum(Math.abs(data.bias.dy) / 10)} cm {data.bias.dy < 0 ? 'tief' : 'hoch'} (n = {data.bias.n}).{' '}
                      {data.bias.significantX || data.bias.significantY ? 'Das ist eine deutliche, systematische Abweichung.' : 'Keine deutliche systematische Abweichung – die Streuung dominiert.'}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-3">Noch zu wenige Positionen auf Felder mit eindeutigem Zielpunkt.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-3">Die Heatmap braucht echte Trefferpositionen. Erfasse Würfe über die Scheibe (statt über Tasten), dann erscheint hier dein Trefferbild.</p>
        )}
        <p className="mt-3 text-xs text-ink-3">Positionen stammen aus deinem Antippen und sind daher auf etwa ±1 cm genau.</p>
      </Card>

      <BeforeAfter tests={data.tests} />

      <SectionTitle>Bestleistungen</SectionTitle>
      {data.pbs.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">Noch keine vollständig gespielten Übungen.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {data.pbs.slice(0, 15).map((pb) => {
            const def = findDrill(pb.drillId);
            const variant = def?.variants.find((v) => v.id === pb.variantId);
            return (
              <button key={pb.drillId + pb.configKey} onClick={() => def && navigate(`/train/drill/${def.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <Trophy size={16} className="shrink-0 text-flare" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{def?.name ?? pb.drillId}</div>
                  <div className="truncate text-xs text-ink-3">
                    {variant?.label ?? (pb.variantId.startsWith('plan') ? 'aus dem Trainingsplan' : pb.variantId.startsWith('assessment') ? 'Leistungstest' : 'Challenge')} · {pb.count} Durchgänge
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-xl">{pb.display}</div>
                  <div className="text-[11px] text-ink-3">{pb.label}</div>
                </div>
              </button>
            );
          })}
        </Card>
      )}

      {data.insights.length > 0 && (
        <>
          <SectionTitle>Alle Erkenntnisse</SectionTitle>
          <div className="flex flex-col gap-3">
            {data.insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </>
      )}
      <p className="mt-6 text-xs text-ink-3">
        Hinweis: Gruppengrößen, Heatmap und Abweichungen beruhen auf deinen angetippten Positionen. Ohne Board-Eingabe sind sie nicht verfügbar – sie werden nie aus Punktzahlen geschätzt.
      </p>
    </div>
  );
}

function verdictInfo(v: TrendVerdict): { label: string; icon: ReactNode; tone: string } {
  if (v === 'improved') return { label: 'deutlich besser', icon: <ArrowUpRight size={14} />, tone: 'text-good' };
  if (v === 'declined') return { label: 'zuletzt schwächer', icon: <ArrowDownRight size={14} />, tone: 'text-flare' };
  if (v === 'stable') return { label: 'stabil', icon: <ArrowRight size={14} />, tone: 'text-ink-2' };
  return { label: 'zu wenig Daten für Trend', icon: null, tone: 'text-ink-3' };
}

function SkillRow({ s }: { s: SkillSnapshot }) {
  const v = s.n >= 10 ? verdictInfo(s.trend) : { label: 'noch zu wenige Daten', icon: null, tone: 'text-ink-3' };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{s.label}</div>
        <div className="text-xs text-ink-3">
          {s.nLabel}
          {s.trendText ? ` · ${s.trendText}` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className="num text-2xl">{s.n >= 10 ? s.display : '–'}</div>
        <div className={cx('flex items-center justify-end gap-0.5 text-xs', v.tone)}>
          {v.icon}
          {v.label}
        </div>
      </div>
    </div>
  );
}

function BeforeAfter({ tests }: { tests: ReturnType<typeof completedAssessments> }) {
  return (
    <>
      <SectionTitle>Vorher-Nachher (Leistungstest)</SectionTitle>
      {tests.length < 2 ? (
        <Card className="p-4 text-sm text-ink-2">
          {tests.length === 0
            ? 'Noch kein Leistungstest. Der Eingangstest ist die Basis für deinen Vorher-Nachher-Vergleich.'
            : `Eingangstest vom ${new Date(tests[0].startedAt).toLocaleDateString('de-DE')} ist gespeichert. Wiederhole den Test (Trainieren → Challenges oder am Ende der Stufe), um deinen Fortschritt zu sehen.`}
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          <div className="px-4 py-3 text-xs text-ink-3" data-testid="before-after">
            {new Date(tests[0].startedAt).toLocaleDateString('de-DE')} → {new Date(tests[tests.length - 1].startedAt).toLocaleDateString('de-DE')}
          </div>
          {compareAssessments(tests[0], tests[tests.length - 1]).map((c) => {
            const v = verdictInfo(c.trend.verdict);
            return (
              <div key={c.part.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.part.title.replace(/^Test \d · /, '')}</div>
                  <div className={cx('flex items-center gap-0.5 text-xs', v.tone)}>
                    {v.icon}
                    {c.trend.verdict === 'stable' ? 'kein deutlicher Unterschied' : v.label}
                  </div>
                </div>
                <div className="num text-lg text-ink-3">{c.before.display}</div>
                <ArrowRight size={16} className="text-ink-3" />
                <div className="num text-2xl">{c.after.display}</div>
              </div>
            );
          })}
        </Card>
      )}
      {tests.length >= 2 && <Chip className="mt-2">Gleiche Aufgaben, gleiche Bedingungen – fairer Vergleich</Chip>}
    </>
  );
}
