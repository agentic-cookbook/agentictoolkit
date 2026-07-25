'use client'

// Who the viewer is, for the exposure gates — ONE place, so "counts as an admin here" can be
// refined (a finer capability than the global admin bit, a host-supplied override) without
// hunting down every component that asks.

import { isAdmin, useOptionalAuth } from '@agentic-toolkit/auth'

export interface CrudViewer {
  /** Whether the viewer holds the platform `admin` capability. */
  isAdmin: boolean
  /**
   * Whether that answer is SETTLED. False while auth is still bootstrapping, when `isAdmin` is
   * merely "not yet" rather than "no" — the gates must hold rather than guess, or an admin
   * watches the rail lose a schema and the editor lose its whole write surface, then get them
   * back a paint later.
   */
  ready: boolean
}

/**
 * The viewer behind the exposure gates ({@link canReadTable} / {@link canWriteTable}).
 *
 * Renders without an AuthProvider: the browser is usable standalone (a docs page, a public
 * shell), and no provider means an anonymous viewer — a settled answer, and the closed one.
 */
export function useViewer(): CrudViewer {
  const auth = useOptionalAuth()
  if (!auth) return { isAdmin: false, ready: true }
  return { isAdmin: isAdmin(auth.user), ready: !auth.isLoading }
}
