"use client";

// Which workspace /home's chooser last landed on — the answer that has to travel.
//
// The family spans ~45 sites across as many registrable domains, so there is no shared origin
// and no shared cookie domain: a browser-local copy cannot follow a signed-in user from one
// site to the next. The SERVER row (settings.workspace, GET/PUT /me/workspace-prefs) is the
// source of truth; localStorage is a per-browser CACHE of it that exists so the first paint
// doesn't wait on a round trip — SiteHomeShell seeds its first resolution from
// `readCachedWorkspace()` synchronously and lets `get()` settle behind it. (Unlike
// @agentic-toolkit/themes's appearance cache, this one carries no clear-on-sign-out: the shell
// validates any cached slug against the signed-in user's own workspace list before it can
// affect anything, so a stale entry from a previous user is inert.)

import { authedJson, authedRequest } from "./http";
import { dataConfig } from "./config";

/** What the server remembers about the caller's workspace choice. Empty for a first-time user. */
export interface WorkspacePrefs {
  /** The chosen workspace's slug. Absent when the user has never chosen. */
  slug?: string;
}

// Same `{prefix}:…` scheme as ftd-storage's keys, so a non-adh host that sets
// configureData({ storageKeyPrefix }) namespaces this too.
const key = (): string => `${dataConfig().storageKeyPrefix}:home:workspace`;

/** The cached slug, or null (server-side, never chosen, or storage unreadable). */
export function readCachedWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key());
  } catch {
    return null;
  }
}

/** Cache the chosen slug for this browser. Best effort — see readCachedWorkspace. */
export function writeCachedWorkspace(slug: string): void {
  try {
    localStorage.setItem(key(), slug);
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

export const workspacePrefsApi = {
  /** The caller's stored choice. `{}` when they have never chosen — never a 404. */
  async get(): Promise<WorkspacePrefs> {
    const { prefs } = await authedJson<{ prefs: WorkspacePrefs }>("/api/me/workspace-prefs");
    return prefs;
  },
  /** Replace the stored choice. A full representation, like the appearance PUT. */
  async put(prefs: WorkspacePrefs): Promise<void> {
    await authedRequest("/api/me/workspace-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  },
};
