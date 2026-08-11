"use client"

import * as React from "react"
import { Info, CheckCircle2, TriangleAlert, type LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"

import { Button } from "./button"
import { cn } from "../lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog"
import { DialogActions } from "./dialog-actions"
import type { DialogRoot } from "@base-ui/react/dialog"

export type AlertModalTone = "info" | "success" | "error"

type KeyAction = "confirm" | "cancel"

// Tone → leading glyph + accent. Add a tone here (not at the call site) so every
// alert/confirm across the platform stays visually consistent.
const TONES: Record<AlertModalTone, { Icon: LucideIcon; className: string }> = {
  info: { Icon: Info, className: "text-apt-blue" },
  success: { Icon: CheckCircle2, className: "text-apt-green" },
  error: { Icon: TriangleAlert, className: "text-apt-red" },
}

export interface AlertModalProps {
  /** Controlled visibility — the parent owns the open state and runs the action. */
  open: boolean
  /** Heading line. */
  title: string
  /** Body copy. */
  description?: React.ReactNode
  /** Visual tone — sets the leading icon + accent. Default `"info"`. */
  tone?: AlertModalTone
  /** Primary (acknowledge / confirm) button label. Default `"OK"`. */
  confirmLabel?: string
  /** Visual variant of the primary button — e.g. `"destructive"` for a delete
   *  confirm. Defaults to the Button's `"default"` (primary). */
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  /** Primary action. Also fired when the modal is dismissed (backdrop / Esc / ✕)
   *  in ALERT mode — dismissing a plain alert acknowledges it. */
  onConfirm: () => void
  /** When provided, a secondary button is rendered and the modal becomes a
   *  CONFIRM dialog (two choices) rather than a single-button alert. */
  cancelLabel?: string
  /** Cancel action. Also fired when the modal is dismissed (backdrop / Esc / ✕)
   *  in CONFIRM mode — dismissing a confirm cancels it. */
  onCancel?: () => void
  /** In-progress: replace the action buttons with a spinner and make the modal
   *  non-dismissable (no backdrop/Esc/✕ close) until the parent flips it. */
  busy?: boolean
  /**
   * Whether backdrop / Escape / ✕ may close the modal. Default `true`.
   *
   * Set `false` for a single-button alert whose confirm PERFORMS something
   * (writes, deletes, navigates away). In alert mode every dismissal gesture
   * routes to `onConfirm` — pressing Escape to make a dialog go away would run
   * the action, which is the opposite of what the gesture means. `false` makes
   * the button the only way through: no ✕, and every close reason is ignored.
   */
  dismissible?: boolean
  /** Keyboard shortcut policy.
   *  - `"default"`: Enter → confirm; Escape → cancel (confirm mode) or confirm (alert mode).
   *  - `"none"`: no keyboard shortcuts (Escape and Enter both ignored).
   *  - Explicit map: key string → `"confirm"` | `"cancel"`.
   *  Default: `"default"`.
   */
  keyboard?: "default" | "none" | Partial<Record<string, KeyAction>>
  /** Destructive action: renders the action button red and forces keyboard `"none"`. */
  destructive?: boolean
  /** Optional className forwarded to DialogContent for width/size overrides. */
  contentClassName?: string
  /** Whether to show the tone icon in the title. Default `true`. */
  showIcon?: boolean
}

/**
 * Generalized, centered modal alert/confirm. Themed from `apt-*` tokens and built
 * on the shared {@link Dialog} primitive, so it dims + blurs the background exactly
 * like every other modal on the platform (consistency). Renders one primary button
 * (alert mode), or a primary + secondary pair (confirm mode) when `cancelLabel` is
 * set. Controlled via `open`.
 *
 * ## Keyboard / dismiss contract
 *
 * | mode               | Enter        | Escape                    | pointer (backdrop/✕) |
 * |--------------------|--------------|---------------------------|----------------------|
 * | default + confirm  | onConfirm ×1 | onCancel ×1               | onCancel ×1          |
 * | default + alert    | onConfirm ×1 | onConfirm ×1              | onConfirm ×1         |
 * | keyboard="none"    | —            | —                         | onCancel/onConfirm×1 |
 * | destructive        | —            | —                         | onCancel/onConfirm×1 |
 * | busy (any)         | —            | —                         | —                    |
 * | dismissible=false  | onConfirm ×1 | —                         | — (no ✕)             |
 *
 * Escape is owned entirely by Base-UI's `onOpenChange` (reason `"escape-key"`).
 * The window keydown listener handles Enter only, so there is no double-fire path.
 * Pointer dismissal (backdrop / ✕ button) always routes to cancel/confirm when not busy,
 * regardless of the keyboard policy.
 */
export function AlertModal({
  open,
  title,
  description,
  tone = "info",
  confirmLabel = "OK",
  confirmVariant,
  onConfirm,
  cancelLabel,
  onCancel,
  busy = false,
  dismissible = true,
  keyboard = "default",
  destructive = false,
  contentClassName,
  showIcon = true,
}: AlertModalProps): React.ReactElement {
  const isConfirm = cancelLabel != null
  const { Icon, className } = TONES[destructive ? "error" : tone]

  // Whether keyboard shortcuts are active. Destructive forces them off.
  const keyboardEnabled = !destructive && keyboard !== "none"

  // The window keydown listener handles Enter only. Escape is routed via
  // Base-UI's onOpenChange (reason "escape-key") to avoid double-firing.
  const keyMap: Partial<Record<string, KeyAction>> = React.useMemo(() => {
    if (!keyboardEnabled) return {}
    if (keyboard === "default") return { Enter: "confirm" }
    // Custom map: caller may include Escape, but Base-UI will still fire
    // onOpenChange for it — honour the caller-supplied mapping there too.
    return keyboard
  }, [keyboardEnabled, keyboard])

  React.useEffect(() => {
    if (!open || busy) return
    function onKey(e: KeyboardEvent): void {
      const action = keyMap[e.key]
      if (!action) return
      e.preventDefault()
      if (action === "confirm") onConfirm()
      else onCancel?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, busy, keyMap, onConfirm, onCancel])

  /**
   * Base-UI calls this whenever the dialog wants to close. Because `open` is
   * controlled by the parent, doing nothing here leaves the dialog open.
   *
   * Routing rules:
   * - busy: always block.
   * - dismissible=false: always block. In alert mode a dismissal RUNS the
   *   action, so an alert whose confirm performs something opts out entirely
   *   rather than letting Escape perform it.
   * - reason "escape-key":
   *     keyboard disabled (none/destructive) → block (Escape must not act).
   *     keyboard enabled + confirm mode → onCancel.
   *     keyboard enabled + alert mode  → onConfirm.
   * - all other reasons (outside-press, close-press, …) → pointer dismissal,
   *     always route cancel/confirm regardless of keyboard policy.
   */
  function handleOpenChange(
    next: boolean,
    eventDetails: DialogRoot.ChangeEventDetails,
  ): void {
    if (next || busy || !dismissible) return

    if (eventDetails.reason === "escape-key") {
      if (!keyboardEnabled) return // none / destructive — block
      if (isConfirm) onCancel?.()
      else onConfirm()
      return
    }

    // Pointer / ✕ / programmatic close.
    if (isConfirm) onCancel?.()
    else onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={contentClassName} showClose={!busy && dismissible}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-apt-gold">
            {showIcon && <Icon className={cn("size-5 shrink-0", className)} aria-hidden />}
            {title}
          </DialogTitle>
          {description != null && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {isConfirm ? (
          <DialogActions
            cancelLabel={cancelLabel}
            onCancel={onCancel}
            confirmLabel={confirmLabel}
            onConfirm={onConfirm}
            confirmVariant={confirmVariant}
            destructive={destructive}
            busy={busy}
            initialFocus={destructive ? "cancel" : "confirm"}
          />
        ) : (
          <DialogFooter>
            {busy ? (
              <Loader2
                className="size-4 animate-spin text-apt-text-muted"
                role="status"
                aria-label="Working…"
              />
            ) : (
              <Button
                size="sm"
                variant={destructive ? "destructive" : (confirmVariant ?? "default")}
                onClick={onConfirm}
                className="w-full"
              >
                {confirmLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
