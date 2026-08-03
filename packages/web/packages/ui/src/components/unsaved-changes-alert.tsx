"use client"

import * as React from "react"

import { AlertModal } from "./alert-modal"

export interface UnsavedChangesAlertProps {
  /** Whether the alert is showing. */
  open: boolean
  /** Throw the edits away and let the exit proceed. */
  onDiscard: () => void
  /** Abort the exit and return to the view with the edits intact. */
  onStay: () => void
}

/**
 * The ONE unsaved-changes prompt. Every editable details view raises this before
 * discarding edits, so the wording exists once instead of at each call site.
 *
 * Two actions by design: it never saves. The user returns to the view and saves
 * there, which keeps this component free of any dependency on how a given
 * surface persists its draft.
 *
 * `destructive` is load-bearing, not decoration: AlertModal forces
 * `keyboard: "none"` and `initialFocus: "cancel"` when it is set, so neither
 * Enter nor Escape can discard. Losing edits takes a deliberate click.
 */
export function UnsavedChangesAlert({
  open,
  onDiscard,
  onStay,
}: UnsavedChangesAlertProps): React.ReactElement {
  return (
    <AlertModal
      open={open}
      destructive
      title="Discard unsaved changes?"
      description="You have unsaved changes. If you leave they will be lost."
      confirmLabel="Discard"
      cancelLabel="Stay"
      onConfirm={onDiscard}
      onCancel={onStay}
    />
  )
}
