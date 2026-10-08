# 🎯 DARTS COACH – Train smarter. Throw better.

Ein persönliches Darts-Trainingssystem als Progressive Web App. Es führt Anfänger Schritt für Schritt zu einem **gleichmäßigen, wiederholbaren Wurf**, macht sie **treffsicherer** und zeigt ihren Fortschritt **ehrlich und messbar**.

> „Öffne die App, starte dein Training und werde mit jeder Woche gezielter und konstanter.“

- Läuft im Smartphone-Browser, installierbar auf dem Startbildschirm, **offline nutzbar**
- **Keine Registrierung, keine Cloud, keine kostenpflichtigen Dienste** – alle Daten bleiben auf dem Gerät (Export/Import als JSON)
- Deutschsprachig, dunkles Sport-Design, für die Bedienung neben dem Board optimiert

---

## Schnellstart

```bash
npm install
npm run dev            # Entwicklungsserver auf http://localhost:5173
npm run dev -- --host  # zusätzlich im WLAN erreichbar (Handy öffnen: http://<PC-IP>:5173)
```

| Befehl | Zweck |
| --- | --- |
| `npm run typecheck` | TypeScript-Prüfung (App + Tests) |
| `npm test` | 114 Unit-Tests (Regeln, Engines, Statistik, Coach, Plan, Speicher) |
| `npm run build` | Produktions-Build inkl. Service Worker nach `dist/` |
| `npm run test:e2e` | 7 End-to-End-Tests der Abnahmeszenarien (vorher `npm run build`) |
| `npm run check` | Typecheck + Unit-Tests + Build in einem Schritt |

**Auf dem Handy installieren:** App im Browser öffnen → „Zum Startbildschirm hinzufügen“ (iOS: Teilen-Menü, Android: Browser-Menü). Die Kamera-Funktion der Video-Analyse benötigt HTTPS (z. B. GitHub Pages).

**Veröffentlichen (GitHub Pages):** Der Workflow `.github/workflows/ci.yml` testet jeden Push und veröffentlicht `main` automatisch. Einmalig in GitHub unter *Settings → Pages → Source* „GitHub Actions“ auswählen.

---

## Was die App kann

### Persönlicher Coach
- **Onboarding** (6 kurze Schritte): Niveau, Steel/Soft, Wurfhand, Trainingsfrequenz, Zeit pro Einheit (10/20/30/45 Min.), Ziele, stabiler Wurf ja/nein, bevorzugte Eingabe.
- **Datenbasierte Empfehlungen ohne KI-API**: Der Coach wählt pro Einheit einen Fähigkeits-Schwerpunkt und genau **einen Technikschwerpunkt** – und begründet beides mit deinen Zahlen („Big Singles ist aktuell deine größte Baustelle (24 % bei 90 Darts)“).
- Erkennt: schwächste Zielfelder, Richtung der Fehlwürfe (links/rechts – auch ohne Positionsdaten), systematische Abweichung vom Zielpunkt (nur mit Positionsdaten), Streuung, Plateaus, Verbesserungen, Belastung (Pausenhinweise).
- **Keine erfundenen Ursachen**: Muster werden als Muster benannt, mögliche Prüfpunkte ausdrücklich als „keine Diagnose“ gekennzeichnet.
- **Folgeübung** nach jedem Durchgang: Aufstieg/Abstieg in Progressionsketten erst auf Basis mehrerer Durchgänge – ein einzelnes gutes Ergebnis reicht nicht.

