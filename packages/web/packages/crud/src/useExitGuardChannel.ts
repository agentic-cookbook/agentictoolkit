'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { PaneExitGuard } from '@agentic-toolkit/ui/blocks'

/**
 * Bridges a {@link CrudDataView}-style imperative `onGuardChange(guard)` callback into a STABLE
 * {@link PaneExitGuard} to publish to the enclosing stack. The live guard's closures change every
 * render (they close over fresh dirty state), so publishing it directly would loop; this keeps
 * the live guard in a ref and returns one stable proxy that reads it, plus the registrar to pass as
 * `onGuardChange`. Shared by CrudDataBrowser, PersonaEditor, IntegrationData and KnowledgeBasesPane.
 *
 * `exitGuard` is null while the bridged view is clean, because the view registers only while dirty.
 * That makes PRESENCE the dirty signal — a render value the enclosing shell's UnsavedChangesGuard
 * can use, which a pull-only `isDirty()` never could. The proxy's identity stays stable across
 * re-registrations so the rail host does not churn.
 */
export function useExitGuardChannel(): {
  exitGuard: PaneExitGuard | null
  registerGuard: (g: PaneExitGuard | null) => void
} {
  const guardRef = useRef<PaneExitGuard | null>(null)
  const [present, setPresent] = useState(false)
  const proxy = useMemo<PaneExitGuard>(
    () => ({
      isDirty: () => guardRef.current?.isDirty() ?? false,
    }),
    [],
  )
  const registerGuard = useCallback((g: PaneExitGuard | null) => {
    guardRef.current = g
    // Same boolean → React bails out, so a view that re-registers every render costs nothing.
    setPresent(g !== null)
  }, [])
  return { exitGuard: present ? proxy : null, registerGuard }
}
