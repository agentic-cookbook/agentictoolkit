"use client"

import type { ReactNode } from "react"
import { Check, Plus, Trash2, X } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../components/button"

/**
 * Actions for the editing button bar. The consumer owns the draft + dirty/valid
 * state and computes the can* flags; the bar just renders them.
 */
export interface ButtonBarActions {
  onCreate: () => void
  createLabel?: string
  onCancel: () => void
  canCancel: boolean
  onSave: () => void
  canSave: boolean
  saving?: boolean
  /** Optional: omit (with `showDelete={false}`) for panes that don't delete here. */
  onDelete?: () => void
  canDelete?: boolean
}

/** The Cancel + Save pair — borderless "[icon] title"; Save goes gold when enabled. */
function SaveCancelButtons({
  canCancel,
  canSave,
  saving = false,
  onCancel,
  onSave,
}: {
  canCancel: boolean
  canSave: boolean
  saving?: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={!canCancel || saving}>
        <X data-icon="inline-start" />
        Cancel
      </Button>
      <Button
        variant={canSave ? "default" : "ghost"}
        size="sm"
        onClick={onSave}
        disabled={!canSave || saving}
        className={canSave ? undefined : "text-apt-text-muted"}
      >
        <Check data-icon="inline-start" />
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  )
}

/**
 * The recessed editing action bar — New │ Delete … Cancel Save. A darker strip
 * with top + bottom borders, set off from the panel behind. Built entirely from
 * the shared <Button>.
 */
export function ButtonBar({
  actions,
  showCreate = true,
  showDelete = true,
  leading,
  children,
  ariaLabel = "Editing actions",
  className,
}: {
  /** The editing-action preset (New / Delete / Cancel / Save). */
  actions?: ButtonBarActions
  /** Hide the leading "New …" button (e.g. single-record panes). */
  showCreate?: boolean
  /** Hide the Delete button (e.g. panes where delete lives elsewhere). */
  showDelete?: boolean
  /** Leading content before the preset/children (e.g. a section title). */
  leading?: ReactNode
  /**
   * Arbitrary toolbar content (e.g. a list toolbar's filter + selection actions).
   * Takes precedence over `actions`; both render inside the same recessed strip so
   * every button bar on the platform looks identical.
   */
  children?: ReactNode
  ariaLabel?: string
  className?: string
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 border-y border-apt-border bg-apt-bg px-6 py-2",
        className,
      )}
    >
      {leading}
      {children ??
        (actions ? (
          <EditingActions actions={actions} showCreate={showCreate} showDelete={showDelete} />
        ) : null)}
    </div>
  )
}

/** The default editing preset: New │ Delete … Cancel Save. */
function EditingActions({
  actions,
  showCreate,
  showDelete,
}: {
  actions: ButtonBarActions
  showCreate: boolean
  showDelete: boolean
}) {
  const {
    onCreate,
    createLabel = "New",
    onCancel,
    canCancel,
    onSave,
    canSave,
    saving = false,
    onDelete,
    canDelete,
  } = actions
  return (
    <>
      {showCreate && (
        <>
          <Button variant="ghost" size="sm" onClick={onCreate}>
            <Plus data-icon="inline-start" />
            {createLabel}
          </Button>
          <div className="mx-1 h-5 w-px bg-apt-border" aria-hidden />
        </>
      )}
      {showDelete && onDelete && (
        <Button
          variant="destructive-ghost"
          size="sm"
          onClick={onDelete}
          disabled={!canDelete}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      )}
      <div className="flex-1" />
      <SaveCancelButtons
        canCancel={canCancel}
        canSave={canSave}
        saving={saving}
        onCancel={onCancel}
        onSave={onSave}
      />
    </>
  )
}
