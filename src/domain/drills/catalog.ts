import type { Target } from '../types';
import type { DrillConfig } from './types';

export type Category = 'basics' | 'scoring' | 'doubles' | 'checkout' | 'game' | 'technique';
export type Skill = 'consistency' | 'singles' | 'switching' | 'scoring' | 'trebles' | 'doubles' | 'checkout' | 'game' | 'routine';
export type DrillLevel = 1 | 2 | 3;
export type TechniqueId = 'stance' | 'grip' | 'aim' | 'backswing' | 'release' | 'followThrough' | 'rhythm';

export const CATEGORY_INFO: Record<Category, { label: string; description: string }> = {
  basics: { label: 'Grundlagen & Präzision', description: 'Gruppieren, große Felder treffen, Zielwechsel – das Fundament.' },
  scoring: { label: 'Scoring', description: 'Punkte machen: 20er, 19er, Triples, Highscores.' },
  doubles: { label: 'Doubles', description: 'Ohne Doppel kein Sieg: Doppel gezielt trainieren.' },
  checkout: { label: 'Checkouts', description: 'Finish-Wege verstehen und sicher auschecken.' },
  game: { label: 'Spieltraining', description: '301, 501 und Cricket – unter echten Regeln.' },
  technique: { label: 'Technik & Konstanz', description: 'Ein Technikschwerpunkt pro Runde – Prozess statt Punkte.' },
};

export const LEVEL_LABEL: Record<DrillLevel, string> = { 1: 'Einsteiger', 2: 'Fortgeschritten', 3: 'Experte' };

export const SKILL_LABEL: Record<Skill, string> = {
  consistency: 'Konstanz & Gruppierung',
  singles: 'Single-Felder',
  switching: 'Zielwechsel',
  scoring: 'Scoring',
  trebles: 'Triples',
  doubles: 'Doppel',
  checkout: 'Checkout',
  game: 'Spielpraxis',
  routine: 'Routine & Technik',
};

export interface DrillVariant {
  id: string;
  label: string;
  description: string;
  make: (seed: number) => DrillConfig;
}

export interface DrillDef {
  id: string;
  name: string;
  category: Category;
  level: DrillLevel;
  durationMin: number;
  skills: Skill[];
  /** Ziel der Übung in einem Satz. */
  goal: string;
  /** Warum die Übung sinnvoll ist. */
  why: string;
  howTo: string[];
  rules: string[];
  variants: DrillVariant[];
  /** Vereinfachte Variante für Anfänger. */
  beginnerVariant?: string;
  /** Erklärung der Hauptkennzahl. */
  metricInfo: string;
  technique?: TechniqueId;
  /** Spezielle Oberfläche (Metronom / Routine-Player) einblenden. */
  companion?: 'metronome' | 'routine';
}

const num = (n: number): Target => ({ n, kind: 'number' });
const single = (n: number): Target => ({ n, kind: 'single' });
const dbl = (n: number): Target => ({ n, kind: 'double' });
const tpl = (n: number): Target => ({ n, kind: 'triple' });
const BULL: Target = { n: 25, kind: 'bull' };

export const LADDER_STAGES = [
  { n: 20, budget: 9 },
  { n: 16, budget: 9 },
  { n: 8, budget: 9 },
  { n: 10, budget: 6 },
  { n: 12, budget: 6 },
  { n: 18, budget: 6 },
  { n: 4, budget: 6 },
  { n: 14, budget: 3 },
  { n: 6, budget: 3 },
  { n: 25, budget: 3 },
];

function focus(id: string, technique: TechniqueId, name: string, cue: string, question: string, extra: Partial<DrillDef>): DrillDef {
  return {
    id,
    name,
    category: 'technique',
    level: 1,
    durationMin: 6,
    skills: ['routine', 'consistency'],
    goal: cue,
    why: 'Pro Runde nur EIN Technikmerkmal – so lernt dein Körper eine Veränderung nach der anderen, statt durch viele gleichzeitige Korrekturen verwirrt zu werden.',
    howTo: [],
    rules: [
      'Wirf 8 Runden à 3 Darts auf das angezeigte Ziel.',
      'Konzentriere dich ausschließlich auf den Schwerpunkt dieser Übung.',
      'Bewerte nach jeder Runde ehrlich, ob du den Schwerpunkt umsetzen konntest.',
      'Die Treffer werden mitgezählt, sind hier aber zweitrangig.',
    ],
    variants: [
      {
        id: 'standard',
        label: '8 Runden',
        description: 'Ziel: große 20',
        make: () => ({ engine: 'focus', targets: [num(20)], rounds: 8, cue, question }),
      },
      {
        id: 'bull',
        label: 'Auf Bull',
        description: 'Ziel: Bull – mittig, ideal zum Ausrichten',
        make: () => ({ engine: 'focus', targets: [BULL], rounds: 8, cue, question }),
      },
    ],
    metricInfo: 'Routine-Treue: Anteil der Runden, in denen du den Schwerpunkt sauber umgesetzt hast (Teilweise zählt halb). Selbsteinschätzung.',
    technique,
    ...extra,
  };
}

