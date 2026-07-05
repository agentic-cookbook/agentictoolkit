"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

import {
  APPEARANCE_DEFAULTS,
  applyAppearance,
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
 */

let current: AppearancePrefs | null = null
const listeners = new Set<() => void>()

// ONE shared listener for the whole app (not one per subscriber): re-resolve
// `auto` color mode when the OS scheme flips. Reduced-motion / contrast are
// handled in CSS @media queries, so only the resolved `.dark` class needs JS.
// Attached once at module load (client only) and lives for the app's lifetime.
const systemDarkMq =
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null

if (systemDarkMq) {
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

function setPrefs(patch: Partial<AppearancePrefs>): void {
  const next = { ...getSnapshot(), ...patch }
  current = next
  writeStoredAppearance(next)
  if (typeof document !== "undefined") {
    applyAppearance(document.documentElement, next, systemDarkMq?.matches ?? false)
  }
  emit()
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