### Trainingsplan (adaptiv)
- Programm **Fundament** (Anfänger, 4 Stufen ≈ Wochen): Grundlagen → Wiederholbarkeit → Präzision → Fortschrittsprüfung.
- Programm **Aufbau** (4 Stufen): Scoring → Doppel → Checkout → Spielpraxis & Test. Danach **Adaptiv** mit Leistungstest alle 4 Wochen.
- **Aufstieg nach Leistung, nicht nach Kalender**: Mindestzahl Einheiten (aus deiner Wochenfrequenz) **plus** ein Leistungskriterium (z. B. Ø Gruppe ≤ 9 cm oder Routine-Treue ≥ 60 %; Singles-Quote ≥ 30 % bei ≥ 60 Darts). Wer festhängt, geht nach drei Zusatzeinheiten trotzdem weiter – Fortschritt verläuft nicht linear.
- Einheiten für 10/20/30/45 Minuten, z. B. 30 Min.: **Warm-up (5) → Technik (5) → Schwerpunkt (10) → Zielwechsel (5) → Challenge (5)**. Bei hoher Belastung wird automatisch verkürzt.
- **Eingangstest + Wiederholungstest** mit identischen Aufgaben (Gruppierung, große Singles, Zielwechsel, Doppel, Scoring) → fairer Vorher-Nachher-Vergleich.

### Trainingsbibliothek – 31 spielbare Übungen in 6 Kategorien
Jede Übung hat Ziel, Begründung, Anleitung, Regeln, Varianten (inkl. vereinfachter Anfänger-Variante), interaktive Durchführung, Fortschrittsanzeige, Auswertung, Speicherung und Verlaufsdiagramm.

| Kategorie | Übungen |
| --- | --- |
| Grundlagen & Präzision | Grouping (gemessen oder Selbsteinschätzung), Big Singles, Around the Clock (ganze Zahl / Single / Double / Triple / mit Sprüngen), Follow the Leader, Zielwechsel |
| Scoring | 20er-Training, 19er-Training, Triple-20, Triple-19, 100-Darts-Challenge, Highscore-Challenge, Scoring mit wechselnden Zielen |
| Doubles | Doubles Around the Clock, D16, D20, D8, Doppel-Leiter (steigender Druck), Bob's 27 (klassische Regeln + Varianten) |
| Checkouts | Doppel-Out-Grundlagen, Checkouts unter 40, Einfache Checkouts (41–60), Checkout-Challenge (61–100), 121-Training |
| Spieltraining | 301/501 (Double-/Single-Out, Double-In, Legs, virtueller Gegner Stufe 1–10), Cricket-Training (MPR), Freies Training |
| Technik & Konstanz | Stand-, Griff-, Ziel-, Ausholbewegungs-, Abwurf-, Follow-through-Routine, Rhythmus-Training (Metronom), Pre-Throw-Routine (Routine-Player), Gruppierung unter Bedingungen |

Dazu **Challenges**: Tageschallenge (Zielmarke knapp über deinem bisherigen Median), Wochenchallenge (prozessorientiert: Regelmäßigkeit, Technik, Abwechslung), „Rekord jagen“, „Drei am Stück“, Fortschrittsprüfung.

### Interaktive Dartscheibe & Treffererfassung
- **SVG-Scheibe nach Turniermaßen** (Bullseye 12,7 mm, Bull 31,8 mm, Triple 99–107 mm, Double 162–170 mm, korrekte Zahlenfolge). Erkennt Zahl, Single/Double/Triple, Bull/Bullseye, Fehlwurf.
- **Lupe beim Antippen**: Beim Gedrückthalten zeigt eine vergrößerte Ansicht über dem Finger das exakte Feld – der Finger verdeckt sonst die Stelle.
- **Schnelleingabe**: kontextbezogene Tasten (z. B. S5 · S20 · S1 · D20 · T20 · Miss – Nachbarfelder für die Fehlwurf-Richtung), vollständiges Tastenfeld, **Aufnahme-Summe** für 301/501 und Scoring.
- Undo (auch über Bot-Aufnahmen hinweg), Korrektur, Validierung (z. B. 179 ist unmöglich), automatischer Aufnahmewechsel, optional Signaltöne und Sprachausgabe, Bildschirm bleibt an (Wake Lock).
- **Ehrliche Datenbasis**: Nur über die Scheibe erfasste Darts haben Positionen. Gruppengröße, Heatmap und Zielpunkt-Abweichung werden **nie** aus Punktzahlen geschätzt.

