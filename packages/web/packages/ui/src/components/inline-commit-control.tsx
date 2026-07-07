"use client"

import * as React from "react"
import { Check, Loader2, Trash2, X } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { Input } from "./input"

// The inline commit control — a right-justified ✓/✕ pair that appears next to
// (or inside) an editable element the moment its data goes dirty, and stays
// until the edit is saved (✓) or discarded (✕). When the data is clean and
// deletable, hovering the enclosing row reveals a trash button; clicking it
// ARMS a pending delete (the consumer dims + strikes the content with
// `inlineCommitDeletingClass`) which the same ✓ then commits and ✕ disarms.
// The consumer owns all state — draft values, dirty computation, the armed
// set — the control just renders it, mirroring ButtonBar's contract.

/** Consumer applies this to the editable content while its delete is armed. */
export const inlineCommitDeletingClass = "opacity-50 line-through"

/**
 * Hover scope that reveals the idle trash button. DataTable rows carry it
 * already; any other container (list row, card) opts in by adding this class
 * to the element whose hover should reveal the delete affordance.
 */
export const inlineCommitHoverScopeClass = "group/icc"

export interface InlineCommitControlProps {
  /** The attached data has uncommitted edits — show the ✓/✕ pair. */
  dirty: boolean
  /** A delete is armed and awaiting ✓ — shows ✓ ✕ [red trash]. */
  deleting?: boolean
  /** Offer the hover trash when clean. Requires `onDelete`. */
  deletable?: boolean
  /** Commit in flight — swap ✓ for a spinner and disable the pair. */
  busy?: boolean
  /** Save the pending edits — or, when `deleting`, commit the delete. */
  onCommit: () => void
  /** Discard the pending edits — or, when `deleting`, disarm the delete. */
  onCancel: () => void
  /** Arm the pending delete (idle trash click); disarm it (armed trash click). */
  onDelete?: () => void
  /** Accessible subject appended to button labels, e.g. `"flag beta"`. */
  subject?: string
  className?: string
}

export function InlineCommitControl({
  dirty,
  deleting = false,
  deletable = false,
  busy = false,
  onCommit,
  onCancel,
  onDelete,
  subject,
  className,
}: InlineCommitControlProps): React.ReactElement | null {
  const of = subject ? ` ${subject}` : ""
  const pending = dirty || deleting

  if (!pending) {
    if (!deletable || !onDelete) return null
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete${of}`}
        title={`Delete${of}`}
        onClick={onDelete}
        className={cn(
          "text-apt-text-muted opacity-0 transition-opacity",
          "group-hover/icc:opacity-100 focus-visible:opacity-100",
          className,
        )}
      >
        <Trash2 aria-hidden />
      </Button>
    )
  }

  return (
    <span
      role="group"
      aria-label={deleting ? `Confirm deleting${of}` : `Commit changes${of}`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={deleting ? `Confirm delete${of}` : `Save changes${of}`}
        title={deleting ? `Confirm delete${of}` : `Save changes${of}`}
        onClick={onCommit}
        disabled={busy}
        className="text-apt-gold hover:text-apt-gold"
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={deleting ? `Cancel delete${of}` : `Discard changes${of}`}
        title={deleting ? `Cancel delete${of}` : `Discard changes${of}`}
        onClick={onCancel}
        disabled={busy}
        className="text-apt-text-muted"
      >
        <X aria-hidden />
      </Button>
      {deleting && onDelete && (
        <Button
          type="button"
          variant="destructive-ghost"
          size="icon-sm"
          aria-label={`Delete armed${of} — click to keep`}
          title={`Delete armed${of} — click to keep`}
          aria-pressed
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </span>
  )
}

export interface InlineEditableTextProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "aria-label"> {
  value: string
  onChange: (value: string) => void
  /** Enter — commit the row (same action as the control's ✓). */
  onCommitEdit?: () => void
  /** Escape — discard the row's edits (same action as the control's ✕). */
  onCancelEdit?: () => void
  /** Accessible name; the shell is invisible until hover/focus, so this is required. */
  "aria-label": string
}

/**
 * Click-to-edit text for list/table rows: the shared Input with its field
 * shell suppressed until hover/focus, so committed data reads as plain text
 * and becomes editable in place with a click. Editing fires `onChange`; the
 * consumer derives dirtiness (draft ≠ committed) and shows the
 * InlineCommitControl. Enter/Escape route to the same commit/cancel actions.
 */
export function InlineEditableText({
  value,
  onChange,
  onCommitEdit,
  onCancelEdit,
  className,
  ...props
}: InlineEditableTextProps): React.ReactElement {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommitEdit?.()
        else if (e.key === "Escape") onCancelEdit?.()
      }}
      className={cn(
        "h-7 border-transparent bg-transparent px-2 py-1",
        "hover:border-apt-border",
        className,
      )}
      {...props}
    />
  )
}
