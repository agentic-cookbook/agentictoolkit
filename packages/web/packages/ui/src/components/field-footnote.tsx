import type { ReactElement, ReactNode } from "react"

import { cn } from "../lib/utils"

/**
 * The line under a form control: its `error` if there is one, otherwise its `hint`.
 *
 * Error and hint are the same slot, not two — a control shows at most one of them,
 * and the error takes it. That precedence is the knowledge this component owns; the
 * two treatments only have to match each other's metrics because they trade places
 * in the same position under the same input.
 *
 * It stands on its own rather than living inside {@link Field} because the one
 * control that CANNOT use `Field` still has to report its problem in the same place
 * and the same words: a checkbox reads as "[box] label" rather than as a caption
 * above a control, so it builds its own row (see `@agentic-toolkit/editing`'s bound
 * controls) — and a second copy of these two spans is how one of them ends up
 * missing a fix made to the other.
 *
 * Deliberately NOT `ErrorText`, which is the platform's inline error everywhere else:
 * `ErrorText` is `text-sm`, and a `text-sm` error swapping in for a `font-mono
 * text-[0.7rem]` hint moves the layout on the keystroke that makes the value invalid.
 * Here the hint's metrics win and the error is its red twin — the refutation is
 * recorded in docs/ui/fleet-ui-audit.md (Tier 6). One consequence of that choice is
 * that this line carries no `role="alert"`, which `ErrorText` does.
 */
export function FieldFootnote({
  hint,
  error,
  errorId,
  className,
}: {
  hint?: ReactNode
  /** Shown in place of `hint` when set. */
  error?: ReactNode
  /** Names the ERROR line so a control can point `aria-describedby` at it.
   *
   *  Only the error, never the hint: a hint that belongs to a control belongs in the
   *  control's own accessible name, which `Field` already gets by rendering both inside
   *  one `Label`. The error is the half that appears and disappears while the control is
   *  focused, and a screen reader announces a change it is described by — this line
   *  carries no `role="alert"` (see above), so `aria-describedby` is how it is heard at
   *  all. Absent means nothing points at it and the id would be dead weight. */
  errorId?: string
  className?: string
}): ReactElement | null {
  if (error) {
    return (
      <span id={errorId} className={cn("font-mono text-[0.7rem] text-apt-red", className)}>
        {error}
      </span>
    )
  }
  return hint ? (
    <span className={cn("font-mono text-[0.7rem] text-apt-text-dim", className)}>{hint}</span>
  ) : null
}
