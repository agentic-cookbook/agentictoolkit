"use client";

import { useSyncExternalStore } from "react";

// How many lines of each note's body the rail shows under its title — the notes list's one
// display setting, behind the gear in that level's header.
//
// It is a PREFERENCE, not data: it belongs to this browser on this site, changes nothing any
// other client would see, and is cheap to get wrong. So it lives in `localStorage` rather
// than on the note, the workspace or the account. Each site is its own origin, which is what
// "keyed per site" comes to — a notebook and a research site never share the number without
// anything having to key it.
//
// Storage and notification mirror `ui/src/blocks/debug-options.ts`: the value is in
// localStorage (shared across every tab), the subscriber set is pinned on `globalThis` so a
// write from the gear menu notifies a list rendered from a different bundle chunk, and the
// server snapshot is the DEFAULT so a stored number can never cause a hydration mismatch.

const KEY = "apt:notebook:preview-lines";

/** No preview at all — the row is title + sublabel, as it was before this setting existed. */
export const PREVIEW_LINES_MIN = 0;
/** The ceiling the backend's `excerpt` can actually fill (it derives at most four lines). */
export const PREVIEW_LINES_MAX = 4;
/** Two lines by default: enough that the preview is visible without being hunted for in a
 *  menu, short enough that a long list still scans as a list. */
export const PREVIEW_LINES_DEFAULT = 2;

const listeners: Set<() => void> = ((
  globalThis as { __aptNotebookPreviewListeners?: Set<() => void> }
).__aptNotebookPreviewListeners ??= new Set());

/** Clamp anything — a stored string, a stale value, a hand-edited localStorage entry — into
 *  the supported range. A number outside it renders no line-clamp class at all, so the
 *  clamp is what keeps a bad value from silently meaning "unlimited". */
export function clampPreviewLines(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n)) return PREVIEW_LINES_DEFAULT;
  return Math.min(PREVIEW_LINES_MAX, Math.max(PREVIEW_LINES_MIN, Math.trunc(n)));
}

function read(): number {
  if (typeof window === "undefined") return PREVIEW_LINES_DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw == null ? PREVIEW_LINES_DEFAULT : clampPreviewLines(raw);
  } catch {
    return PREVIEW_LINES_DEFAULT;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` only fires in OTHER tabs; same-tab writes come through the emit in the setter.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === KEY) onChange();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => PREVIEW_LINES_DEFAULT;

/** Set the number of preview lines (clamped). Notifies every list in this tab immediately. */
export function setPreviewLines(value: number): void {
  const next = clampPreviewLines(value);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, String(next));
    } catch {
      /* storage disabled (private mode) — the emit below still updates this tab */
    }
  }
  for (const fn of listeners) fn();
}

/** The current setting. {@link PREVIEW_LINES_DEFAULT} on the server and the first client
 *  render; live thereafter. */
export function usePreviewLines(): number {
  return useSyncExternalStore(subscribe, read, serverSnapshot);
}
