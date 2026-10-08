import type { OutMode } from '../checkout';
import type { Dart, Target } from '../types';
import type { X01Config, X01PlayerStats } from '../x01';

/** Eingabe-Ereignis innerhalb einer Übung. */
export type DrillEvent =
  | { t: 'dart'; dart: Dart; at?: number; bot?: boolean }
  | { t: 'visit'; score: number; darts?: number; doubleDarts?: number; at?: number }
  | { t: 'rate'; value: number; at?: number };

/** Ein geworfener Dart mit dem Ziel, auf das er geworfen wurde. */
export interface ThrowRecord {
  dart: Dart;
  /** Ziel zum Zeitpunkt des Wurfs; `null`, wenn kein eindeutiges Ziel feststand. */
  target: Target | null;
  /** Treffer auf das Ziel; `null`, wenn kein Ziel feststand. */
  hit: boolean | null;
  /** Laufende Nummer der Aufnahme (3 Darts) innerhalb der Übung. */
  round: number;
  at?: number;
}

export interface RatingOption {
  value: number;
  label: string;
  hint?: string;
}

export interface RatingPrompt {
  question: string;
  options: RatingOption[];
}

export type Tone = 'good' | 'bad' | 'neutral' | 'info';

export interface CricketPanel {
  type: 'cricket';
  marks: { n: number; marks: number }[];
}

export interface X01Panel {
  type: 'x01';
  players: { name: string; remaining: number; legsWon: number; average: number | null; isBot: boolean; active: boolean }[];
  currentIsBot: boolean;
  visitStart: number;
  legsToWin: number;
}

export interface DrillView {
  target: Target | null;
  /** Große Zielanzeige, z. B. "20", "D16", "57". */
  headline: string;
  /** Unterzeile, z. B. "Ziel 5 von 21". */
  caption?: string;
  progress: number;
  stats: { label: string; value: string }[];
  /** Darts der aktuellen Aufnahme. */
  visitDarts: { label: string; hit: boolean | null }[];
  awaiting: 'dart' | 'rating' | 'done';
  rating?: RatingPrompt;
  /** Coach-Hinweis (z. B. Checkout-Weg). */
  hint?: string;
  feedback?: { tone: Tone; text: string };
  /** Passende Schnelltasten für das aktuelle Ziel. */
  quick?: Dart[];
  /** Darf statt einzelner Darts die Gesamtpunktzahl einer Aufnahme eingegeben werden? */
  allowVisitTotal?: boolean;
  /** Erzwingt Eingabe über die Scheibe (Positionsdaten nötig). */
  preferBoard?: boolean;
  panel?: CricketPanel | X01Panel;
}

export interface PrimaryMetric {
  label: string;
  value: number | null;
  display: string;
  higherIsBetter: boolean;
  unit?: string;
}

export interface DrillResult {
  primary: PrimaryMetric;
  completed: boolean;
  metrics: Record<string, number>;
  lines: string[];
  /** Detaildaten für X01-Auswertung. */
  x01?: { stats: X01PlayerStats; won: boolean; opponentName?: string };
}

export interface EngineModule<C, S> {
  init(config: C): S;
  apply(state: S, e: DrillEvent): S;
  view(state: S): DrillView;
  result(state: S): DrillResult;
  finished(state: S): boolean;
  throws(state: S): ThrowRecord[];
}

// ---------- Konfigurationen der einzelnen Engines ----------

export interface TargetPracticeConfig {
  engine: 'target';
  targets: Target[];
  /** Zielwechsel: nach jedem Dart, nach jeder Aufnahme oder nach `blockSize` Darts. */
  rotation: 'dart' | 'visit' | 'block';
  blockSize?: number;
  totalDarts: number;
  /** hits = Trefferquote, points = Punkte auf das Zielsegment, total = alle Punkte. */
  scoring: 'hits' | 'points' | 'total';
}

export interface AtcConfig {
  engine: 'atc';
  ring: 'number' | 'single' | 'double' | 'triple';
  bull: boolean;
  /** Bei "ganzes Segment": Double springt 2, Triple 3 Zahlen weiter. */
  jump: boolean;
  /** Optionales Dart-Limit (für kurze Einheiten). */
  maxDarts?: number;
}

export interface Bobs27Config {
  engine: 'bobs27';
  bull: boolean;
  /** below = raus bei < 0 (klassisch), zero = raus bei ≤ 0, none = Anfängermodus ohne Ausscheiden. */
  elimination: 'below' | 'zero' | 'none';
}

export interface GroupingConfig {
  engine: 'grouping';
  targets: Target[];
  rounds: number;
  /** positions = Messung über angetippte Positionen, self = Selbsteinschätzung. */
  measure: 'positions' | 'self';
}

export interface FollowConfig {
  engine: 'follow';
  rounds: number;
}

export interface CheckoutConfig {
  engine: 'checkout';
  mode: 'random' | 'ladder' | 'list';
  min?: number;
  max?: number;
  evenOnly?: boolean;
  values?: number[];
  start?: number;
  attempts: number;
  dartsPerAttempt: 3 | 6 | 9;
  out: OutMode;
  seed: number;
}

export interface DoublesLadderConfig {
  engine: 'ladder';
  stages: { n: number; budget: number }[];
  lives: number;
}

export interface CricketConfig {
  engine: 'cricket';
  maxRounds: number;
}

export interface FocusConfig {
  engine: 'focus';
  targets: Target[];
  rounds: number;
  question: string;
  /** Ein kurzer Merksatz, der jede Runde angezeigt wird. */
  cue: string;
}

export interface FreeConfig {
  engine: 'free';
  maxDarts?: number;
}

export interface X01DrillConfig {
  engine: 'x01';
  game: X01Config;
  seed: number;
}

export type DrillConfig =
  | TargetPracticeConfig
  | AtcConfig
  | Bobs27Config
  | GroupingConfig
  | FollowConfig
  | CheckoutConfig
  | DoublesLadderConfig
  | CricketConfig
  | FocusConfig
  | FreeConfig
  | X01DrillConfig;

export type EngineName = DrillConfig['engine'];
