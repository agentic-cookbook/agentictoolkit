"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "./button"
import { cn } from "../lib/utils"

/**
 * Pure helper — determines whether two-button layout is equal-width or natural.
 * Exported for unit testing without needing layout.
 */
export function decideActionLayout(
  containerWidth: number,
  maxButtonWidth: number,
): "equal" | "natural" {
  if (maxButtonWidth <= 0) return "equal"
  return containerWidth > 2 * maxButtonWidth ? "natural" : "equal"
}

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
   * Button-row layout. "auto" (default) measures equal-width vs natural-right-
   * justify per alert-and-dialog §4; "equal" / "natural" force it. The invitation
   * modal forces "equal" per its design spec.
   */
  layout?: "auto" | "equal" | "natural"
}

/**
 * Two-button action footer with measured layout.
 *
 * - Measures natural button widths and container width after render.
 * - If containerWidth > 2 × maxButtonWidth → natural width + right-justify.
 * - Otherwise → equal-width (flex-1 each).
 * - Handles initial focus and ResizeObserver re-measurement.
 */
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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const [measured, setMeasured] = React.useState<"equal" | "natural">("equal")
  const effectiveLayout = layout === "auto" ? measured : layout

  // Measure and set layout after render, and on resize — only in "auto" mode.
  React.useLayoutEffect(() => {
    if (busy || layout !== "auto") return
    function measure() {
      const container = containerRef.current
      const cancelBtn = cancelRef.current
      const confirmBtn = confirmRef.current
      if (!container) return
      // Read intrinsic (natural) button width without flex constraints.
      // flex-1 expands buttons beyond their content size; we need the
      // content-driven min-width. Setting position:fixed + width:auto removes
      // the element from flex flow so the browser reports its natural size.
      function intrinsicWidth(el: HTMLButtonElement | null): number {
        if (!el) return 0
        const s = el.style
        const prevPos = s.position
        const prevWidth = s.width
        const prevLeft = s.left
        s.position = "fixed"
        s.width = "auto"
        s.left = "-9999px"
        // Force a style recalculation so getBoundingClientRect sees the new styles.
        const w = el.getBoundingClientRect().width
        s.position = prevPos
        s.width = prevWidth
        s.left = prevLeft
        return w
      }
      const cancelW = intrinsicWidth(cancelBtn)
      const confirmW = intrinsicWidth(confirmBtn)
      const maxBtnW = Math.max(cancelW, confirmW)
      setMeasured(decideActionLayout(container.offsetWidth, maxBtnW))
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [busy, cancelLabel, confirmLabel, layout])

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
      <div
        ref={containerRef}
        data-slot="dialog-actions"
        className="flex items-center justify-end gap-3"
      >
        <Loader2
          className="size-4 animate-spin text-apt-text-muted"
          role="status"
          aria-label="Working…"
        />
      </div>
    )
  }

  const isNatural = effectiveLayout === "natural"

  return (
    <div
      ref={containerRef}
      data-slot="dialog-actions"
      className={cn(
        "flex items-center gap-3",
        isNatural ? "justify-end" : "w-full",
      )}
    >
      {cancelLabel != null && (
        <Button
          ref={cancelRef}
          variant="outline"
          size="sm"
          onClick={onCancel}
          className={!isNatural ? "flex-1" : undefined}
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
        className={!isNatural && cancelLabel != null ? "flex-1" : undefined}
      >
        {confirmLabel}
      </Button>
    </div>
  )
}
