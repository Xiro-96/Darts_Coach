import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { session, testProfile, targetSession, hitsOn } from '../domain/testing';
import {
  clearAll,
  deleteSession,
  exportData,
  importData,
  ImportError,
  loadProfile,
  loadSessions,
  parseImport,
  resetConnection,
  saveProfile,
  saveSession,
} from './db';

describe('IndexedDB-Speicher', () => {
  beforeEach(async () => {
    await clearAll();
    await resetConnection();
  });

  it('speichert Profil und Sessions dauerhaft (auch nach neuer Verbindung)', async () => {
    await saveProfile(testProfile({ name: 'Max' }));
    await saveSession(targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 3), 2000));
    await saveSession(targetSession({ n: 20, kind: 'number' }, hitsOn(20, 9, 4), 1000));
    await resetConnection(); // simuliert App-Neustart
    expect((await loadProfile())?.name).toBe('Max');
    const s = await loadSessions();
    expect(s.map((x) => x.startedAt)).toEqual([1000, 2000]);
    expect(s[0].drills[0].throws).toHaveLength(9);
  });

  it('löscht einzelne Sessions', async () => {
    const s = session([], 1);
    await saveSession(s);
    await deleteSession(s.id);
    expect(await loadSessions()).toHaveLength(0);
  });

  it('Export → Import (Ersetzen und Zusammenführen)', async () => {
    await saveProfile(testProfile({ name: 'A' }));
    const a = session([], 1);
    await saveSession(a);
    const text = JSON.stringify(await exportData());
    await clearAll();
    const file = parseImport(text);
    expect((await importData(file, 'replace')).added).toBe(1);
    expect((await loadProfile())?.name).toBe('A');
    expect((await importData(file, 'merge')).added).toBe(0);
    await saveSession(session([], 5));
    expect(await loadSessions()).toHaveLength(2);
  });

  it('lehnt fremde oder beschädigte Dateien ab', () => {
    expect(() => parseImport('kein json')).toThrow(ImportError);
    expect(() => parseImport(JSON.stringify({ app: 'x' }))).toThrow(ImportError);
    expect(() => parseImport(JSON.stringify({ app: 'darts-coach', format: 1, sessions: [{ id: 1 }] }))).toThrow(ImportError);
  });
});
