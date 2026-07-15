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
// set (see hooks/useInlineDrafts for the state mechanics) — the control just
// renders it, mirroring ButtonBar's contract.

/** Consumer applies this to the editable content while its delete is armed. */
export const inlineCommitDeletingClass = "opacity-50 line-through"

/**
 * Hover scope that reveals the idle trash button. DataTable rows carry it
 * already (data-table imports this constant); any other container (list row,
 * card) opts in by adding this class to the element whose hover should reveal
 * the delete affordance.
 */
export const inlineCommitHoverScopeClass = "group/icc"

export interface InlineCommitControlProps {
  /** The attached data has uncommitted edits — show the ✓/✕ pair. */
  dirty: boolean
  /** A delete is armed and awaiting ✓ — shows ✓ ✕ [red trash]. */
  deleting?: boolean
  /** Offer the hover trash when clean. Requires `onDelete`. */
  deletable?: boolean
  /** Commit in flight — swap ✓ for a spinner; the pair ignores clicks but
   *  keeps focus (aria-disabled, not disabled, so keyboard focus survives). */
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

  const commitRef = React.useRef<HTMLButtonElement>(null)
  const trashRef = React.useRef<HTMLButtonElement>(null)
  // Focus lived inside the pending group (so a collapse should re-anchor it).
  const hadFocusRef = React.useRef(false)
  const prevRef = React.useRef({ pending, deleting })

  // Keyboard focus must survive the control's state transitions: arming
  // replaces the trash with the pending group (focus the ✓ so confirming is
  // one keypress), and committing/cancelling unmounts the group (re-anchor on
  // the idle trash — focus-visible reveals it for keyboard users, the hovered
  // row reveals it for mouse users).
  React.useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { pending, deleting }
    if (deleting && !prev.deleting) commitRef.current?.focus()
    else if (prev.pending && !pending && hadFocusRef.current) trashRef.current?.focus()
    if (!pending) hadFocusRef.current = false
  }, [pending, deleting])

  if (!pending) {
    if (!deletable || !onDelete) return null
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        ref={trashRef}
        aria-label={`Delete${of}`}
        title={`Delete${of}`}
        onClick={onDelete}
        className={cn(
          // pointer-events gate with the reveal: while invisible the button is
          // not hit-testable, so a blind tap (touch has no hover) can't arm a
          // delete. Touch users reach it by tapping the row first (the tap
          // sets the row's hover state), keyboard users by Tab (focus-visible).
          "text-apt-text-muted opacity-0 transition-opacity pointer-events-none",
          "group-hover/icc:opacity-100 group-hover/icc:pointer-events-auto",
          "focus-visible:opacity-100 focus-visible:pointer-events-auto",
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
      aria-busy={busy || undefined}
      className={cn("inline-flex items-center gap-0.5", className)}
      onFocus={() => {
        hadFocusRef.current = true
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        ref={commitRef}
        aria-label={deleting ? `Confirm delete${of}` : `Save changes${of}`}
        title={deleting ? `Confirm delete${of}` : `Save changes${of}`}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onCommit()
        }}
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
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onCancel()
        }}
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
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onDelete()
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </span>
  )
}

export type InlineEditableTextVariant = "default" | "mono" | "muted"

export interface InlineEditableTextProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "aria-label"> {
  value: string
  onChange: (value: string) => void
  /** Enter — commit the row (same action as the control's ✓). */
  onCommitEdit?: () => void
  /** Escape — discard the row's edits (same action as the control's ✕). */
  onCancelEdit?: () => void
  /** Typography variant: `mono` for keys/identifiers, `muted` for secondary
   *  text — the two treatments every consumer was overriding by hand. */
  variant?: InlineEditableTextVariant
  /** Size the control to its VALUE rather than the input's fixed default width. Opt-in,
   *  and only needed inside a content-sized container — notably a DataTable column under
   *  `autoSizeColumns`, which measures each cell's natural width. An `<input>` has an
   *  intrinsic ~20-character default and this one is `w-full`, and a percentage width
   *  against an INDEFINITE (max-content) track resolves to auto — so such a column would
   *  size to that default and clip longer values, no matter what they say. A hidden ghost
   *  carrying the same text and metrics supplies the width instead; the input stretches
   *  over it. Default false: the plain full-width input, unchanged. */
  autoSize?: boolean
  /** Accessible name; the shell is invisible until hover/focus, so this is required. */
  "aria-label": string
}

/**
 * Click-to-edit text for list/table rows: the shared Input with its field
 * shell suppressed until hover/focus, so committed data reads as plain text
 * and becomes editable in place with a click. Editing fires `onChange`; the
 * consumer derives dirtiness (draft ≠ committed) and shows the
 * InlineCommitControl. Enter/Escape route to the same commit/cancel actions —
 * a consumer-supplied `onKeyDown` runs FIRST and may preventDefault() to
 * suppress that routing.
 */
export function InlineEditableText({
  value,
  onChange,
  onCommitEdit,
  onCancelEdit,
  variant = "default",
  autoSize = false,
  onKeyDown,
  className,
  ...props
}: InlineEditableTextProps): React.ReactElement {
  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === "Enter") onCommitEdit?.()
        else if (e.key === "Escape") onCancelEdit?.()
      }}
      className={cn(
        "h-7 border-transparent bg-transparent px-2 py-1",
        "hover:border-apt-border",
        variant === "mono" && "font-mono",
        variant === "muted" && "text-apt-text-muted",
        autoSize && "col-start-1 row-start-1",
        className,
      )}
      {...props}
    />
  )
  if (!autoSize) return input

  // The ghost and the input share ONE grid cell, so the ghost's max-content width becomes
  // the wrapper's — and the `w-full` input then fills it. The ghost must therefore mirror
  // every metric that decides the input's ideal width: font family/size, horizontal
  // padding, and border. `whitespace-pre` keeps it on one line (and preserves the spaces
  // of a value being typed); the placeholder stands in for an empty value so a blank field
  // is still clickable. It is a measuring device, never content — hence aria-hidden.
  return (
    <span className="grid min-w-0 items-center">
      <span
        aria-hidden
        className={cn(
          "invisible col-start-1 row-start-1 h-7 whitespace-pre border border-transparent px-2 py-1 text-sm",
          variant === "mono" && "font-mono",
        )}
      >
        {value || props.placeholder || ""}
      </span>
      {input}
    </span>
  )
}
