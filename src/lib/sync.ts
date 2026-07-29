"use client";

import {
  getAnonymousId,
  getUnsyncedSessions,
  markSessionSynced,
  type LocalSession,
} from "@/lib/local-db";

export async function syncSession(session: LocalSession) {
  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousUserId: getAnonymousId(), session }),
    });

    if (!response.ok) return false;
    await markSessionSynced(session.id);
    return true;
  } catch {
    return false;
  }
}

export async function retryUnsyncedSessions() {
  const sessions = await getUnsyncedSessions();
  for (const session of sessions) {
    await syncSession(session);
  }
}
