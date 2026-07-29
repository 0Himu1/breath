"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface LocalSession {
  id: string;
  patternSlug: string;
  startedAt: string;
  durationSec: number;
  completed: boolean;
  moodBefore?: number;
  moodAfter?: number;
  synced: boolean;
}

export interface LocalPreference {
  theme: "system" | "light" | "dark";
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  defaultPatternSlug: string;
  sessionDurationMin: number;
  wimHofRounds: 3 | 4;
}

interface BreathDb extends DBSchema {
  sessions: {
    key: string;
    value: LocalSession;
    indexes: { "by-started": string };
  };
  preferences: {
    key: string;
    value: LocalPreference;
  };
}

let dbPromise: Promise<IDBPDatabase<BreathDb>> | null = null;

export const defaultPreference: LocalPreference = {
  theme: "system",
  soundEnabled: false,
  hapticsEnabled: false,
  defaultPatternSlug: "coherent",
  sessionDurationMin: 3,
  wimHofRounds: 3,
};

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<BreathDb>("breath-local", 1, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-started", "startedAt");
        db.createObjectStore("preferences");
      },
    });
  }

  return dbPromise;
}

export async function getPreference() {
  const db = await getDb();
  return { ...defaultPreference, ...((await db.get("preferences", "current")) ?? {}) };
}

export async function savePreference(preference: LocalPreference) {
  const db = await getDb();
  await db.put("preferences", preference, "current");
}

export async function getSessions() {
  const db = await getDb();
  return (await db.getAllFromIndex("sessions", "by-started")).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export async function saveSession(session: LocalSession) {
  const db = await getDb();
  await db.put("sessions", session);
}

export async function markSessionSynced(id: string) {
  const db = await getDb();
  const session = await db.get("sessions", id);
  if (session) {
    await db.put("sessions", { ...session, synced: true });
  }
}

export async function getUnsyncedSessions() {
  const sessions = await getSessions();
  return sessions.filter((session) => !session.synced);
}

export function getAnonymousId() {
  const key = "breath.anonymousId";
  let anonymousId = localStorage.getItem(key);
  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    localStorage.setItem(key, anonymousId);
  }
  return anonymousId;
}

export function computeStreak(sessions: LocalSession[], now = new Date()) {
  const completedDays = new Set(
    sessions
      .filter((session) => session.completed)
      .map((session) => toLocalDateKey(new Date(session.startedAt))),
  );
  let cursor = startOfLocalDay(now);
  let streak = 0;

  while (completedDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  return streak;
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
