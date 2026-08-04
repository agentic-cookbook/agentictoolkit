"use client"

import * as React from "react"

import type { UnsavedChangesAlertProps } from "../components/unsaved-changes-alert"

/** A leaf editor's unsaved-work guard: what a pane tells the enclosing block about its unsaved
 *  work. The block consults `isDirty()` before any action that clears or replaces the open detail
 *  (Back / breadcrumb-up / re-click / shallower select / a sibling swap at the deepest level). */
export interface PaneExitGuard {
  isDirty(): boolean
}

/**
 * The unsaved-work gate shared by every master-detail block. Any action that would
 * clear a level — Back, re-click-deselect, breadcrumb up-nav, selecting a shallower
 * row — runs through `attemptExit`. Dirty holds the action and opens the alert;
 * clean acts immediately.
 *
 * One hook rather than a copy per block: HTDV and HMDV held byte-identical copies of
 * this, which is how they came to disagree about what the prompt should say.
 */
export function useExitGate(exitGuard: PaneExitGuard | null): {
  attemptExit: (action: () => void) => void
  exitAlertProps: UnsavedChangesAlertProps
} {
  const [pendingExit, setPendingExit] = React.useState<(() => void) | null>(null)

  const attemptExit = React.useCallback(
    (action: () => void) => {
      if (exitGuard?.isDirty()) setPendingExit(() => action)
      else action()
    },
    [exitGuard],
  )

  return {
    attemptExit,
    exitAlertProps: {
      open: pendingExit !== null,
      // Discard runs the held action; the alert never saves, so a user who wants to
      // keep the edits presses Stay and saves in the editor.
      onDiscard: () => {
        pendingExit?.()
        setPendingExit(null)
      },
      onStay: () => setPendingExit(null),
    },
  }
}
