/**
 * Grundlegende Datentypen für Würfe und Ziele.
 *
 * Ein Dart wird als Zahl (`n`) plus Multiplikator (`m`) gespeichert:
 *  - n = 1..20 für die Zahlensegmente, 25 für das Bull, 0 für einen Fehlwurf
 *  - m = 0 (Miss), 1 (Single), 2 (Double), 3 (Triple)
 *  - Bull: m = 1 → Single Bull (25 Punkte), m = 2 → Bullseye (50 Punkte, zählt als Double)
 *
 * Optional wird die angetippte Position auf der Scheibe in Millimetern gespeichert
 * (Ursprung = Scheibenmitte, x nach rechts, y nach oben). Nur Darts mit Position
 * dürfen für Streuungs- und Gruppierungsanalysen verwendet werden.
 */
export type Multiplier = 0 | 1 | 2 | 3;

export interface Point {
  x: number;
  y: number;
}

export interface Dart {
  n: number;
  m: Multiplier;
  /** true = inneres (großes) Single-Feld, false = äußeres Single-Feld. Nur bei Board-Eingabe bekannt. */
  inner?: boolean;
  /** Trefferposition in mm relativ zur Scheibenmitte – nur bei Eingabe über die Scheibe. */
  p?: Point;
}

/** Art eines Ziels in einer Übung. */
export type TargetKind =
  | 'number' // gesamtes Segment zählt (Single, Double, Triple)
  | 'single' // nur Single-Felder des Segments
  | 'double'
  | 'triple'
  | 'bull' // Single Bull oder Bullseye
  | 'bullseye' // nur 50
  | 'board' // irgendwo auf der Scheibe (z. B. Warm-up)
  | 'free'; // kein festes Ziel (z. B. erster Dart bei Follow the Leader)

export interface Target {
  /** 1..20 oder 25 (Bull); bei 'board'/'free' 0. */
  n: number;
  kind: TargetKind;
}

export type InputMode = 'board' | 'buttons';
