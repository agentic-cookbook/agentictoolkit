'use client'

import { useCallback, useState } from 'react'

// Where the Debug console remembers what you had selected.
//
// The console's BODY unmounts every time the window is hidden — FloatingWindow renders
// `null` while closed — so plain `useState` throws the whole drill-down away on each
// hide/show and re-opens on the built-in default. These helpers park each level's
// selection in localStorage instead, so showing the window again lands exactly where it
// was left: same root topic, same area, same item.
//
// A deliberate DESELECT has to survive too, so "cleared" is stored as its own marker
// rather than by removing the key: an ABSENT key means "never chosen here", and that is
// the only case that falls back to the caller's default.

const PREFIX = 'adh:debug-console:'

/** Stored marker for "the user cleared this level" — distinct from an absent key. */
const CLEARED = ''

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, value)
  } catch {
    /* storage disabled (private mode) — the in-memory selection still works this session */
  }
}

/**
 * Resolve a raw stored value against the ids currently on offer. Pure — the single
 * validation point shared by {@link usePersistedSelection} and its tests.
 *
 *  - `null` (nothing stored) → `fallback`: the console's own default, for a first visit.
 *  - `''` (stored deselect) → `null`: the user cleared this level; honor it.
 *  - a known id → that id.
 *  - a STALE id (theme deleted, area renamed, chat config withdrawn) → `fallback`,
 *    so a selection that no longer exists can never leave the stack pointing at nothing.
 */
export function resolveStoredSelection(
  raw: string | null,
  isValid: (id: string) => boolean,
  fallback: string | null,
): string | null {
  if (raw === null) return fallback
  if (raw === CLEARED) return null
  return isValid(raw) ? raw : fallback
}

/**
 * `useState` for one level's selection, restored from and written through to localStorage.
 *
 * `isValid` and `fallback` are consulted ONLY by the lazy initializer, i.e. on the first
 * render after the window is shown. That is what makes it safe for a validator to close
 * over a sibling selection restored moments earlier in the same component (the Site-theme
 * branch validates its stored item against its restored area) — by the time a later render
 * could pass a staler closure, the value is already resolved and never re-read.
 */
export function usePersistedSelection<T extends string>(
  key: string,
  isValid: (id: string) => boolean,
  fallback: T | null,
): [T | null, (next: T | null) => void] {
  const [value, setValue] = useState<T | null>(
    () => resolveStoredSelection(readRaw(key), isValid, fallback) as T | null,
  )
  const set = useCallback(
    (next: T | null) => {
      setValue(next)
      writeRaw(key, next ?? CLEARED)
    },
    [key],
  )
  return [value, set]
}
