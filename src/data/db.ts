import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActiveSession, Profile, SessionRecord } from '../domain/models';

/**
 * Lokale Datenhaltung (IndexedDB). Keine Registrierung, keine Cloud.
 * Die Repository-Funktionen kapseln den Speicher, damit später eine
 * Synchronisation ergänzt werden kann, ohne die Oberfläche anzufassen.
 */

export interface VideoClip {
  id: string;
  createdAt: number;
  label: string;
  note?: string;
  durationS: number;
  mimeType: string;
  blob: Blob;
  /** Markierter Abwurfzeitpunkt (s) für den synchronen Vergleich. */
  syncPoint?: number;
}

interface CoachDB extends DBSchema {
  kv: { key: string; value: unknown };
  sessions: { key: string; value: SessionRecord; indexes: { startedAt: number } };
  videos: { key: string; value: VideoClip; indexes: { createdAt: number } };
}

const DB_NAME = 'darts-coach';
const DB_VERSION = 1;
let dbPromise: Promise<IDBPDatabase<CoachDB>> | null = null;

export function db(): Promise<IDBPDatabase<CoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CoachDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('kv');
        const s = database.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
        const v = database.createObjectStore('videos', { keyPath: 'id' });
        v.createIndex('createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

/** Nur für Tests: Verbindung schließen und zurücksetzen. */
export async function resetConnection(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function loadProfile(): Promise<Profile | null> {
  return ((await (await db()).get('kv', 'profile')) as Profile | undefined) ?? null;
}

export async function saveProfile(p: Profile): Promise<void> {
  await (await db()).put('kv', p, 'profile');
}

export async function loadSessions(): Promise<SessionRecord[]> {
  return (await db()).getAllFromIndex('sessions', 'startedAt');
}

export async function saveSession(s: SessionRecord): Promise<void> {
  await (await db()).put('sessions', s);
}

export async function deleteSession(id: string): Promise<void> {
  await (await db()).delete('sessions', id);
}

export async function listVideos(): Promise<VideoClip[]> {
  return (await (await db()).getAllFromIndex('videos', 'createdAt')).reverse();
}

export async function saveVideo(v: VideoClip): Promise<void> {
  await (await db()).put('videos', v);
}

export async function deleteVideo(id: string): Promise<void> {
  await (await db()).delete('videos', id);
}

export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(['kv', 'sessions', 'videos'], 'readwrite');
  await Promise.all([tx.objectStore('kv').clear(), tx.objectStore('sessions').clear(), tx.objectStore('videos').clear(), tx.done]);
  clearActiveDraft();
}

// ---------- Laufende Einheit: synchron in localStorage, damit nichts verloren geht ----------

const ACTIVE_KEY = 'dartsCoach.active';
const SEEN_KEY = 'dartsCoach.activeSeen';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveActiveDraft(a: ActiveSession): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(ACTIVE_KEY, JSON.stringify(a));
    ls.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* Speicher voll oder blockiert – Training läuft trotzdem weiter */
  }
}

export function touchActiveDraft(): void {
  const ls = storage();
  try {
    if (ls?.getItem(ACTIVE_KEY)) ls.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* ignorieren */
  }
}

export function loadActiveDraft(): { session: ActiveSession; lastSeen: number } | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as ActiveSession;
    if (!session?.id || !Array.isArray(session.phases) || !Array.isArray(session.progress)) return null;
    return { session, lastSeen: Number(ls.getItem(SEEN_KEY)) || Date.now() };
  } catch {
    return null;
  }
}

export function clearActiveDraft(): void {
  const ls = storage();
  try {
    ls?.removeItem(ACTIVE_KEY);
    ls?.removeItem(SEEN_KEY);
  } catch {
    /* ignorieren */
  }
}

// ---------- Export / Import ----------

export interface ExportFile {
  app: 'darts-coach';
  format: 1;
  exportedAt: string;
  profile: Profile | null;
  sessions: SessionRecord[];
}

export async function exportData(): Promise<ExportFile> {
  return { app: 'darts-coach', format: 1, exportedAt: new Date().toISOString(), profile: await loadProfile(), sessions: await loadSessions() };
}

export class ImportError extends Error {}

/** Prüft eine Importdatei grob auf Plausibilität. */
export function parseImport(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Die Datei ist kein gültiges JSON.');
  }
  const d = data as Partial<ExportFile>;
  if (!d || d.app !== 'darts-coach' || d.format !== 1) throw new ImportError('Das ist keine Darts-Coach-Sicherung.');
  if (!Array.isArray(d.sessions)) throw new ImportError('Die Sicherung enthält keine Trainingsdaten.');
  for (const s of d.sessions) {
    if (!s || typeof s.id !== 'string' || typeof s.startedAt !== 'number' || !Array.isArray(s.drills)) {
      throw new ImportError('Mindestens eine Trainingseinheit ist beschädigt.');
    }
  }
  return d as ExportFile;
}

/** Importiert Daten. "merge" ergänzt fehlende Sessions, "replace" ersetzt alles. */
export async function importData(file: ExportFile, mode: 'merge' | 'replace'): Promise<{ added: number }> {
  const d = await db();
  const tx = d.transaction(['kv', 'sessions'], 'readwrite');
  const sessions = tx.objectStore('sessions');
  if (mode === 'replace') {
    await sessions.clear();
    if (file.profile) await tx.objectStore('kv').put(file.profile, 'profile');
  }
  let added = 0;
  for (const s of file.sessions) {
    if (mode === 'merge' && (await sessions.get(s.id))) continue;
    await sessions.put(s);
    added++;
  }
  if (mode === 'merge' && file.profile && !(await tx.objectStore('kv').get('profile'))) {
    await tx.objectStore('kv').put(file.profile, 'profile');
  }
  await tx.done;
  return { added };
}
