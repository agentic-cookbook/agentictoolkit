"use client"

import * as React from "react"

import { Button } from "../components/button"

/**
 * BATCH SELECT: the mode a list enters when the user wants to act on several rows at once, and
 * the button that enters and leaves it.
 *
 * A list is single-select by default because that is what a details pane wants — one row, one
 * pane. Multi-select is a different intent, and the toggle is what lets the user declare it
 * rather than having the list guess from a modifier key nobody discovers.
 *
 * WHY THIS IS SHARED, when it is barely more than a `useState` pair: LEAVING the mode must clear
 * the selection. Hiding the checkboxes while keeping the ids leaves an invisible selection, and
 * the next bulk action — a Delete, a Transfer — operates on rows the user can no longer see and
 * has every reason to believe they deselected. Every surface that re-derives this locally is a
 * surface that can forget that line.
 */
export interface BatchSelect {
  /** True while the checkboxes are showing. */
  active: boolean
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  /** Enter batch mode, or leave it — leaving always clears. */
  toggleActive: () => void
  /** Drop the selection, stay in batch mode. */
  clear: () => void
  count: number
}

export function useBatchSelect(): BatchSelect {
  const [active, setActive] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set())

  const clear = React.useCallback(() => setSelectedIds(new Set()), [])
  const toggleActive = React.useCallback(() => {
    setActive((wasActive) => {
      // Clear on the way OUT and on the way IN. Out, so a hidden selection cannot survive; in,
      // so a fresh batch never inherits whatever the single-select interaction left behind.
      setSelectedIds(new Set())
      return !wasActive
    })
  }, [])

  return { active, selectedIds, setSelectedIds, toggleActive, clear, count: selectedIds.size }
}

export interface BatchSelectButtonProps {
  batch: BatchSelect
  /** Default `"Select"`. */
  selectLabel?: string
  /** Default `"Done"`. */
  doneLabel?: string
}

/**
 * The Select/Done toggle. One button that changes its word rather than two that appear and
 * disappear: the control stays in the same place, so leaving the mode is exactly as easy to find
 * as entering it was.
 */
export function BatchSelectButton({
  batch,
  selectLabel = "Select",
  doneLabel = "Done",
}: BatchSelectButtonProps): React.ReactElement {
  return (
    <Button size="sm" variant="ghost" aria-pressed={batch.active} onClick={batch.toggleActive}>
      {batch.active ? doneLabel : selectLabel}
    </Button>
  )
}
