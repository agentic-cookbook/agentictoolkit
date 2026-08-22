'use client'

import { useSyncExternalStore } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Hub preferences — the small, per-device choices about the hub's own chrome,
// persisted in localStorage. Today that is one setting: which chord opens the
// site menu. The "Hub Preferences" panel in User Settings writes here; the site
// menu reads here.
//
// PER DEVICE, not per account, and deliberately so for now. A keyboard shortcut
// is a property of the keyboard you are sitting at — the chord that is free on a
// Mac laptop is a window-manager binding on a Linux desktop — so syncing one to
// the account would carry a choice made on one machine onto a machine where it
// cannot fire. If that turns out to be wrong, the seam is `readStorage`/
// `writeStorage` below: an account-backed store slots in behind the same
// `useHubPreferences()` the two consumers call, and neither has to change.
//
// Follows the platform localStorage conventions this package's `recents` store
// established: an `adh:` key prefix, an SSR guard (`typeof window`), try/catch so
// a broken store never breaks the menu, and a stable snapshot reference between
// writes so `useSyncExternalStore` doesn't loop.

/** The hub's per-device chrome preferences. */
export type HubPreferences = {
  /** The chord that opens the site menu, in `@agentic-toolkit/ui/hooks/useShortcut`
   *  spelling (e.g. `'mod+shift+k'`). Empty string means the user turned it off —
   *  distinct from "unset", which falls back to {@link DEFAULT_SITE_MENU_SHORTCUT}. */
  siteMenuShortcut: string
}

/**
 * ⌘⇧K (Ctrl+Shift+K off Apple).
 *
 * Chosen for what is NOT taken. `mod+k` is the projects command palette — the one other
 * chord this codebase registers globally — and the site menu is that palette's sibling
 * surface, so it wants to read as one key away rather than as an unrelated binding. The
 * `shift` is what buys the room: every single-modifier ⌘-letter on a Mac belongs to the
 * browser (⌘T/W/N/L/D/F/R/P/S/O and the digits), and `alt`+letter is unusable here on
 * principle rather than by accident — ⌥S emits `ß`, so an alt-letter chord stops matching
 * the moment the layout changes what the key produces.
 *
 * It is a DEFAULT, not a decision: the whole point of the Hub Preferences panel is that a
 * user whose browser does claim this one (Firefox binds ⌘⇧K to the web console) can move it.
 */
export const DEFAULT_SITE_MENU_SHORTCUT = 'mod+shift+k'

const KEY = 'adh:hub-preferences'

const DEFAULTS: HubPreferences = { siteMenuShortcut: DEFAULT_SITE_MENU_SHORTCUT }

// A cached snapshot with a STABLE reference between writes, so useSyncExternalStore
// doesn't loop (it compares snapshots by identity). Only reassigned on a real change.
let snapshot: HubPreferences = DEFAULTS

/** Read + validate the persisted preferences (SSR/private-mode/corrupt ⇒ defaults). */
function readStorage(): HubPreferences {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS
    const stored = (parsed as Partial<HubPreferences>).siteMenuShortcut
    // A stored '' is a real answer (the user turned the shortcut off) and must survive the
    // fallback, which is why this tests the TYPE rather than truthiness.
    return typeof stored === 'string' ? { siteMenuShortcut: stored } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function writeStorage(prefs: HubPreferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage failures (private mode, quota) — the in-memory snapshot still
    // reflects the change for this session.
  }
}

type Listener = () => void
const listeners = new Set<Listener>()
function emit(): void {
  for (const l of listeners) l()
}

// Hydrate the snapshot once on the client so the first getSnapshot is accurate.
if (typeof window !== 'undefined') snapshot = readStorage()

/** The current preferences (a stable reference until the next write). */
export function readHubPreferences(): HubPreferences {
  return snapshot
}

/** Set the site-menu chord. `''` turns the shortcut off; pass
 *  {@link DEFAULT_SITE_MENU_SHORTCUT} to restore the default. */
export function setSiteMenuShortcut(keys: string): void {
  if (snapshot.siteMenuShortcut === keys) return
  snapshot = { ...snapshot, siteMenuShortcut: keys }
  writeStorage(snapshot)
  emit()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Cross-tab: another tab's write fires a `storage` event here — refresh + notify.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return
    snapshot = readStorage()
    emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Subscribe a component to the hub preferences. Server render + first paint yield the
 * DEFAULTS (localStorage is client-only) — matching the initial client snapshot
 * pre-hydration, so no mismatch — then the stored value flows through on the first write
 * or on hydration of a tab that already had one.
 */
export function useHubPreferences(): HubPreferences {
  return useSyncExternalStore(subscribe, readHubPreferences, () => DEFAULTS)
}
