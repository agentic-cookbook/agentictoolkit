'use client'

import { useCallback, useMemo, useRef } from 'react'
import type { PaneExitGuard } from '@agentic-toolkit/ui/blocks'

/**
 * Bridges a {@link CrudDataView}-style imperative `onGuardChange(guard)` callback into a STABLE
 * {@link PaneExitGuard} to publish to the enclosing stack. The live guard's closures change every
 * render (they close over fresh dirty/save state), so publishing it directly would loop; this keeps
 * the live guard in a ref and returns one stable proxy that reads it, plus the registrar to pass as
 * `onGuardChange`. Shared by CrudDataBrowser and the hub's KnowledgeBasesPane.
 */
export function useExitGuardChannel(): {
  exitGuard: PaneExitGuard
  registerGuard: (g: PaneExitGuard | null) => void
} {
  const guardRef = useRef<PaneExitGuard | null>(null)
  const exitGuard = useMemo<PaneExitGuard>(
    () => ({
      isDirty: () => guardRef.current?.isDirty() ?? false,
      save: () => guardRef.current?.save() ?? Promise.resolve(true),
    }),
    [],
  )
  const registerGuard = useCallback((g: PaneExitGuard | null) => {
    guardRef.current = g
  }, [])
  return { exitGuard, registerGuard }
}
