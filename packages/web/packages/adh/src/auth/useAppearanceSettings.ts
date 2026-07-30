'use client'

import { useCallback } from 'react'
import { useAuth } from '@agentic-toolkit/auth'
import { authedRequest } from '@agentic-toolkit/auth/client'
import { useAppearancePreferences, type AppearancePrefs } from '@agentic-toolkit/themes'
// Package path, not relative: see wired-provider.tsx's telemetry import comment — this
// package bundles with tsup `bundle: true, splitting: false`, and `src/auth/index.ts` is
// its own tsup entry, so a relative '../telemetry/report-error' would inline a private,
// permanently-null copy of the `reporter` state instead of the one TelemetryProvider wires.
import { captureException } from '@agentic-toolkit/adh/telemetry/report-error'

export interface UseAppearanceSettings {
  prefs: AppearancePrefs
  /** Apply a change: live on this document immediately, and saved to the user's account. */
  set: (patch: Partial<AppearancePrefs>) => void
}

/**
 * The appearance preferences as a SETTING — the editing counterpart to {@link AppearanceSync}.
 *
 * The toolkit's `useAppearancePreferences` is deliberately transport-agnostic: it owns the prefs,
 * the document, and the per-browser cache, and knows nothing about adh's backend. This hook adds
 * the one adh-specific half — persisting to the signed-in USER (PUT /api/me/appearance), which is
 * what lets the choice made here follow them to the other ~44 sites instead of dying in this
 * origin's localStorage.
 *
 * Optimistic by design: the document updates on the click, and the save rides behind it. A failed
 * save is reported but not rolled back — yanking the theme back mid-interaction is worse than a
 * setting that is right here and re-syncs on the next load.
 *
 * Signed out, it degrades to the local-only behaviour (there is no account to save to).
 */
export function useAppearanceSettings(): UseAppearanceSettings {
  const { prefs, set: setLocal } = useAppearancePreferences()
  const { isAuthenticated } = useAuth()

  const set = useCallback(
    (patch: Partial<AppearancePrefs>) => {
      const next = { ...prefs, ...patch }
      setLocal(patch) // live, immediately
      if (!isAuthenticated) return
      // The whole shape, not the patch: PUT is a full replacement (see routes/appearanceSettings),
      // so two tabs can't interleave partial writes into a half-applied row.
      authedRequest('/api/me/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(captureException)
    },
    [prefs, setLocal, isAuthenticated],
  )

  return { prefs, set }
}