### Training erleben
- Geführte Phasen mit Coach-Text (was, wie, warum), Phasen-Timer, Pause, Phase beenden/überspringen.
- **Absturzsicher**: Jede Eingabe wird sofort gesichert. Nach versehentlichem Schließen wird die Einheit wiederhergestellt; lange Unterbrechungen zählen als Pause.
- Auswertung: Trainingszeit, Darts, Zieltrefferquote, Vergleich mit der letzten gleichartigen Einheit, Rekorde, XP-Aufschlüsselung, Folgeübung mit Begründung.

### Technik-Coach
- 7 Bausteine: **Stand, Griff, Zielen & Konzentration, Ausholbewegung, Abwurf, Follow-through, Rhythmus & Routine** – jeweils Warum, Schritt-für-Schritt, Varianten, Selbstcheck, „Wenn … dann probiere …“, eigene Notizen, Status (Neu / In Arbeit / Sitzt) und passende Übung.
- **Pre-Throw-Routine-Builder** (Schritte, Stichworte, Dauer, Reihenfolge) + **Routine-Player** mit visuellem Taktring, dezenten Tönen und optionaler Sprachausgabe; **Metronom** für Rhythmus-Training.
- Grundhaltung der App: Es gibt nicht *die* perfekte Technik; pro Training wird nur **ein** Merkmal verändert.

### Statistik
- Zeiträume **7 / 30 / 90 Tage / Gesamt**; Trainingstage, Zeit, Darts, Zieltrefferquote (mit Stichprobengröße), Doppelquote, 3-Dart-Average (Spiel und Scoring getrennt), Checkout-Quote.
- Fähigkeitsprofil mit Trend („deutlich besser“ nur bei p < 0,05 und ≥ 40 Darts je Zeitraum).
- Entwicklung der Trefferquote, **Konstanz** (Gruppengröße, Anteil Aufnahmen ohne Treffer, Streuung der Aufnahme-Punkte), **Schwachstellen** je Zielfeld, **Fehlwurf-Richtung**, **Heatmap**, **Zielpunkt-Abweichung**, **Vorher-Nachher** (Leistungstest), Bestleistungen, alle Coach-Erkenntnisse.

### Motivation ohne Übertraining
XP vor allem für **abgeschlossene, strukturierte Einheiten**; Darts bringen nur begrenzt XP (Tageslimit 40) – lange Einheiten „lohnen“ sich nicht. Level, 16 Abzeichen (aus den Daten abgeleitet), Wochenziel mit Hinweis „Mehr ist nicht nötig – Erholung zählt auch“, Pausenhinweise bei 6+ Trainingstagen pro Woche.

### Video-Analyse
Aufnahme im Browser (Rück-/Frontkamera, Countdown, 5/8/12 s), Zeitlupe (0,1×–1×), Einzelbildschritte, Raster, selbst gezeichnete Hilfslinien, Abwurf-Markierung und **synchroner Vergleich zweier Würfe**. Videos werden lokal (IndexedDB) gespeichert.

---

## Recherche: Was es gibt und was wir daraus gemacht haben

