"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

import {
  APPEARANCE_DEFAULTS,
  applyAppearance,
  clearStoredAppearance,
  readStoredAppearance,
  writeStoredAppearance,
  type AppearancePrefs,
} from "./appearance"

/**
 * A tiny external store for the appearance preferences. No React Context /
 * Provider is needed: the pre-paint script applies the persisted prefs before
 * hydration, and any change made through `useAppearancePreferences().set(...)`
 * writes localStorage + re-applies to the document immediately. Components that
 * read the prefs (the settings panel) subscribe via useSyncExternalStore.
 *
 * localStorage is a per-browser CACHE of the signed-in user's prefs, which live on
 * the server (GET/PUT /me/appearance) so they follow the user across the family's
 * many domains. The two entry points that reconcile the cache with the truth are
 * `adoptAppearance` (sign-in: the server's prefs win) and `resetAppearance`
 * (sign-out: back to the OS setting, cache cleared). Both are called by
 * AppearanceSync in @agentic-toolkit/adh/auth.
 */

let current: AppearancePrefs | null = null
const listeners = new Set<() => void>()

// ONE shared listener for the whole app (not one per subscriber): re-resolve
// `auto` color mode when the OS scheme flips. Reduced-motion / contrast are
// handled in CSS @media queries, so only the resolved `.dark` class needs JS.
// Attached once at module load (client only) and lives for the app's lifetime.
//
// `matchMedia` is probed, not assumed. This module is now in EVERY site's graph (the shared
// AuthProvider mounts AppearanceSync), and it runs this at MODULE SCOPE — so on any host that
// lacks matchMedia the import itself would throw and take the whole app down over a cosmetic
// preference. A test renderer under jsdom is the case that caught it; the principle is the
// same for any stripped-down environment. Absent ⇒ no OS signal ⇒ `auto` resolves to light,
// which is exactly what a host with no colour-scheme media query is telling us.
const systemDarkMq =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null

// `addEventListener` is probed too: Safari < 14 shipped MediaQueryList with only the legacy
// addListener, and a hard call would throw here for the same module-scope reason.
if (typeof systemDarkMq?.addEventListener === "function") {
  systemDarkMq.addEventListener("change", () => {
    if (current?.colorMode === "auto") {
      applyAppearance(document.documentElement, current, systemDarkMq.matches)
    }
  })
}

function getSnapshot(): AppearancePrefs {
  if (current === null) current = readStoredAppearance()
  return current
}

function getServerSnapshot(): AppearancePrefs {
  return APPEARANCE_DEFAULTS
}

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Put `next` into effect: store it, cache it, repaint the document, notify readers. */
function commit(next: AppearancePrefs, cache: boolean): void {
  current = next
  if (cache) writeStoredAppearance(next)
  else clearStoredAppearance()
  if (typeof document !== "undefined") {
    applyAppearance(document.documentElement, next, systemDarkMq?.matches ?? false)
  }
  emit()
}

function setPrefs(patch: Partial<AppearancePrefs>): void {
  commit({ ...getSnapshot(), ...patch }, true)
}

/**
 * Sign-in: the server's saved prefs are the truth — adopt them wholesale (they win over
 * whatever this browser had cached, which may be another user's, or this user's from before
 * they changed it elsewhere) and re-cache so the next pre-paint on this browser is right.
 */
export function adoptAppearance(prefs: AppearancePrefs): void {
  commit(prefs, true)
}

/**
 * Sign-out (or never signed in): a visitor with no account has no preferences, so fall back to
 * the defaults — colour mode `auto`, i.e. follow the OS. The cache is CLEARED, not just
 * overwritten: leaving it behind would let the next person on this browser inherit the previous
 * user's theme through the pre-paint script.
 */
export function resetAppearance(): void {
  commit({ ...APPEARANCE_DEFAULTS }, false)
}

export interface UseAppearancePreferences {
  prefs: AppearancePrefs
  set: (patch: Partial<AppearancePrefs>) => void
}

export function useAppearancePreferences(): UseAppearancePreferences {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const set = useCallback((patch: Partial<AppearancePrefs>) => setPrefs(patch), [])
  return useMemo(() => ({ prefs, set }), [prefs, set])
}
