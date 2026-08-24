"use client"

import * as React from "react"

/**
 * The last non-null value this was called with — the one thing a closing modal still needs.
 *
 * A dialog driven by `{ open, subject }` has a target while it is open and none the moment
 * the host clears it, and `if (!subject) return null` unmounts the whole thing on that same
 * tick. The `open → false` transition the Dialog would have animated never gets a chance to
 * run: the modal pops out of existence instead of fading, which reads as a glitch beside a
 * sibling dialog that fades.
 *
 * Holding the previous value costs one render's worth of stale data, and that is exactly the
 * data the exit animation is meant to be showing: the subject the user was just looking at,
 * on its way out. The host still controls `open`, so nothing here keeps a dialog alive — it
 * only keeps it LEGIBLE while it closes.
 */
export function useLastPresent<T>(value: T | null): T | null {
  const last = React.useRef<T | null>(value)
  if (value !== null) last.current = value
  return value ?? last.current
}