| Anwendung | Stärken | Schwächen / Lücken | Konsequenz für DARTS COACH |
| --- | --- | --- | --- |
| **GoDartsPro** | Über 100 Trainingsspiele, Schwierigkeits-Tags, MasterClass-Freischaltung, „Virtual Coach“ nach Schwachstellen | Viele Spiele hinter Premium; MasterClass zielt auf Fortgeschrittene; Fokus auf Spiele statt auf Technik | Kuratierte Bibliothek mit Anfänger-Varianten statt Masse; Coach mit offengelegten Regeln |
| **DartCounter** | Sehr guter X01-Scorer, Checkout-Helfer, Heatmap, Trends | Viele Statistiken und Trainingsspiele (z. B. 121) nur mit Abo; Scorer-Fokus, kein Lernpfad | Korrekte X01-Regeln + Checkout-Rechner mit **Erklärungen**, aber eingebettet in einen Trainingsplan |
| **My Dart Training** | Viele Spiele, Caller | Nutzer berichten von Werbung trotz Kauf, Abstürzen auf dem iPad; Statistiken „in Arbeit“ | Keine Werbung, keine Accounts, robuste Wiederherstellung |
| **mydart / Dart Motion** (kamerabasiert) | Wurf-Analyse mit Pose-Tracking (MediaPipe), Gelenkwinkel, Rhythmus | Herstellerangaben, keine unabhängige Genauigkeitsprüfung; abhängig von Kameraposition | Video als **Selbstcheck-Werkzeug** (Zeitlupe, Linien, Vergleich) – ohne vorgetäuschte Messwerte |
| **Dartsva** (Web) | Mehrwöchige Pläne, Einstufungstest | Kostenpflichtig | Kostenloser Plan mit Eingangs- und Wiederholungstest |

**Trainingsmethodik, die eingeflossen ist**
- **Grouping zuerst**: Für Anfänger ist das Gruppieren (Dart 2 und 3 nah an Dart 1) die wichtigste frühe Fähigkeit; große Felder vor Triples.
- **Externer Aufmerksamkeitsfokus**: In Darts-Studien warfen Novizen mit Fokus auf das Ziel genauer als mit Fokus auf die Armbewegung → Technik vor der Aufnahme, beim Wurf nur ans Ziel denken.
- **Variables Üben**: Wechselnde Ziele/Bedingungen fördern laut Lernstudien das langfristige Behalten → Zielwechsel und „Gruppierung unter Bedingungen“.
- **Ein Technikmerkmal pro Einheit**, kurze regelmäßige Einheiten, Pausen als Teil des Lernens.
- **Bob's 27** nach den klassischen Regeln (Start 27, D1–D20 + Bull, Treffer addieren, drei Fehlwürfe ziehen ab, raus unter 0; Maximum 1437) – mit Anfänger-Variante ohne Ausscheiden.
- Standardmaße: Bull-Höhe 1,73 m, Abwurf Steel 2,37 m / Soft 2,44 m.

