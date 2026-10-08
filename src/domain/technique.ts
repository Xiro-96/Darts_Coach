import type { TechniqueId } from './drills/catalog';

export interface TechniqueTopic {
  id: TechniqueId;
  order: number;
  title: string;
  short: string;
  why: string;
  steps: string[];
  checkpoints: string[];
  mistakes: { problem: string; tryThis: string }[];
  options?: { title: string; text: string }[];
  drillId: string;
  /** Leitsatz für die Pre-Throw-Routine. */
  routineCue: string;
}

/**
 * Technik-Inhalte. Grundhaltung: Es gibt nicht DIE richtige Technik. Ziel ist eine
 * natürliche, bequeme und vor allem wiederholbare Bewegung. Pro Training wird nur
 * ein Merkmal bewusst verändert.
 */
export const TECHNIQUE: TechniqueTopic[] = [
  {
    id: 'stance',
    order: 1,
    title: 'Standposition',
    short: 'Ein stabiler, immer gleicher Stand ist die Basis für jeden Wurf.',
    why: 'Wenn sich dein Stand von Wurf zu Wurf verändert, verändert sich auch der Weg deiner Hand zum Ziel. Ein reproduzierbarer Stand nimmt eine große Fehlerquelle heraus – noch bevor du überhaupt wirfst.',
    steps: [
      'Stell den Fuß deiner Wurfseite vorn an die Abwurflinie (Rechtshänder: rechter Fuß).',
      'Drehe den Körper so, dass Wurfschulter, Ellbogen und Ziel ungefähr auf einer Linie liegen.',
      'Verlagere das Gewicht spürbar auf den vorderen Fuß; der hintere Fuß stützt nur.',
      'Oberkörper ruhig halten – nicht während des Wurfs nach vorn kippen.',
      'Markiere dir deine Fußposition (z. B. Klebeband an der Spitze), damit du sie jedes Mal wiederfindest.',
    ],
    checkpoints: [
      'Steht der vordere Fuß jedes Mal an derselben Stelle?',
      'Wackelst du nach dem Wurf, oder bleibst du stabil stehen?',
      'Bleiben Schulter und Kopf während des Wurfs ruhig?',
    ],
    mistakes: [
      { problem: 'Du kippst beim Wurf nach vorn.', tryThis: 'Etwas mehr Gewicht auf den vorderen Fuß, dafür nicht weiter lehnen. Prüfe, ob du nach dem Wurf noch sicher stehst.' },
      { problem: 'Der Stand fühlt sich jedes Mal anders an.', tryThis: 'Bodenmarkierung für die Fußspitze nutzen und vor jeder Aufnahme bewusst einnehmen.' },
      { problem: 'Du stehst sehr verdreht und es zieht im Rücken.', tryThis: 'Etwas offener stellen. Ein bequemer Stand, den du lange halten kannst, ist besser als ein "perfekter".' },
    ],
    options: [
      { title: 'Seitlicher Stand', text: 'Körper fast parallel zur Abwurflinie gedreht. Arm, Schulter und Ziel liegen gut auf einer Linie – stabil, aber für manche unbequem.' },
      { title: 'Mittlerer Stand', text: 'Körper etwa 45° zur Linie. Der häufigste Kompromiss aus Stabilität und Bequemlichkeit – guter Startpunkt.' },
      { title: 'Frontaler Stand', text: 'Körper zeigt eher zur Scheibe. Bequem, aber der Arm muss mehr ausgleichen.' },
    ],
    drillId: 'tech-stance',
    routineCue: 'Füße an die Markierung, Gewicht nach vorn',
  },
  {
    id: 'grip',
    order: 2,
    title: 'Griff',
    short: 'Fest genug für Kontrolle, locker genug für einen sauberen Abwurf.',
    why: 'Der Griff entscheidet, wie der Dart die Hand verlässt. Ein verkrampfter Griff blockiert das Loslassen, ein jedes Mal anderer Griff verändert die Flugbahn.',
    steps: [
      'Lege den Dart auf die flache Hand und finde den Schwerpunkt (dort balanciert er).',
      'Greife mit dem Daumen knapp hinter dem Schwerpunkt.',
      'Lege zwei bis vier Finger an – so viele, wie sich natürlich anfühlt.',
      'Die Spitze zeigt beim Zielen leicht nach oben.',
      'Nur so viel Druck, dass der Dart nicht wackelt – stell dir vor, du hältst ein rohes Ei.',
    ],
    checkpoints: ['Greifst du jeden Dart an derselben Stelle?', 'Sind deine Fingerkuppen entspannt (keine weißen Stellen)?', 'Zeigt die Spitze beim Zielen leicht nach oben?'],
    mistakes: [
      { problem: 'Die Darts fliegen mit der Spitze nach unten oder "schlingern".', tryThis: 'Griff etwas weiter hinten ausprobieren und Druck reduzieren. Nur eine Änderung pro Training!' },
      { problem: 'Die Hand ist nach ein paar Aufnahmen verkrampft.', tryThis: 'Zwischen den Darts die Hand kurz ausschütteln. Griffdruck bewusst halbieren.' },
    ],
    options: [
      { title: 'Drei-Finger-Griff', text: 'Daumen, Zeige- und Mittelfinger. Der häufigste Griff – gute Kontrolle, einfach zu wiederholen.' },
      { title: 'Vier-Finger-Griff', text: 'Zusätzlich der Ringfinger. Mehr Stabilität, oft bei längeren Barrels.' },
      { title: 'Zwei-Finger-Griff', text: 'Daumen und Zeigefinger. Sehr direkt, braucht aber viel Gefühl.' },
    ],
    drillId: 'tech-grip',
    routineCue: 'Griff prüfen – locker, nicht klammern',
  },
  {
    id: 'aim',
    order: 3,
    title: 'Zielen & Konzentration',
    short: 'Ein kleiner Zielpunkt und ein ruhiger Blick – bis der Dart steckt.',
    why: 'Studien zum Darts-Werfen zeigen: Anfänger treffen besser, wenn sie sich auf das Ziel (außen) statt auf ihre Armbewegung (innen) konzentrieren. Ein klarer, kleiner Zielpunkt gibt dem Körper ein eindeutiges Signal.',
    steps: [
      'Wähle einen winzigen Punkt im Ziel (z. B. ein Loch im Sisal) statt "irgendwo in der 20".',
      'Halte den Blick vor dem Ausholen ca. 2 Sekunden ruhig auf diesem Punkt.',
      'Auge, Dart und Ziel bilden eine Linie – viele Spieler peilen über die Dartspitze.',
      'Atme vor dem Wurf ruhig aus.',
      'Denke beim Wurf an das Ziel, nicht an den Arm.',
    ],
    checkpoints: ['Bleibt dein Blick auf dem Zielpunkt, bis der Dart steckt?', 'Hast du vor jedem Dart einen konkreten Punkt gewählt?'],
    mistakes: [
      { problem: 'Du schaust dem Dart hinterher oder auf den vorherigen Dart.', tryThis: 'Blick bewusst auf dem Punkt "einfrieren" bis zum Einschlag.' },
      { problem: 'Du denkst während des Wurfs an viele Technikdetails.', tryThis: 'Technik vor der Aufnahme kurz klären – beim Wurf selbst nur noch ans Ziel denken.' },
    ],
    drillId: 'tech-aim',
    routineCue: 'Kleinen Punkt fixieren, ruhig atmen',
  },
  {
    id: 'backswing',
    order: 4,
    title: 'Ausholbewegung',
    short: 'Ruhig, gleich lang und ohne Zucken zurück.',
    why: 'Die Ausholbewegung legt fest, auf welcher Bahn die Hand nach vorn beschleunigt. Ist sie jedes Mal gleich, wird auch der Wurf gleich.',
    steps: [
      'Der Oberarm bleibt möglichst ruhig, die Bewegung kommt aus dem Ellbogen.',
      'Führe den Dart in einer geraden Linie zurück Richtung Auge/Kinn.',
      'Immer etwa gleich weit zurück – nicht mal kurz, mal lang.',
      'Kein Stopp und kein Ruck am Umkehrpunkt: die Bewegung geht flüssig in den Wurf über.',
    ],
    checkpoints: ['Bewegt sich dein Ellbogen beim Ausholen nach unten oder zur Seite?', 'Ist die Ausholbewegung jedes Mal ähnlich lang?'],
    mistakes: [
      { problem: 'Der Ellbogen fällt beim Ausholen ab.', tryThis: 'Langsamer ausholen und auf einen ruhigen Oberarm achten. Videoaufnahme von der Seite hilft enorm.' },
      { problem: 'Du holst mehrmals aus ("Pumpen").', tryThis: 'Erlaubt, wenn es immer gleich ist. Wenn es unkontrolliert wird: einmal absetzen und neu ansetzen.' },
    ],
    drillId: 'tech-backswing',
    routineCue: 'Ruhig zurück, Ellbogen bleibt',
  },
  {
    id: 'release',
    order: 5,
    title: 'Abwurf',
    short: 'Locker beschleunigen und loslassen – Kraft braucht es kaum.',
    why: 'Bis zur Scheibe sind es nur etwa 2,4 Meter. Zu viel Kraft macht die Bewegung unruhig und den Abwurfzeitpunkt unberechenbar.',
    steps: [
      'Beschleunige gleichmäßig aus dem Unterarm nach vorn.',
      'Lass den Dart los, wenn der Arm sich nach vorn öffnet – wie beim Werfen eines Papierfliegers.',
      'Alle Finger öffnen sich gleichzeitig.',
      'Das Handgelenk darf natürlich mitgehen, aber nicht "schnappen" müssen.',
    ],
    checkpoints: ['Fühlt sich der Wurf locker an, oder drückst du?', 'Öffnen sich deine Finger gleichzeitig?'],
    mistakes: [
      { problem: 'Darts landen oft zu tief.', tryThis: 'Häufig hilft ein vollständiger Follow-through statt "mehr Kraft". Prüfe das zuerst.' },
      { problem: 'Darts landen mal hoch, mal tief.', tryThis: 'Achte auf einen gleichmäßigen Rhythmus – der Abwurfzeitpunkt hängt stark davon ab.' },
    ],
    drillId: 'tech-release',
    routineCue: 'Locker durchziehen und loslassen',
  },
  {
    id: 'followThrough',
    order: 6,
    title: 'Follow-through',
    short: 'Nach dem Loslassen zeigt die Hand aufs Ziel – kurz halten.',
    why: 'Der Follow-through sorgt dafür, dass der Arm nicht vor dem Loslassen abbremst. Ein abgebrochener Wurf ist eine der häufigsten Ursachen für zu tiefe Darts bei Anfängern.',
    steps: ['Arm nach dem Loslassen weiter Richtung Ziel strecken.', 'Finger zeigen am Ende auf das Ziel.', 'Endposition ca. 1 Sekunde halten ("Foto-Pose").', 'Erst dann den Arm locker sinken lassen.'],
    checkpoints: ['Zeigt deine Hand nach dem Wurf noch aufs Ziel?', 'Ziehst du den Arm ruckartig zurück?'],
    mistakes: [
      { problem: 'Der Arm stoppt direkt nach dem Loslassen.', tryThis: 'Übertreibe den Follow-through bewusst eine Trainingseinheit lang.' },
      { problem: 'Die Hand zieht nach dem Wurf zur Seite weg.', tryThis: 'Stell dir vor, du willst dem Dart hinterher "einen Faden ziehen" – gerade aufs Ziel.' },
    ],
    drillId: 'tech-follow',
    routineCue: 'Hand zeigt aufs Ziel – kurz halten',
  },
  {
    id: 'rhythm',
    order: 7,
    title: 'Rhythmus & Routine',
    short: 'Immer gleicher Ablauf, gleiches Tempo – vor jedem einzelnen Dart.',
    why: 'Eine feste Routine vor jedem Wurf sorgt dafür, dass jeder Dart unter möglichst gleichen Bedingungen geworfen wird. Sie hilft auch, unter Druck ruhig zu bleiben, weil der Ablauf vertraut ist.',
    steps: [
      'Lege eine kurze Abfolge fest: Stand → Griff → Ziel → Ausholen → Wurf → Halten.',
      'Nutze für jeden Schritt ein Stichwort.',
      'Halte das Tempo gleich – nicht hetzen, nicht zögern.',
      'Wenn du gestört wirst oder zögerst: absetzen und die Routine neu beginnen.',
      'Atme vor dem ersten Dart einer Aufnahme einmal bewusst aus.',
    ],
    checkpoints: ['Führst du deine Routine vor jedem Dart aus – auch beim dritten?', 'Ist dein Tempo zwischen den Darts gleichmäßig?'],
    mistakes: [
      { problem: 'Der dritte Dart ist hektischer als der erste.', tryThis: 'Den Routine-Player nutzen und bewusst bei jedem Dart neu starten.' },
      { problem: 'Die Routine ist zu lang und fühlt sich zäh an.', tryThis: 'Kürze sie auf 3–4 Schritte. Eine kurze Routine, die du immer machst, schlägt eine lange, die du vergisst.' },
    ],
    drillId: 'tech-rhythm',
    routineCue: 'Gleiches Tempo, gleicher Ablauf',
  },
];

export function getTechnique(id: TechniqueId): TechniqueTopic {
  return TECHNIQUE.find((t) => t.id === id)!;
}

export const TECHNIQUE_IDS: TechniqueId[] = TECHNIQUE.map((t) => t.id);
