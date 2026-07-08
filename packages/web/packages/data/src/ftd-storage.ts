// Per-collection FTD UI persistence — the last-focused entity and the All-view
// mode, keyed by a resource `basePath` (e.g. "/ecosystems"). Centralizes the
// `{prefix}:ftd:{basePath}:{name}` key scheme and the storage-failure guards
// (private mode / quota) so the call sites (ResourceTab, ResourceLanding, the
// per-tab delete handlers) can't drift apart. The `{prefix}` defaults to "adh"
// and is host-configurable via configureData({ storageKeyPrefix }) so a non-adh
// host can namespace its stored view state. See FTD spec §7–§8.

import { dataConfig } from "./config";

export type ViewMode = "cards" | "list";

const key = (basePath: string, name: string): string =>
  `${dataConfig().storageKeyPrefix}:ftd:${basePath}:${name}`;

/** The last-focused entity id for a collection, or null (missing/unreadable). */
export function readLastId(basePath: string): string | null {
  try {
    return localStorage.getItem(key(basePath, "lastId"));
  } catch {
    return null;
  }
}

/** Remember the last-focused entity id for a collection. */
export function writeLastId(basePath: string, id: string): void {
  try {
    localStorage.setItem(key(basePath, "lastId"), id);
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

/** Forget the last-focused entity (e.g. after it is deleted — FTD spec §8). */
export function clearLastId(basePath: string): void {
  try {
    localStorage.removeItem(key(basePath, "lastId"));
  } catch {
    // ignore storage failures
  }
}

/** The persisted All-view mode for a collection; defaults to "cards" (also the
 *  SSR/no-storage fallback, so the lazy initializer is hydration-safe). */
export function readViewMode(basePath: string): ViewMode {
  if (typeof window === "undefined") return "cards";
  try {
    const stored = localStorage.getItem(key(basePath, "viewMode"));
    return stored === "list" || stored === "cards" ? stored : "cards";
  } catch {
    return "cards";
  }
}

/** Persist the chosen All-view mode for a collection. */
export function writeViewMode(basePath: string, mode: ViewMode): void {
  try {
    localStorage.setItem(key(basePath, "viewMode"), mode);
  } catch {
    // ignore storage failures
  }
}
