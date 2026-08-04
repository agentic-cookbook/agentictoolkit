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
  /**
   * Replaces the description sentence when — and only when — the surface can name
   * the specific thing at risk (see the docblock rule). Defaults to
   * {@link DEFAULT_DESCRIPTION}.
   */
  description?: string
}

/**
 * True of a page exit and of a dialog dismissal alike, which is why it says nothing
 * about leaving: most mounts now gate the closing of a modal, where the user is not
 * leaving anything.
 */
const DEFAULT_DESCRIPTION = "Your unsaved changes will be lost."

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
 *
 * ## What a call site may change
 *
 * The title and both button labels are FIXED and have no props: they are the
 * consistency guarantee — one question, one pair of answers, everywhere.
 *
 * `description` is the single exception, because "what our prompt says" is shared
 * knowledge while "what is at risk on THIS surface" is the surface's own. Override
 * it only where the surface can name that thing (a staged user list, a composed
 * invitation) — never to re-word the default, and the replacement must still be a
 * plain statement of what is lost, so the prompt reads the same everywhere it is
 * raised. A surface with nothing more specific to say passes nothing.
 */
export function UnsavedChangesAlert({
  open,
  onDiscard,
  onStay,
  description = DEFAULT_DESCRIPTION,
}: UnsavedChangesAlertProps): React.ReactElement {
  return (
    <AlertModal
      open={open}
      destructive
      title="Discard unsaved changes?"
      description={description}
      confirmLabel="Discard"
      cancelLabel="Stay"
      onConfirm={onDiscard}
      onCancel={onStay}
    />
  )
}
