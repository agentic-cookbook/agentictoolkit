"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "./button"
import { cn } from "../lib/utils"

export interface DialogActionsProps {
  cancelLabel?: string
  onCancel?: () => void
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  destructive?: boolean
  busy?: boolean
  /**
   * Disables the confirm button while NOT busy (e.g. the form is unedited or invalid).
   * `busy` already hides both buttons behind a spinner, so this has no effect then.
   * Defaults to `false` (backward-compatible — every existing caller keeps confirm
   * always-enabled-when-idle).
   */
  confirmDisabled?: boolean
  /** Which button gets initial focus when the dialog opens. Defaults to "confirm"; set to "cancel"
   *  for destructive. A PREFERENCE, not a guarantee: if that button is disabled or absent, focus
   *  goes to the other one rather than nowhere (see the focus effect). */
  initialFocus?: "confirm" | "cancel"
  /**
   * When false, DialogActions does NOT auto-focus any button on mount — the host
   * dialog is responsible for setting focus (e.g. a form dialog focusing its first
   * input). Defaults to `true` (backward-compatible).
   */
  focusOnMount?: boolean
  /**
   * Button-row layout. "auto" (default) resolves equal-width vs natural-right-
   * justify per alert-and-dialog §Layout; "equal" / "natural" force it. The
   * invitation modal forces "equal" per its design spec.
   */
  layout?: "auto" | "equal" | "natural"
}

/**
 * Two-button action footer.
 *
 * - "auto" hands the equal-vs-natural rule to the layout engine: each button is
 *   `flex-1 max-w-max`, so it grows into its share of the row but never past its
 *   natural width, in a `justify-end` row. A row with space for both buttons
 *   therefore settles at natural widths, right-justified; a row without it splits
 *   the width evenly. That is alert-and-dialog §Layout, minus the truncation the
 *   old rule caused in between — when only ONE button outgrows its half, only that
 *   button takes the extra space instead of both snapping to equal.
 * - "equal" / "natural" force one branch.
 * - Handles initial focus.
 *
 * The rule is deliberately NOT measured in JS. It used to be: the row rendered
 * "equal", then a layout effect displaced each button to `position: fixed;
 * left: -9999px` to read its natural width and flipped the row via `setMeasured`.
 * Two defects fell out of that. Reading `getBoundingClientRect()` mid-effect forced
 * a reflow, which gave each button a resolved "before" width and so armed
 * `Button`'s `transition-all` — turning the flip into a ~150ms slide that starts
 * AFTER the dialog is visible and clickable (measured in Chromium: Cancel
 * travelling 268px right while shrinking 198px → 64px). And the row sat at that
 * wrong first position for several frames before the slide began — long enough to
 * read as settled, so a click aimed there, by a person or by a test's actionability
 * check, lands on empty dialog surface and the dialog simply does not respond.
 * Resolving the rule in CSS makes the first painted frame the final one, leaving no
 * window to click into.
 */
// The focus ring for a cancel button that is focused BY US on mount.
//
// Button's ring is `--ring`, which the theme layer aliases to `--color-primary` —
// the accent. That is right for a ring the user asked for by tabbing, and wrong for
// this one: `initialFocus="cancel"` paints it the instant the dialog appears, before
// the user has chosen anything, so the accent lands on the button that does nothing.
// In three of the 39 themes the accent IS a red — `gruvbox` #af3a03, `monokai`
// #f92672, `terminal-split` #a8362a — and a destructive dialog is the only kind that
// focuses cancel, so on those themes the safe button comes up wearing the same alarm
// colour as the button beside it that destroys work. That inverts the one signal the
// pair exists to carry.
//
// `--apt-text` (the on-surface foreground) is the answer because of what it is, not
// how it looks: it is the token guaranteed to contrast with the surface the dialog
// paints, in every theme, and it is a colour no theme uses to mean danger. Verified
// across all 39: none resolves it to a red.
const QUIET_FOCUS_RING = "focus-visible:border-apt-text focus-visible:ring-apt-text/40"

export function DialogActions({
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  confirmVariant,
  destructive = false,
  busy = false,
  confirmDisabled = false,
  initialFocus = destructive ? "cancel" : "confirm",
  focusOnMount = true,
  layout = "auto",
}: DialogActionsProps): React.ReactElement {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  // Initial focus on mount — skipped when focusOnMount={false} (form dialogs that
  // focus their first input instead).
  //
  // Falls back to the OTHER button when the preferred one is disabled. `focus()` on a disabled
  // button is a silent no-op, which used to leave focus on `<body>`: no focus trap, Tab walking
  // the page behind the dialog, Escape possibly never reaching the handler. That combination is
  // now the NORMAL one — `initialFocus` defaults to "confirm" and dirty-gating means Save starts
  // disabled — so the dialog must always land focus somewhere inside itself.
  //
  // `disabled` is read off the DOM rather than from the `confirmDisabled` prop so the effect keeps
  // its mount-only deps: re-running it when the gate later flips would yank focus out from under
  // whatever the user is typing in.
  React.useEffect(() => {
    if (!focusOnMount) return
    const preferred = initialFocus === "cancel" ? cancelRef.current : confirmRef.current
    const other = initialFocus === "cancel" ? confirmRef.current : cancelRef.current
    const target = preferred && !preferred.disabled ? preferred : other
    // Both gone or both disabled: leave focus alone rather than pretending. The host dialog's own
    // focus management (base-ui's Popup) is the remaining line of defence.
    if (target && !target.disabled) target.focus()
  }, [focusOnMount, initialFocus])

  if (busy) {
    return (
      <div data-slot="dialog-actions" className="flex items-center justify-end gap-3">
        <Loader2
          className="size-4 animate-spin text-apt-text-muted"
          role="status"
          aria-label="Working…"
        />
      </div>
    )
  }

  // `max-w-max` is the whole "auto" rule: it caps a flex-1 button at its natural
  // width, so the row right-justifies itself once there is room for both. Forced
  // "equal" grows uncapped; forced "natural" does not grow at all; and a lone
  // confirm is never stretched to fill the row.
  const grow =
    layout === "auto" ? "flex-1 max-w-max"
    : layout === "equal" && cancelLabel != null ? "flex-1"
    : undefined

  return (
    <div
      data-slot="dialog-actions"
      className={cn(
        "flex items-center gap-3",
        layout !== "natural" && "w-full",
        layout !== "equal" && "justify-end",
      )}
    >
      {cancelLabel != null && (
        <Button
          ref={cancelRef}
          variant="outline"
          size="sm"
          onClick={onCancel}
          className={cn(initialFocus === "cancel" && QUIET_FOCUS_RING, grow)}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        ref={confirmRef}
        size="sm"
        variant={destructive ? "destructive" : (confirmVariant ?? "default")}
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={grow}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}
