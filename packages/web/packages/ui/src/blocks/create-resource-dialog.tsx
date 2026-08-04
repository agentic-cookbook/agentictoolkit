"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "../components/button"
import { UnsavedChangesAlert } from "../components/unsaved-changes-alert"

export interface CreateResourceDialogProps<TInput, TResult> {
  ariaLabel: string
  heading: string
  blank: () => TInput
  validate: (draft: TInput) => string | null
  create: (draft: TInput) => Promise<TResult>
  onClose: () => void
  onCreated: (result: TResult) => void
  renderForm: (
    draft: TInput,
    onChange: (next: TInput) => void,
    error: string | null,
  ) => ReactNode
  /** Optional extra Save gate beyond the has-any-input default — e.g. the New Product
   *  form disables Save until the identifier availability probe reports available.
   *  Click-time `validate` stays the backstop; this only drives the disabled state. */
  saveEnabled?: (draft: TInput) => boolean
  /** Telemetry seam for a failed `create` (the thrown error is ALSO shown inline).
   *  This block can't import `@agentic-toolkit/auth` (auth depends on ui) — the
   *  resource package re-exports this dialog with `reportUnexpectedAuthError`
   *  pre-wired here; standalone consumers may omit it. */
  onSaveError?: (err: unknown) => void
}

/**
 * The shared "New …" modal behind a topic level's `+` create affordance (the HTD
 * recipe's `must-create-in-modal`): the resource form (no top button bar) with
 * Cancel / Save at the lower right, plus a close (×) button that mirrors Cancel.
 * The dialog only dismisses through Save, Cancel, or × — clicking the backdrop
 * is inert and Esc routes through the same guarded close — so a stray click
 * can't discard a half-filled form. When the draft has unsaved edits, closing
 * first raises the platform's shared Discard/Stay alert; the alert never saves —
 * Stay returns to the form with the draft intact, Discard closes without saving.
 * `renderForm` supplies the entity-specific fields; `validate`/`create` close over
 * any context they need (e.g. the taken-identifiers list).
 */
export function CreateResourceDialog<TInput, TResult>({
  ariaLabel,
  heading,
  blank,
  validate,
  create,
  onClose,
  onCreated,
  renderForm,
  saveEnabled,
  onSaveError,
}: CreateResourceDialogProps<TInput, TResult>) {
  const [draft, setDraft] = useState<TInput>(blank)
  // A stable baseline (the empty form) for the unsaved-changes guard.
  const [pristine] = useState(blank)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Save is enabled once the form has any input; clicking validates and surfaces
  // the precise problem (e.g. the reverse-domain identifier rule) inline, rather
  // than leaving the button silently disabled with no explanation. A host may
  // narrow that via `saveEnabled` (async-informed forms like New Product).
  const dirty = JSON.stringify(draft) !== JSON.stringify(pristine)
  const canSave = dirty && (saveEnabled == null || saveEnabled(draft))

  // Cancel / × / Esc route here: a pristine form closes immediately; a dirty one
  // raises the platform's Discard/Stay alert instead of dismissing.
  function requestClose() {
    if (dirty) setConfirming(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (confirming) {
        // UnsavedChangesAlert is `destructive`, which forces AlertModal's keyboard
        // to "none" and blocks Escape entirely — this listener is the only thing
        // that makes Escape do anything while the alert is open, and it only ever
        // cancels the exit (maps to Stay), never discards, so it's safe to keep.
        setConfirming(false)
      } else if (dirty) setConfirming(true)
      else onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [confirming, dirty, onClose])

  async function save() {
    const problem = validate(draft)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      onCreated(await create(draft))
    } catch (err) {
      onSaveError?.(err)
      setError(err instanceof Error ? err.message : "Failed to create.")
      setSaving(false)
    }
  }

  // A modal PORTALS to the body. `fixed` took it out of the layout, but it stayed in the tree — and
  // a modal that is still a descendant of the pane that opened it inherits that pane's fate: the
  // hierarchical stack marks every pane that is not on top `inert` + `aria-hidden` in narrow mode, so
  // opening "New …" from a list header rendered a dialog nobody could type into (the form silently
  // refused every keystroke and Save stayed disabled). It also inherits any ancestor stacking context
  // or `overflow: hidden`, which a full-screen overlay must not. The body is the only parent that
  // owns none of that. Rendered only on the client — the server has no `document`, and a modal never
  // opens during SSR anyway.
  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="relative my-8 flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-apt-border bg-apt-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-apt-text">{heading}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={requestClose}
            disabled={saving}
          >
            <X />
          </Button>
        </div>
        {renderForm(draft, setDraft, error)}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )

  if (typeof document === "undefined") return null

  // UnsavedChangesAlert renders as a SIBLING of the overlay, not nested inside its `fixed
  // inset-0` div — nesting it under an ancestor that owns a stacking context and
  // `overflow-y-auto` is the same trap the overlay comment above documents for the dialog
  // itself. AlertModal portals itself regardless, so this only affects where its own
  // Portal target sits in the React tree, not the DOM — but staying flat here keeps that
  // trap from ever mattering.
  return createPortal(
    <>
      {overlay}
      <UnsavedChangesAlert
        open={confirming}
        onDiscard={onClose}
        onStay={() => setConfirming(false)}
      />
    </>,
    document.body,
  )
}
