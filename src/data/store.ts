import { create } from 'zustand';
import type { DrillEvent } from '../domain/drills/types';
import { runDrill, undoEvents, validateEvent } from '../domain/drills/registry';
import type { ActiveSession, Profile, SessionRecord } from '../domain/models';
import { advancePlan } from '../domain/plan';
import { finalizeSession, pause as pauseSession, recoverAfterGap, resume as resumeSession, type FinalizeOutcome } from '../domain/session';
import * as repo from './db';

export interface SessionSummary extends FinalizeOutcome {
  planMessage?: string;
}

interface AppState {
  ready: boolean;
  loadError: string | null;
  profile: Profile | null;
  sessions: SessionRecord[];
  active: ActiveSession | null;
  /** Ergebnis der zuletzt abgeschlossenen Einheit (für die Auswertung). */
  lastSummary: SessionSummary | null;
  toast: { id: number; text: string; tone: 'good' | 'bad' | 'info' } | null;
  /** Während einer Einheit gewählte Eingabeart (gilt bis zum Ende der Einheit). */
  sessionInput: 'board' | 'buttons' | 'total' | null;
  setSessionInput(m: 'board' | 'buttons' | 'total'): void;

  init(): Promise<void>;
  setProfile(p: Profile): Promise<void>;
  updateProfile(fn: (p: Profile) => Profile): Promise<void>;
  startSession(a: ActiveSession): void;
  setActive(fn: (a: ActiveSession) => ActiveSession): void;
  addEvent(e: DrillEvent): string | null;
  undo(): void;
  pause(): void;
  resume(): void;
  finishActive(): Promise<SessionSummary | null>;
  discardActive(): void;
  deleteSession(id: string): Promise<void>;
  reloadSessions(): Promise<void>;
  showToast(text: string, tone?: 'good' | 'bad' | 'info'): void;
  resetAll(): Promise<void>;
}

let toastCounter = 0;

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  loadError: null,
  profile: null,
  sessions: [],
  active: null,
  lastSummary: null,
  toast: null,
  sessionInput: null,

  setSessionInput(m) {
    set({ sessionInput: m });
  },

  async init() {
    try {
      const [profile, sessions] = await Promise.all([repo.loadProfile(), repo.loadSessions()]);
      const draft = repo.loadActiveDraft();
      let active = draft ? recoverAfterGap(draft.session, draft.lastSeen) : null;
      // Eine bereits gespeicherte Einheit nicht doppelt wiederherstellen
      if (active && sessions.some((s) => s.id === active!.id)) {
        repo.clearActiveDraft();
        active = null;
      }
      set({ profile, sessions, active, ready: true, loadError: null });
      if (active) repo.saveActiveDraft(active);
    } catch (err) {
      set({ ready: true, loadError: err instanceof Error ? err.message : 'Speicher nicht verfügbar' });
    }
  },

  async setProfile(p) {
    await repo.saveProfile(p);
    set({ profile: p });
  },

  async updateProfile(fn) {
    const cur = get().profile;
    if (!cur) return;
    const next = fn(cur);
    await repo.saveProfile(next);
    set({ profile: next });
  },

  startSession(a) {
    repo.saveActiveDraft(a);
    set({ active: a, sessionInput: null });
  },

  setActive(fn) {
    const a = get().active;
    if (!a) return;
    const next = fn(a);
    repo.saveActiveDraft(next);
    set({ active: next });
  },

  addEvent(e) {
    const a = get().active;
    if (!a) return 'Keine aktive Einheit';
    const idx = a.phaseIdx;
    const phase = a.phases[idx];
    const prog = a.progress[idx];
    const err = validateEvent(phase.config, prog.events, e);
    if (err) return err;
    const events = [...prog.events, { ...e, at: e.at ?? Date.now() }];
    const finished = runDrill(phase.config, events).finished;
    get().setActive((s) => ({
      ...s,
      progress: s.progress.map((p, i) =>
        i === idx ? { ...p, events, startedAt: p.startedAt ?? Date.now(), endedAt: finished ? Date.now() : undefined } : p,
      ),
    }));
    return null;
  },

  undo() {
    get().setActive((s) => ({
      ...s,
      progress: s.progress.map((p, i) => (i === s.phaseIdx ? { ...p, events: undoEvents(p.events), endedAt: undefined } : p)),
    }));
  },

  pause() {
    get().setActive((s) => pauseSession(s));
  },

  resume() {
    get().setActive((s) => resumeSession(s));
  },

  async finishActive() {
    const a = get().active;
    const profile = get().profile;
    if (!a || !profile) return null;
    const previous = get().sessions;
    const outcome = finalizeSession(resumeSession(a), previous);
    let summary: SessionSummary = outcome;
    if (outcome.record.drills.length > 0) {
      await repo.saveSession(outcome.record);
      const sessions = [...previous, outcome.record].sort((x, y) => x.startedAt - y.startedAt);
      let nextProfile = profile;
      if (outcome.record.plan) {
        const adv = advancePlan(profile, sessions);
        if (adv.advanced) {
          nextProfile = adv.profile;
          await repo.saveProfile(nextProfile);
          summary = { ...outcome, planMessage: adv.message };
        }
      }
      set({ sessions, profile: nextProfile });
    }
    repo.clearActiveDraft();
    set({ active: null, lastSummary: summary });
    return summary;
  },

  discardActive() {
    repo.clearActiveDraft();
    set({ active: null });
  },

  async deleteSession(id) {
    await repo.deleteSession(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },

  async reloadSessions() {
    const [profile, sessions] = await Promise.all([repo.loadProfile(), repo.loadSessions()]);
    set({ profile, sessions });
  },

  showToast(text, tone = 'info') {
    const id = ++toastCounter;
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2600);
  },

  async resetAll() {
    await repo.clearAll();
    set({ profile: null, sessions: [], active: null, lastSummary: null });
  },
}));

// Beim Verlassen/Verstecken der Seite den Zeitstempel sichern (für Pausen-Erkennung)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => repo.touchActiveDraft());
  setInterval(() => repo.touchActiveDraft(), 30000);
}