**Quellen (Auswahl)**: [Harrows – Practice routines](https://www.harrowsdarts.com/blogs/guides/darts-practice-routines-to-try-at-home) · [DartCounter – Bob's 27](https://dartcounter.net/games/bobs-27) · [DartCounter – 121 Checkout](https://dartcounter.net/games/121-checkout) · [DartCounter – Statistics](https://dartcounter.net/darts-manual/dartcounter-statistics) · [GoDartsPro](https://www.godartspro.com/) · [DolfDarts – Practice drills](https://dolfdarts.com/games/lists/best-dart-practice-drills) · [Darts World – Even Flow (Grouping)](https://dartsworld.com/?p=14317) · [Dartscorner – Beginner mistakes](https://www.dartscorner.co.uk/blogs/how-to/vermeiden-von-fehlern-fur-anfanger) · [Chua et al. 2019 – Practice variability & external focus](https://pure.psu.edu/en/publications/practice-variability-promotes-an-external-focus-of-attention-and-/) · [Marchant – Attentional focus (Hull)](https://hull-repository.worktribe.com/output/4216659) · [My Dart Training – Bewertungen](https://justuseapp.com/en/app/1529123323/my-dart-training/reviews) · [mydart (Store-Spiegel)](https://mwm.ai/apps/mydartapp/6762560486) · [MediaPipe Pose Landmarker (Web)](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

### Entscheidung zur automatischen Bewegungsanalyse
MediaPipe Pose läuft im Browser, liefert aber aus einem einzelnen Handyvideo (meist 30 fps, Bewegungsunschärfe beim Abwurf) nur **grobe 2D-Schätzungen**; Finger, Handgelenk und exakter Abwurfzeitpunkt sind damit nicht zuverlässig messbar, außerdem müsste ein Modell aus dem Netz nachgeladen werden. Deshalb misst die App **keine Gelenkwinkel** und stellt **keine automatischen Technik-Diagnosen**, sondern unterstützt den visuellen Selbstvergleich. Das ist in der App so kommuniziert.

---

## Architektur

```
src/
├─ domain/               Reine Fachlogik (kein React, vollständig getestet)
│  ├─ board.ts           Scheibengeometrie, Treffererkennung, Punktwerte, Zielprüfung
│  ├─ checkout.ts        Checkout-Wege (bewertet & erklärt), Bogey-Zahlen, Stell-Empfehlung
│  ├─ x01.ts             301/501: Bust, Double-/Single-/Master-Out, Double-In, Legs, Statistik
│  ├─ bot.ts             Virtueller Gegner (Gauß-Streuung um Zielpunkt, kalibriert 12–90 Average)
│  ├─ drills/            Übungs-Engines + Katalog (31 Übungen, Varianten, Texte)
│  ├─ statistics.ts      Wilson-Intervall, Zwei-Anteile-Test, Welch-t-Test, Binomialtest
│  ├─ stats.ts           Auswertungen: Übersicht, Trends, Segmente, Heatmap, Rekorde
│  ├─ coach.ts           Regelbasierter Coach: Fähigkeiten, Erkenntnisse, Empfehlung, Folgeübung
│  ├─ plan.ts            Programme/Stufen, Aufstiegskriterien, Einheiten-Baukasten
│  ├─ assessment.ts      Leistungstest + Vorher-Nachher-Vergleich
│  ├─ gamification.ts    XP, Level, Abzeichen, Serien, Wochenziel
│  ├─ challenges.ts      Tages-/Wochenchallenges
│  ├─ technique.ts       Inhalte des Technik-Coaches
│  └─ session.ts         Lebenszyklus einer Einheit (Pause, Wiederherstellung, Abschluss)
├─ data/                 IndexedDB-Repository (idb), Export/Import, Zustand (zustand)
└─ ui/                   React-Oberfläche (Screens, Scheibe, Eingabe, Diagramme, Runner)
```

**Event Sourcing**: Jede Übung ist eine reine Funktion über die Liste der Eingaben (`dart`, `visit`, `rate`). Der Zustand wird immer aus den Ereignissen berechnet. Dadurch funktionieren **Undo, Korrektur, Bot-Züge und Absturz-Wiederherstellung** in allen Übungen identisch und sind testbar.

**Datenmodell** (`src/domain/models.ts`): `Profile` (Einstellungen, Routine, Technikstatus, Planstand), `SessionRecord` (Einheit mit `DrillRecord`s: Konfiguration, Ereignisse, Würfe mit Ziel und Treffer, Ergebnis), `ActiveSession` (laufende Einheit, synchron in `localStorage` gesichert). Speicherung in IndexedDB; eine spätere Cloud-Synchronisation kann am Repository (`src/data/db.ts`) andocken.

**Technik**: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Recharts (Diagramme, lazy geladen), idb, zustand, lucide-react, vite-plugin-pwa (Workbox). Schriften (Inter, Barlow Condensed; OFL) lokal eingebunden. Hash-Routing für statisches Hosting. Diagrammfarben wurden auf Farbsehschwächen geprüft.

---

## Qualität & Tests

- **114 Unit-Tests** (Vitest): Scheibengeometrie, alle X01-Regeln (Bust, Rest 1, Finish ohne Doppel, Double-In, Legs, Undo mit Bot), Checkout-Rechner (gültige Wege für 2–170, Bogey-Zahlen), jede Übungs-Engine, **jede der Katalog-Varianten wird simuliert bis zum Ende gespielt**, Statistik-Tests, Coach (keine Verbesserung aus einer einzelnen Einheit), Plan-Aufstieg, Leistungstest-Vergleich, XP-Limit, Speicher inkl. Export/Import (fake-indexeddb). Bot-Kalibrierung wird per Simulation geprüft.
- **7 End-to-End-Tests** (Playwright, mobiles Chrome, Produktions-Build) für die Abnahmeszenarien:
  1. Erster Start → wenige Fragen → Anfängertraining (Eingangstest, 4-Stufen-Plan)
  2. Around the Clock: Eingabe per Tasten und Scheibe, Fortschritt, Undo, Korrektur
  3. Training absolvieren → korrekte Auswertung
  4. Daten bleiben erhalten – inkl. Wiederherstellung einer unterbrochenen Einheit
  5. + 6. Diagramme zeigen die Entwicklung; Coach empfiehlt begründet die Folgeübung
  7. 501: Punktzählung, unmögliche Werte, Bust (Überwerfen, Rest 1, 0 ohne Doppel), Undo, Double-Out-Finish
  - zusätzlich: komplette geführte Einheit (Eingangstest → Plan-Training mit Pause und Phasen)

---

## Bekannte Grenzen

- **Positionsgenauigkeit**: Angetippte Positionen sind etwa auf ±1 cm genau (Lupe hilft). Die App weist darauf hin.
- **Softdart-Scheiben** haben leicht andere Maße; die Grafik nutzt Steeldart-Turniermaße (Trefferzuordnung über Felder bleibt korrekt).
- **Aufnahme-Summen** (Tab „Summe“) liefern keine Einzeldarts – solche Aufnahmen fließen in Average und Checkout ein, nicht in Segment- oder Positionsstatistiken. Die Doppelquote basiert dabei auf deiner Angabe „Darts aufs Doppel“.
- **Daten liegen nur auf diesem Gerät**. Regelmäßig exportieren; Videos sind nicht im Export enthalten.
- Selbsteinschätzungen (Routine-Treue, Gruppierung ohne Board-Eingabe) sind als solche gekennzeichnet und keine Messwerte.
- Keine automatische Treffererkennung per Kamera und keine Anbindung an Auto-Scoring-Systeme (siehe Roadmap).

## Roadmap (nächste sinnvolle Schritte)

1. Optionale **Cloud-Synchronisation** (Repository-Schicht ist vorbereitet) und Mehrspieler-Profile.
2. **Cricket gegen den virtuellen Gegner** und weitere Spielmodi (Shanghai, Halve-It).
3. Anbindung **kompatibler Auto-Scoring-Systeme** (z. B. über lokale Schnittstellen), damit Würfe ohne Eingabe erfasst werden.
4. **Optionales KI-Coaching** auf Basis der vorhandenen, nachvollziehbaren Kennzahlen (die Regel-Engine bleibt als Fallback).
5. Experimentelle **Handgelenk-Spur** im Video – nur, wenn sich eine verlässliche Genauigkeit nachweisen lässt.

---

## Entwicklungsprotokoll

| Schritt | Ergebnis | Tests |
| --- | --- | --- |
| 1 · Repository & Domänenkern | Vite/React/TS/Tailwind/PWA; Scheibe, Checkouts, X01, Bot | 41 Unit-Tests |
| 2 · Übungs-Engines & Katalog | 11 Engines, 31 Übungen mit Varianten | +37 (u. a. Simulation aller Varianten) |
| 3 · Coaching-Logik | Statistik, Coach, Plan, Leistungstest, XP, Challenges, Sessions | +32 |
| 4 · Persistenz | IndexedDB, Absturz-Wiederherstellung, Export/Import | +4 |
| 5 · Oberfläche | Onboarding, Dashboard, Runner, Scheibe, Statistik, Technik, Profil, Video | Typecheck + Build |
| 6 · Abnahme | E2E-Szenarien, CI/Deployment, Dokumentation; zwei echte Bugs gefunden und behoben (Fehlermeldungen in Einheiten unsichtbar, Eingabeart sprang nach Selbsteinschätzung zurück) | 7 E2E-Tests |
