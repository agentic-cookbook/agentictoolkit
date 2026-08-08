"use client"

import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "./button"

// The reorder control — an ↑/↓ pair that moves ONE row within the list it is
// already in. Like InlineCommitControl (whose trailing-cell grammar it shares),
// the consumer owns every piece of state: where the row sits, what "up" means,
// and whether a move is in flight. This renders it.
//
// Two deliberate departures from the sibling control, both about discoverability:
//
//  - **Always visible, never hover-revealed.** The trash hides until the row is
//    hovered because everyone already knows rows can be deleted and the reveal
//    keeps a destructive action out of reach of a blind tap. Reordering is the
//    opposite on both counts — it is cheap and undoable, and a list that can be
//    reordered looks exactly like one that cannot, so a hidden control is a
//    feature nobody finds.
//  - **Disabled at the ends, not absent.** The first row's ↑ stays rendered and
//    disabled: the button's presence is what says "this list has an order", and
//    a control that vanishes on the boundary rows makes the column ragged and
//    shifts the ↓ under the pointer mid-list.
//
// The arrows are ARROWS, not chevrons, because a chevron in these packages means
// disclosure (see TreeRowLabel, which can be in the very same cell) — the two
// metaphors have to stay apart or an expandable, reorderable row grows three
// chevrons that mean two different things.

export interface ReorderControlProps {
  /** Move the row one place toward the start of its list. */
  onMoveUp: () => void
  /** Move the row one place toward the end of its list. */
  onMoveDown: () => void
  /** False on the first row — ↑ renders disabled rather than disappearing. */
  canMoveUp: boolean
  /** False on the last row. */
  canMoveDown: boolean
  /**
   * A move for this row is in flight: the pair dims and ignores clicks. Kept
   * `aria-disabled` rather than `disabled` so a keyboard user does not lose
   * their place mid-request (same reasoning as InlineCommitControl's busy).
   */
  busy?: boolean
  /** Accessible subject appended to the button labels, e.g. `"work item Ship it"`. */
  subject?: string
  className?: string
}

export function ReorderControl({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  busy = false,
  subject,
  className,
}: ReorderControlProps): React.ReactElement {
  const of = subject ? ` ${subject}` : ""

  return (
    <span
      role="group"
      aria-label={`Reorder${of}`}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex items-center gap-0.5",
        busy && "opacity-60",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move up${of}`}
        title={`Move up${of}`}
        disabled={!canMoveUp}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onMoveUp()
        }}
        className="text-apt-text-muted"
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move down${of}`}
        title={`Move down${of}`}
        disabled={!canMoveDown}
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onMoveDown()
        }}
        className="text-apt-text-muted"
      >
        <ArrowDown aria-hidden />
      </Button>
    </span>
  )
}