export const DRILLS: DrillDef[] = [
  // ---------------- Grundlagen & Präzision ----------------
  {
    id: 'grouping',
    name: 'Grouping',
    category: 'basics',
    level: 1,
    durationMin: 8,
    skills: ['consistency'],
    goal: 'Drei Darts möglichst eng zusammen werfen – egal, wie viele Punkte.',
    why: 'Eine enge Gruppe zeigt, dass dein Wurf wiederholbar ist. Ist die Gruppe eng, musst du später nur noch den Zielpunkt verschieben. Streut sie, hilft auch perfektes Zielen nicht.',
    howTo: [
      'Wähle ein Ziel (Standard: Bull) und nimm deinen normalen Stand ein.',
      'Wirf drei Darts mit exakt gleichem Ablauf.',
      'Tippe auf der Scheibe möglichst genau an, wo die Darts stecken.',
      'Ziehe die Darts erst, nachdem du alle drei erfasst hast.',
    ],
    rules: ['8 Runden à 3 Darts.', 'Gemessen wird der größte Abstand zweier Darts einer Runde (Gruppengröße).', 'Kleiner ist besser.'],
    variants: [
      {
        id: 'bull-measure',
        label: 'Bull · gemessen',
        description: 'Positionen auf der Scheibe antippen – die App misst die Gruppengröße.',
        make: () => ({ engine: 'grouping', targets: [BULL], rounds: 8, measure: 'positions' }),
      },
      {
        id: 's20-measure',
        label: '20 · gemessen',
        description: 'Ziel: großes Single-Feld der 20.',
        make: () => ({ engine: 'grouping', targets: [single(20)], rounds: 8, measure: 'positions' }),
      },
      {
        id: 'bull-self',
        label: 'Bull · Selbsteinschätzung',
        description: 'Ohne Antippen – du schätzt nach jeder Runde selbst ein.',
        make: () => ({ engine: 'grouping', targets: [BULL], rounds: 8, measure: 'self' }),
      },
    ],
    metricInfo: 'Ø Gruppengröße in cm aus deinen angetippten Positionen. Die Genauigkeit hängt davon ab, wie genau du tippst (ca. ±1 cm).',
  },
  {
    id: 'big-singles',
    name: 'Big Singles',
    category: 'basics',
    level: 1,
    durationMin: 8,
    skills: ['singles'],
    goal: 'Die großen Single-Felder der 20, 19, 18 und 17 sicher treffen.',
    why: 'Die großen Felder sind die ersten Ziele, die du zuverlässig beherrschen solltest. Wer die 20 sicher trifft, macht im Spiel konstant Punkte – lange bevor Triples ein Thema sind.',
    howTo: [
      'Ziele auf das große, innere Single-Feld (zwischen Bull und Triple-Ring).',
      'Wirf 9 Darts (3 Aufnahmen) auf jede Zahl.',
      'Erfasse jeden Dart – auch Fehlwürfe in Nachbarfelder (die Tasten links/rechts helfen).',
    ],
    rules: ['Zielfolge: 20 → 19 → 18 → 17, je 9 Darts.', 'Treffer = richtige Zahl (Single, Double oder Triple).', 'Ergebnis: Trefferquote.'],
    variants: [
      {
        id: 'number',
        label: 'Ganze Zahl',
        description: 'Jeder Treffer im Segment zählt.',
        make: () => ({ engine: 'target', targets: [num(20), num(19), num(18), num(17)], rotation: 'block', blockSize: 9, totalDarts: 36, scoring: 'hits' }),
      },
      {
        id: 'single',
        label: 'Nur Single',
        description: 'Nur die Single-Felder zählen – genauer.',
        make: () => ({ engine: 'target', targets: [single(20), single(19), single(18), single(17)], rotation: 'block', blockSize: 9, totalDarts: 36, scoring: 'hits' }),
      },
      {
        id: 'easy',
        label: 'Einsteiger',
        description: 'Nur 20 und 19, je 12 Darts.',
        make: () => ({ engine: 'target', targets: [num(20), num(19)], rotation: 'block', blockSize: 12, totalDarts: 24, scoring: 'hits' }),
      },
    ],
    beginnerVariant: 'easy',
    metricInfo: 'Trefferquote auf die jeweilige Zielzahl.',
  },
  {
    id: 'atc',
    name: 'Around the Clock',
    category: 'basics',
    level: 1,
    durationMin: 10,
    skills: ['singles', 'switching'],
    goal: 'Die Zahlen 1 bis 20 nacheinander treffen – und zum Schluss das Bull.',
    why: 'Du lernst jede Zahl der Scheibe kennen und übst, deinen Zielpunkt ständig zu verschieben, ohne den Wurf zu verändern.',
    howTo: ['Beginne bei der 1.', 'Erst wenn du die aktuelle Zahl triffst, geht es zur nächsten.', 'Erfasse jeden Dart – die App springt automatisch weiter.'],
    rules: [
      'Ziel ist die aktuelle Zahl; je nach Variante zählt das ganze Segment, nur Single, nur Double oder nur Triple.',
      'Nach der 20 folgt das Bull (bei der Double-Variante das Bullseye).',
      'Ergebnis: benötigte Darts (weniger ist besser).',
    ],
    variants: [
      {
        id: 'number',
        label: 'Ganze Zahl',
        description: 'Ganzes Segment zählt, mit Bull.',
        make: () => ({ engine: 'atc', ring: 'number', bull: true, jump: false }),
      },
      {
        id: 'single',
        label: 'Nur Single',
        description: 'Nur Single-Felder zählen.',
        make: () => ({ engine: 'atc', ring: 'single', bull: true, jump: false }),
      },
      {
        id: 'double',
        label: 'Nur Double',
        description: 'Nur Doppel zählen (max. 120 Darts).',
        make: () => ({ engine: 'atc', ring: 'double', bull: true, jump: false, maxDarts: 120 }),
      },
      {
        id: 'triple',
        label: 'Nur Triple',
        description: 'Nur Triples zählen (max. 120 Darts).',
        make: () => ({ engine: 'atc', ring: 'triple', bull: false, jump: false, maxDarts: 120 }),
      },
      {
        id: 'jump',
        label: 'Mit Sprüngen',
        description: 'Double springt 2, Triple 3 Zahlen weiter.',
        make: () => ({ engine: 'atc', ring: 'number', bull: true, jump: true }),
      },
      {
        id: 'short',
        label: 'Einsteiger (60 Darts)',
        description: 'Ganze Zahl, ohne Bull, max. 60 Darts – Ziel: so weit wie möglich kommen.',
        make: () => ({ engine: 'atc', ring: 'number', bull: false, jump: false, maxDarts: 60 }),
      },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Benötigte Darts für eine komplette Runde. Bei Varianten mit Dart-Limit: geschaffte Ziele.',
  },
  {
    id: 'follow-leader',
    name: 'Follow the Leader',
    category: 'basics',
    level: 1,
    durationMin: 6,
    skills: ['consistency'],
    goal: 'Dart 2 und 3 landen dort, wo Dart 1 gelandet ist.',
    why: 'Du trainierst Wiederholbarkeit statt Zielen: Wenn der erste Dart z. B. in der 5 landet, wiederholst du exakt denselben Wurf. Das zeigt, wie konstant dein Ablauf ist.',
    howTo: ['Wirf den ersten Dart auf dein Wunschziel (z. B. 20).', 'Wo er landet, wird zum Ziel für Dart 2 und 3.', 'Nicht korrigieren – einfach denselben Wurf wiederholen.'],
    rules: ['8 Runden.', 'Treffer = gleiches Feld wie der erste Dart (Zahl und Ring).', 'Mit Positionsangabe wird zusätzlich der Abstand in cm gemessen.'],
    variants: [{ id: 'standard', label: '8 Runden', description: '24 Darts', make: () => ({ engine: 'follow', rounds: 8 }) }],
    metricInfo: 'Anteil der Folgedarts im gleichen Feld wie der erste Dart.',
  },
  {
    id: 'target-switch',
    name: 'Zielwechsel',
    category: 'basics',
    level: 2,
    durationMin: 8,
    skills: ['switching', 'singles'],
    goal: 'Präzision halten, obwohl sich das Ziel nach jedem Dart ändert.',
    why: 'Im Spiel wechselt das Ziel ständig. Wer nur auf eine Zahl trainiert, verliert die Präzision beim Wechsel. Wechselndes Üben verbessert laut Studien zur Motorik das langfristige Lernen.',
    howTo: ['Dart 1 auf die 20, Dart 2 auf die 19, Dart 3 auf die 18.', 'Den Stand nicht verändern – nur Blick und Arm neu ausrichten.', 'Vor jedem Dart kurz neu fokussieren.'],
    rules: ['10 Aufnahmen = 30 Darts.', 'Treffer = richtige Zahl.', 'Ergebnis: Trefferquote.'],
    variants: [
      {
        id: 'top',
        label: '20 · 19 · 18',
        description: 'Ziel wechselt nach jedem Dart.',
        make: () => ({ engine: 'target', targets: [num(20), num(19), num(18)], rotation: 'dart', totalDarts: 30, scoring: 'hits' }),
      },
      {
        id: 'cross',
        label: 'Kreuz 20 · 6 · 3 · 11',
        description: 'Oben, rechts, unten, links – trainiert die Ausrichtung in alle Richtungen.',
        make: () => ({ engine: 'target', targets: [num(20), num(6), num(3), num(11)], rotation: 'dart', totalDarts: 32, scoring: 'hits' }),
      },
      {
        id: 'visit',
        label: 'Einsteiger',
        description: 'Ziel wechselt erst nach jeder Aufnahme (20 → 19 → 18).',
        make: () => ({ engine: 'target', targets: [num(20), num(19), num(18)], rotation: 'visit', totalDarts: 27, scoring: 'hits' }),
      },
    ],
    beginnerVariant: 'visit',
    metricInfo: 'Trefferquote auf die jeweils angesagte Zahl.',
  },

  // ---------------- Scoring ----------------
  {
    id: 'twenty-training',
    name: '20er-Training',
    category: 'scoring',
    level: 1,
    durationMin: 8,
    skills: ['scoring'],
    goal: 'So viele Punkte wie möglich im Segment der 20 sammeln.',
    why: 'Die 20 ist das wichtigste Scoring-Ziel. Hier zählt jeder Treffer im Segment – Triples bringen Bonuspunkte.',
    howTo: ['Ziele auf die 20 (Anfänger: großes Single-Feld, später: Triple).', 'Wirf 15 Aufnahmen.', 'Nur Darts im 20er-Segment zählen.'],
    rules: ['45 Darts.', 'Punkte nur für Treffer in der 20 (S20 = 20, D20 = 40, T20 = 60).', 'Maximal 2700 Punkte.'],
    variants: [
      { id: 'standard', label: '45 Darts', description: '15 Aufnahmen', make: () => ({ engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 45, scoring: 'points' }) },
      { id: 'short', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 30, scoring: 'points' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Summe der Punkte im 20er-Segment.',
  },
  {
    id: 'nineteen-training',
    name: '19er-Training',
    category: 'scoring',
    level: 1,
    durationMin: 8,
    skills: ['scoring'],
    goal: 'Die 19 als zweites Scoring-Ziel etablieren.',
    why: 'Wenn die 20 blockiert ist oder du immer links abrutschst, ist die 19 die beste Alternative. Viele Spieler gruppieren auf der 19 sogar besser.',
    howTo: ['Ziele auf die 19 (unten links).', 'Wirf 15 Aufnahmen.', 'Nur Darts im 19er-Segment zählen.'],
    rules: ['45 Darts.', 'Punkte nur für Treffer in der 19.', 'Maximal 2565 Punkte.'],
    variants: [
      { id: 'standard', label: '45 Darts', description: '15 Aufnahmen', make: () => ({ engine: 'target', targets: [num(19)], rotation: 'visit', totalDarts: 45, scoring: 'points' }) },
      { id: 'short', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [num(19)], rotation: 'visit', totalDarts: 30, scoring: 'points' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Summe der Punkte im 19er-Segment.',
  },
  {
    id: 't20',
    name: 'Triple-20-Training',
    category: 'scoring',
    level: 2,
    durationMin: 8,
    skills: ['trebles', 'scoring'],
    goal: 'Die Triple 20 so oft wie möglich treffen.',
    why: 'Die T20 ist das Ziel für hohe Aufnahmen. Die Quote ist der direkteste Messwert für dein Scoring-Potenzial.',
    howTo: ['Ziele genau auf die T20.', 'Achte bei Fehlwürfen auf die Richtung (5 links, 1 rechts) – die Tasten erfassen das schnell.'],
    rules: ['45 Darts auf T20.', 'Treffer = nur Triple 20.'],
    variants: [
      { id: 'standard', label: '45 Darts', description: '15 Aufnahmen', make: () => ({ engine: 'target', targets: [tpl(20)], rotation: 'visit', totalDarts: 45, scoring: 'hits' }) },
      { id: 'short', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [tpl(20)], rotation: 'visit', totalDarts: 30, scoring: 'hits' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Trefferquote auf die Triple 20.',
  },
  {
    id: 't19',
    name: 'Triple-19-Training',
    category: 'scoring',
    level: 2,
    durationMin: 8,
    skills: ['trebles', 'scoring'],
    goal: 'Die Triple 19 als Ausweichziel beherrschen.',
    why: 'Für Checkouts (z. B. 97 = T19 D20) und als Scoring-Alternative brauchst du die T19.',
    howTo: ['Ziele genau auf die T19.', 'Fehlwürfe in 7 (links) und 3 (rechts) mit erfassen.'],
    rules: ['45 Darts auf T19.', 'Treffer = nur Triple 19.'],
    variants: [
      { id: 'standard', label: '45 Darts', description: '15 Aufnahmen', make: () => ({ engine: 'target', targets: [tpl(19)], rotation: 'visit', totalDarts: 45, scoring: 'hits' }) },
      { id: 'short', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [tpl(19)], rotation: 'visit', totalDarts: 30, scoring: 'hits' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Trefferquote auf die Triple 19.',
  },
  {
    id: 'hundred-darts',
    name: '100-Darts-Challenge',
    category: 'scoring',
    level: 1,
    durationMin: 15,
    skills: ['scoring'],
    goal: 'Mit 100 Darts auf die 20 möglichst viele Punkte sammeln.',
    why: 'Ein klassischer Langzeit-Test: Durch die große Dartzahl ist das Ergebnis aussagekräftig und gut vergleichbar – ideal, um Fortschritt über Wochen zu messen.',
    howTo: ['Wirf 100 Darts auf die 20.', 'Alle Punkte zählen – auch Fehlwürfe in 1 oder 5.', 'Tipp: Du kannst Aufnahmen auch als Gesamtsumme eingeben.'],
    rules: ['100 Darts (33 Aufnahmen + 1 Dart).', 'Alle erzielten Punkte zählen.'],
    variants: [
      { id: 'standard', label: 'Auf die 20', description: '100 Darts', make: () => ({ engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 100, scoring: 'total' }) },
      { id: 'nineteen', label: 'Auf die 19', description: '100 Darts', make: () => ({ engine: 'target', targets: [num(19)], rotation: 'visit', totalDarts: 100, scoring: 'total' }) },
    ],
    metricInfo: 'Gesamtpunkte aus 100 Darts.',
  },
  {
    id: 'highscore',
    name: 'Highscore-Challenge',
    category: 'scoring',
    level: 1,
    durationMin: 6,
    skills: ['scoring'],
    goal: 'In 10 Aufnahmen möglichst viele Punkte erzielen.',
    why: 'Kurz, motivierend und gut vergleichbar. Entspricht dem Scoring-Teil eines 501-Spiels.',
    howTo: ['Wirf auf die 20 (oder dein bestes Scoring-Feld).', 'Gib jeden Dart oder die Summe der Aufnahme ein.'],
    rules: ['10 Aufnahmen = 30 Darts.', 'Alle Punkte zählen.', 'Maximal 1800 Punkte.'],
    variants: [{ id: 'standard', label: '10 Aufnahmen', description: '30 Darts', make: () => ({ engine: 'target', targets: [num(20)], rotation: 'visit', totalDarts: 30, scoring: 'total' }) }],
    metricInfo: 'Gesamtpunkte aus 10 Aufnahmen.',
  },
  {
    id: 'scoring-switch',
    name: 'Scoring mit wechselnden Zielen',
    category: 'scoring',
    level: 2,
    durationMin: 8,
    skills: ['scoring', 'switching'],
    goal: 'Punkte auf 20, 19 und 18 im Wechsel sammeln.',
    why: 'Simuliert die Situation, wenn die 20 "zu" ist und du ausweichen musst – ohne den Rhythmus zu verlieren.',
    howTo: ['Aufnahme 1 auf die 20, Aufnahme 2 auf die 19, Aufnahme 3 auf die 18 – dann von vorn.', 'Nur Treffer im jeweiligen Segment zählen.'],
    rules: ['12 Aufnahmen = 36 Darts.', 'Punkte nur im jeweiligen Zielsegment.'],
    variants: [{ id: 'standard', label: '20 · 19 · 18', description: '36 Darts', make: () => ({ engine: 'target', targets: [num(20), num(19), num(18)], rotation: 'visit', totalDarts: 36, scoring: 'points' }) }],
    metricInfo: 'Summe der Punkte in den jeweiligen Zielsegmenten.',
  },

  // ---------------- Doubles ----------------
  {
    id: 'doubles-atc',
    name: 'Doubles Around the Clock',
    category: 'doubles',
    level: 2,
    durationMin: 12,
    skills: ['doubles'],
    goal: 'Alle Doppel von D1 bis D20 nacheinander treffen.',
    why: 'Du lernst jedes Doppel kennen – wichtig, weil im Spiel nicht immer dein Lieblingsdoppel übrig bleibt.',
    howTo: ['Beginne bei D1.', 'Erst nach einem Treffer geht es weiter.', 'Ruhig bleiben: Doppel sind schwer, Fehlwürfe sind normal.'],
    rules: ['D1 → D20, optional Bullseye.', 'Nur Doppel zählen.', 'Mit Dart-Limit: Ziel ist, so weit wie möglich zu kommen.'],
    variants: [
      { id: 'limit90', label: 'Max. 90 Darts', description: 'D1–D20, Ziel: möglichst weit kommen', make: () => ({ engine: 'atc', ring: 'double', bull: false, jump: false, maxDarts: 90 }) },
      { id: 'full', label: 'Komplett', description: 'D1–D20 + Bullseye, ohne Limit', make: () => ({ engine: 'atc', ring: 'double', bull: true, jump: false }) },
      { id: 'limit45', label: 'Einsteiger (45 Darts)', description: 'Kurz und knackig', make: () => ({ engine: 'atc', ring: 'double', bull: false, jump: false, maxDarts: 45 }) },
    ],
    beginnerVariant: 'limit45',
    metricInfo: 'Geschaffte Doppel (mit Limit) bzw. benötigte Darts (ohne Limit).',
  },
  {
    id: 'd16',
    name: 'Double-16-Training',
    category: 'doubles',
    level: 2,
    durationMin: 6,
    skills: ['doubles'],
    goal: 'Die D16 als Lieblingsdoppel aufbauen.',
    why: 'D16 lässt sich bei einem Single-Treffer halbieren: 32 → 16 (D8) → 8 (D4). Deshalb ist sie bei vielen Profis das Standarddoppel.',
    howTo: ['Wirf 30 Darts auf die D16 (links unten).', 'Erfasse auch, wenn du die Single 16 oder Nachbardoppel triffst.'],
    rules: ['30 Darts.', 'Treffer = nur Doppel 16.'],
    variants: [
      { id: 'standard', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(16)], rotation: 'visit', totalDarts: 30, scoring: 'hits' }) },
      { id: 'short', label: 'Einsteiger (15 Darts)', description: '5 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(16)], rotation: 'visit', totalDarts: 15, scoring: 'hits' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Trefferquote auf D16.',
  },
  {
    id: 'd20',
    name: 'Double-20-Training',
    category: 'doubles',
    level: 2,
    durationMin: 6,
    skills: ['doubles'],
    goal: 'Die D20 ("Tops") sicher treffen.',
    why: 'D20 ist das häufigste Finish-Doppel (40 Rest) und liegt dort, wo du ohnehin am meisten hinwirfst.',
    howTo: ['Wirf 30 Darts auf die D20 (ganz oben).', 'Zu hoch = Miss, zu tief = S20 – beides erfassen.'],
    rules: ['30 Darts.', 'Treffer = nur Doppel 20.'],
    variants: [
      { id: 'standard', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(20)], rotation: 'visit', totalDarts: 30, scoring: 'hits' }) },
      { id: 'short', label: 'Einsteiger (15 Darts)', description: '5 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(20)], rotation: 'visit', totalDarts: 15, scoring: 'hits' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Trefferquote auf D20.',
  },
  {
    id: 'd8',
    name: 'Double-8-Training',
    category: 'doubles',
    level: 2,
    durationMin: 6,
    skills: ['doubles'],
    goal: 'Die D8 als Rückfall-Doppel nach der D16 sichern.',
    why: 'Wer die D16 verfehlt und die Single 16 trifft, steht auf 16 Rest – also D8. Diese Kette solltest du beherrschen.',
    howTo: ['Wirf 30 Darts auf die D8 (links).'],
    rules: ['30 Darts.', 'Treffer = nur Doppel 8.'],
    variants: [
      { id: 'standard', label: '30 Darts', description: '10 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(8)], rotation: 'visit', totalDarts: 30, scoring: 'hits' }) },
      { id: 'short', label: 'Einsteiger (15 Darts)', description: '5 Aufnahmen', make: () => ({ engine: 'target', targets: [dbl(8)], rotation: 'visit', totalDarts: 15, scoring: 'hits' }) },
    ],
    beginnerVariant: 'short',
    metricInfo: 'Trefferquote auf D8.',
  },
  {
    id: 'double-ladder',
    name: 'Doppel-Leiter',
    category: 'doubles',
    level: 2,
    durationMin: 10,
    skills: ['doubles'],
    goal: 'Stufe für Stufe ein Doppel treffen – mit immer weniger Darts.',
    why: 'Steigender Druck wie im echten Spiel: Am Anfang hast du viel Zeit, am Ende zählt jeder Dart.',
    howTo: ['Triff das angezeigte Doppel innerhalb des Dart-Budgets.', 'Geschafft → nächste Stufe. Budget verbraucht → ein Leben weniger, gleiche Stufe nochmal.'],
    rules: ['10 Stufen: D20, D16, D8, D10, D12, D18, D4, D14, D6, Bullseye.', 'Budget: 9, 9, 9, 6, 6, 6, 6, 3, 3, 3 Darts.', 'Spielende nach 3 verlorenen Leben (Einsteiger: 5).'],
    variants: [
      {
        id: 'standard',
        label: '3 Leben',
        description: 'Standard',
        make: () => ({ engine: 'ladder', lives: 3, stages: LADDER_STAGES }),
      },
      {
        id: 'easy',
        label: 'Einsteiger · 5 Leben',
        description: 'Mehr Fehler erlaubt',
        make: () => ({ engine: 'ladder', lives: 5, stages: LADDER_STAGES }),
      },
    ],
    beginnerVariant: 'easy',
    metricInfo: 'Geschaffte Stufen.',
  },
  {
    id: 'bobs27',
    name: "Bob's 27",
    category: 'doubles',
    level: 2,
    durationMin: 12,
    skills: ['doubles'],
    goal: 'Mit Doppeltreffern den Startwert von 27 Punkten vermehren.',
    why: 'Der Klassiker für Doppeltraining (erfunden von Bob Anderson): Jedes Doppel kommt dran, und Fehlwürfe kosten Punkte – realistischer Druck.',
    howTo: ['Du startest mit 27 Punkten.', 'Wirf je 3 Darts auf D1, D2, … bis D20 und zum Schluss aufs Bullseye.'],
    rules: [
      'Jeder Treffer addiert den Wert des Doppels (z. B. D7 = 14).',
      'Triffst du mit allen drei Darts nicht, wird der Wert des Doppels abgezogen.',
      'Klassisch: Fällt dein Stand unter 0, ist das Spiel vorbei.',
      'Maximal 1437 Punkte möglich.',
    ],
    variants: [
      { id: 'classic', label: 'Klassisch', description: 'Raus bei unter 0, mit Bull', make: () => ({ engine: 'bobs27', bull: true, elimination: 'below' }) },
      { id: 'zero', label: 'Streng', description: 'Raus bei 0 oder weniger', make: () => ({ engine: 'bobs27', bull: true, elimination: 'zero' }) },
      { id: 'easy', label: 'Einsteiger', description: 'Kein Ausscheiden – alle Doppel durchspielen', make: () => ({ engine: 'bobs27', bull: true, elimination: 'none' }) },
    ],
    beginnerVariant: 'easy',
    metricInfo: 'Endpunktestand (höher ist besser).',
  },

  // ---------------- Checkouts ----------------
  {
    id: 'checkout-doubles',
    name: 'Doppel-Out-Grundlagen',
    category: 'checkout',
    level: 1,
    durationMin: 8,
    skills: ['checkout', 'doubles'],
    goal: 'Gerade Restwerte bis 40 direkt mit einem Doppel beenden.',
    why: 'Im 501 musst du mit einem Doppel beenden. Hier lernst du, welche Restwerte direkt mit einem Doppel gehen und was passiert, wenn du die Single triffst.',
    howTo: ['Die App zeigt eine Restpunktzahl (z. B. 32).', 'Du hast 3 Darts. Triffst du nur die Single, rechnet die App den neuen Rest aus.', 'Achtung Bust: Überwerfen oder Rest 1 setzt die Aufnahme zurück.'],
    rules: ['10 Versuche, je 3 Darts.', 'Gerade Restwerte von 2 bis 40.', 'Double-Out-Regeln inkl. Bust.'],
    variants: [
      { id: 'standard', label: '10 × 3 Darts', description: '2–40, nur gerade', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 2, max: 40, evenOnly: true, attempts: 10, dartsPerAttempt: 3, out: 'double', seed }) },
      { id: 'easy', label: 'Einsteiger · 6 Darts', description: 'Mehr Zeit pro Versuch', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 2, max: 40, evenOnly: true, attempts: 8, dartsPerAttempt: 6, out: 'double', seed }) },
    ],
    beginnerVariant: 'easy',
    metricInfo: 'Anteil erfolgreicher Checkouts.',
  },
  {
    id: 'checkout-under40',
    name: 'Checkouts unter 40',
    category: 'checkout',
    level: 1,
    durationMin: 8,
    skills: ['checkout'],
    goal: 'Alle Restwerte bis 40 sicher auschecken – auch ungerade.',
    why: 'Ungerade Reste brauchen einen Vorbereitungsdart (z. B. 37 = S5 + D16). Du lernst, dir dein Lieblingsdoppel zu stellen.',
    howTo: ['Die App zeigt Rest und empfohlenen Weg.', 'Bei ungeraden Zahlen: erst eine Single werfen, dann das Doppel.'],
    rules: ['10 Versuche, je 3 Darts.', 'Restwerte 2–40.'],
    variants: [{ id: 'standard', label: '10 × 3 Darts', description: '2–40', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 2, max: 40, attempts: 10, dartsPerAttempt: 3, out: 'double', seed }) }],
    metricInfo: 'Anteil erfolgreicher Checkouts.',
  },
  {
    id: 'checkout-easy',
    name: 'Einfache Checkouts',
    category: 'checkout',
    level: 2,
    durationMin: 8,
    skills: ['checkout'],
    goal: 'Restwerte von 41 bis 60 mit Single + Doppel beenden.',
    why: 'Der typische Weg: eine Single stellt das Lieblingsdoppel (z. B. 56 = S16 + D20). Diese Routine sollte automatisch ablaufen.',
    howTo: ['Folge dem angezeigten Weg oder deinem eigenen.', 'Verfehlst du die Single, zeigt die App den neuen Weg.'],
    rules: ['10 Versuche, je 3 Darts.', 'Restwerte 41–60.'],
    variants: [
      { id: 'standard', label: '10 × 3 Darts', description: '41–60', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 41, max: 60, attempts: 10, dartsPerAttempt: 3, out: 'double', seed }) },
      { id: 'easy', label: 'Einsteiger · 6 Darts', description: 'Zwei Aufnahmen pro Versuch', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 41, max: 60, attempts: 8, dartsPerAttempt: 6, out: 'double', seed }) },
    ],
    beginnerVariant: 'easy',
    metricInfo: 'Anteil erfolgreicher Checkouts.',
  },
  {
    id: 'checkout-challenge',
    name: 'Checkout-Challenge',
    category: 'checkout',
    level: 3,
    durationMin: 10,
    skills: ['checkout', 'trebles'],
    goal: 'Restwerte von 61 bis 100 in einer bzw. zwei Aufnahmen checken.',
    why: 'Hier kommen Triples ins Spiel (z. B. 100 = T20 D20). Ideal, sobald Singles und Doppel stabil sind.',
    howTo: ['Weg anzeigen lassen und anwerfen.', 'Bei 6 Darts: Plane die erste Aufnahme so, dass ein gutes Doppel übrig bleibt.'],
    rules: ['10 Versuche.', 'Restwerte 61–100.'],
    variants: [
      { id: 'six', label: '10 × 6 Darts', description: 'Zwei Aufnahmen pro Versuch', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 61, max: 100, attempts: 10, dartsPerAttempt: 6, out: 'double', seed }) },
      { id: 'three', label: '10 × 3 Darts', description: 'Eine Aufnahme pro Versuch', make: (seed) => ({ engine: 'checkout', mode: 'random', min: 61, max: 100, attempts: 10, dartsPerAttempt: 3, out: 'double', seed }) },
    ],
    metricInfo: 'Anteil erfolgreicher Checkouts.',
  },
  {
    id: 'checkout-121',
    name: '121-Training',
    category: 'checkout',
    level: 3,
    durationMin: 15,
    skills: ['checkout', 'trebles'],
    goal: 'Starte bei 121 und arbeite dich mit Checkouts nach oben.',
    why: 'Das Standard-Checkout-Training fortgeschrittener Spieler: 9 Darts pro Versuch entsprechen drei Aufnahmen im echten Spiel.',
    howTo: ['Du hast 9 Darts (3 Aufnahmen), um die Zahl zu checken.', 'Geschafft: Die nächste Zahl ist um 1 höher.', 'Nicht geschafft: Die nächste Zahl ist um 1 niedriger (nie unter 121).'],
    rules: ['10 Versuche à 9 Darts.', 'Double-Out inkl. Bust.'],
    variants: [{ id: 'standard', label: '10 × 9 Darts', description: 'Start bei 121', make: (seed) => ({ engine: 'checkout', mode: 'ladder', start: 121, attempts: 10, dartsPerAttempt: 9, out: 'double', seed }) }],
    metricInfo: 'Höchster erfolgreicher Checkout.',
  },

  // ---------------- Spieltraining ----------------
  {
    id: 'x01',
    name: '301 / 501',
    category: 'game',
    level: 1,
    durationMin: 10,
    skills: ['game', 'scoring', 'checkout'],
    goal: 'Ein komplettes Leg unter echten Regeln spielen.',
    why: 'Hier kommt alles zusammen: Scoring, Stellen und Auschecken. Der 3-Dart-Average zeigt dein Gesamtniveau.',
    howTo: ['Wähle 301 oder 501 und optional einen virtuellen Gegner.', 'Gib jeden Dart einzeln ein (genauere Statistik) oder die Summe der Aufnahme.', 'Die App zeigt dir in Finish-Nähe den Checkout-Weg.'],
    rules: [
      'Jeder startet mit 301 bzw. 501 Punkten.',
      'Double-Out: Der letzte Dart muss ein Doppel (oder Bullseye) sein.',
      'Bust: Überwirfst du, bleibt 1 Rest übrig oder triffst du 0 ohne Doppel, zählt die ganze Aufnahme nicht.',
      'Single-Out (Einsteiger): Jeder Dart darf beenden.',
    ],
    variants: [
      { id: '501', label: '501 Double-Out', description: 'Solo', make: (seed) => ({ engine: 'x01', seed, game: { start: 501, out: 'double', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }] } }) },
      { id: '301', label: '301 Double-Out', description: 'Solo', make: (seed) => ({ engine: 'x01', seed, game: { start: 301, out: 'double', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }] } }) },
      { id: '301-single', label: '301 Single-Out', description: 'Einsteiger: jedes Feld darf beenden', make: (seed) => ({ engine: 'x01', seed, game: { start: 301, out: 'single', in: 'straight', legsToWin: 1, players: [{ name: 'Du' }] } }) },
    ],
    beginnerVariant: '301-single',
    metricInfo: '3-Dart-Average = erzielte Punkte ÷ geworfene Darts × 3.',
  },
  {
    id: 'cricket',
    name: 'Cricket-Training',
    category: 'game',
    level: 2,
    durationMin: 10,
    skills: ['game', 'trebles', 'switching'],
    goal: '15 bis 20 und das Bull in möglichst wenigen Runden schließen.',
    why: 'Cricket trainiert Triples und gezielte Zielwechsel. Die Kennzahl MPR (Marks pro Runde) ist international vergleichbar.',
    howTo: ['Wähle selbst, welches offene Feld du anwirfst.', 'Single = 1 Mark, Double = 2, Triple = 3. Drei Marks schließen ein Feld.'],
    rules: ['Felder: 20, 19, 18, 17, 16, 15, Bull (25 = 1 Mark, Bullseye = 2).', 'Spielende, wenn alles geschlossen ist (max. 20 Runden).'],
    variants: [{ id: 'standard', label: 'Solo', description: 'Max. 20 Runden', make: () => ({ engine: 'cricket', maxRounds: 20 }) }],
    metricInfo: 'Marks pro Runde (MPR) – nur Marks, die zum Schließen zählen.',
  },
  {
    id: 'free',
    name: 'Freies Training',
    category: 'game',
    level: 1,
    durationMin: 5,
    skills: ['consistency'],
    goal: 'Locker werfen, Rhythmus finden – jeder Dart wird erfasst.',
    why: 'Ideal zum Einwerfen. Mit Board-Eingabe entsteht eine Heatmap, die zeigt, wo deine Darts landen.',
    howTo: ['Wirf entspannt auf ein Ziel deiner Wahl.', 'Erfasse die Darts – am besten über die Scheibe.'],
    rules: ['Keine Regeln, kein Druck.', 'Beenden, wann du willst.'],
    variants: [
      { id: 'open', label: 'Offen', description: 'Ohne Limit', make: () => ({ engine: 'free' }) },
      { id: 'warmup', label: 'Warm-up · 24 Darts', description: '8 Aufnahmen', make: () => ({ engine: 'free', maxDarts: 24 }) },
    ],
    metricInfo: 'Ø Punkte pro Aufnahme (nur zur Orientierung).',
  },

  // ---------------- Technik & Konstanz ----------------
  focus('tech-stance', 'stance', 'Standposition-Routine', 'Gleiche Fußposition, Gewicht leicht nach vorn, Oberkörper ruhig.', 'Stand stabil und jedes Mal gleich?', {
    howTo: ['Stelle dich vor jeder Aufnahme bewusst an deine Markierung.', 'Prüfe: Fußspitze, Gewicht, Schulter. Erst dann werfen.', 'Nach dem Wurf: Hast du gewackelt oder dich nach vorn gelehnt?'],
  }),
  focus('tech-grip', 'grip', 'Griff-Routine', 'Gleicher Griff bei jedem Dart – fest genug, aber ohne Klammern.', 'Griff jedes Mal gleich und locker?', {
    howTo: ['Nimm den Dart vor jedem Wurf bewusst gleich in die Hand.', 'Fingerspitzen spüren, Druck kurz lösen.', 'Achte darauf, dass die Dartspitze leicht nach oben zeigt.'],
  }),
  focus('tech-aim', 'aim', 'Konzentration & Zielen', 'Fixiere einen winzigen Punkt im Ziel, bis der Dart steckt.', 'Blick die ganze Zeit ruhig auf dem Zielpunkt?', {
    howTo: ['Suche dir einen winzigen Punkt im Ziel (z. B. ein Loch im Sisal).', 'Halte den Blick ca. 2 Sekunden ruhig darauf, bevor du ausholst.', 'Den Blick nicht wegnehmen, bevor der Dart steckt.'],
  }),
  focus('tech-backswing', 'backswing', 'Kontrollierte Ausholbewegung', 'Ruhig und gleich weit ausholen – nur der Unterarm bewegt sich.', 'Ausholbewegung ruhig und gleich lang?', {
    howTo: ['Hole langsam aus, der Ellbogen bleibt möglichst an seiner Stelle.', 'Die Ausholbewegung sollte immer gleich weit zurückgehen.', 'Kein Zucken oder Pausieren am Umkehrpunkt.'],
  }),
  focus('tech-release', 'release', 'Kontrollierter Abwurf', 'Locker beschleunigen und loslassen – ohne zusätzliche Kraft.', 'Abwurf flüssig, ohne Krafteinsatz?', {
    howTo: ['Stell dir vor, du wirfst einen Papierflieger – nicht einen Ball.', 'Die Beschleunigung kommt aus dem Unterarm, nicht aus der Schulter.', 'Lass alle Finger gleichzeitig los.'],
  }),
  focus('tech-follow', 'followThrough', 'Follow-through', 'Nach dem Loslassen zeigt die Hand aufs Ziel – Position kurz halten.', 'Arm nach dem Wurf ausgestreckt und Richtung Ziel gehalten?', {
    howTo: ['Führe den Arm nach dem Loslassen weiter Richtung Ziel.', 'Halte die Endposition ca. 1 Sekunde ("Foto-Pose").', 'Den Arm nicht ruckartig zurückziehen.'],
  }),
  focus('tech-rhythm', 'rhythm', 'Rhythmus-Training', 'Gleiches Tempo bei jedem Dart: Zielen – Ausholen – Wurf.', 'Tempo gleichmäßig, ohne Hektik oder Zögern?', {
    howTo: ['Starte das Metronom unten und wirf im gleichen Takt.', 'Zwischen den Darts gleich lange Pausen.', 'Wenn du zögerst: absetzen und neu ansetzen.'],
    companion: 'metronome',
  }),
  focus('tech-routine', 'rhythm', 'Pre-Throw-Routine', 'Deine persönliche Routine vor jedem Dart – Schritt für Schritt.', 'Routine vor jedem Dart vollständig durchgeführt?', {
    howTo: ['Starte unten den Routine-Player – er führt dich durch deine Schritte.', 'Passe die Schritte im Technik-Coach an dich an.', 'Ziel: Die Routine läuft irgendwann automatisch ab.'],
    companion: 'routine',
    durationMin: 8,
  }),
  {
    id: 'grouping-conditions',
    name: 'Gruppierung unter Bedingungen',
    category: 'technique',
    level: 2,
    durationMin: 8,
    skills: ['consistency', 'switching'],
    goal: 'Eng gruppieren, obwohl das Ziel jede Runde wechselt.',
    why: 'Ein konstanter Wurf muss auf jedes Ziel funktionieren – nicht nur auf das gewohnte. Wechselnde Bedingungen machen das Gelernte robuster.',
    howTo: ['Jede Runde ein anderes Ziel: Bull, 20, 6, 3, 11, 19.', 'Drei Darts möglichst eng – Punkte egal.', 'Positionen antippen, damit die Gruppe gemessen wird.'],
    rules: ['12 Runden à 3 Darts.', 'Gemessen wird die Gruppengröße je Runde.'],
    variants: [
      {
        id: 'measure',
        label: 'Gemessen',
        description: 'Positionen antippen',
        make: () => ({ engine: 'grouping', targets: [BULL, single(20), single(6), single(3), single(11), single(19)], rounds: 12, measure: 'positions' }),
      },
      {
        id: 'self',
        label: 'Selbsteinschätzung',
        description: 'Ohne Antippen',
        make: () => ({ engine: 'grouping', targets: [BULL, single(20), single(6), single(3), single(11), single(19)], rounds: 12, measure: 'self' }),
      },
    ],
    metricInfo: 'Ø Gruppengröße in cm (gemessen) bzw. Anteil enger Gruppen (Selbsteinschätzung).',
  },
];


const BY_ID = new Map(DRILLS.map((d) => [d.id, d]));

export function getDrill(id: string): DrillDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unbekannte Übung: ${id}`);
  return d;
}

export function findDrill(id: string): DrillDef | undefined {
  return BY_ID.get(id);
}

export function getVariant(def: DrillDef, variantId?: string): DrillVariant {
  return def.variants.find((v) => v.id === variantId) ?? def.variants[0];
}

/** Variante für einen Spieler: Anfänger bekommen die vereinfachte Version. */
export function defaultVariantFor(def: DrillDef, beginner: boolean): DrillVariant {
  return beginner && def.beginnerVariant ? getVariant(def, def.beginnerVariant) : def.variants[0];
}
