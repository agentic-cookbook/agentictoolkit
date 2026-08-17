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
 *
 * `resetKey` is the same line drawn for the OTHER way rows leave the screen. Toggling the mode is
 * not the only thing that hides a selected row: paging, searching and filtering all do, and none
 * of them touches `active`. A list that pages client-side can hold three ticked rows on page one,
 * page to two, tick a fourth, and hand a bulk action four ids while showing one — which is the
 * invisible selection this hook exists to prevent, arriving through a door the toggle does not
 * cover.
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

export interface BatchSelectOptions {
  /**
   * A value describing WHICH ROWS the list is currently showing — a page number, a search string,
   * the chosen filters, or all of them joined. Whenever it changes by `Object.is`, the selection
   * is dropped, because the rows it named are no longer the rows on screen.
   *
   * Pass a PRIMITIVE. A `Set` or an object rebuilt each render is a new value every time, which
   * would clear the selection on the very render that made it.
   */
  resetKey?: unknown
}

/** Shared because the reset below runs during render: a fresh Set there is a fresh identity every
 *  render, and consumers key effects and memos off `selectedIds`. Never mutated — every writer
 *  hands `setSelectedIds` a Set of its own. */
const EMPTY_SELECTION: Set<string> = new Set()

export function useBatchSelect(options: BatchSelectOptions = {}): BatchSelect {
  const { resetKey } = options
  const [active, setActive] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set())

  // Reset DURING RENDER rather than in an effect. An effect would let one commit through with the
  // old selection against the new rows, and that commit is exactly when the Transfer button is
  // enabled, labelled with a count, and clickable.
  const lastResetKey = React.useRef(resetKey)
  let visible = selectedIds
  if (!Object.is(lastResetKey.current, resetKey)) {
    lastResetKey.current = resetKey
    visible = EMPTY_SELECTION
    setSelectedIds(EMPTY_SELECTION)
  }

  const clear = React.useCallback(() => setSelectedIds(new Set()), [])
  const toggleActive = React.useCallback(() => {
    setActive((wasActive) => {
      // Clear on the way OUT and on the way IN. Out, so a hidden selection cannot survive; in,
      // so a fresh batch never inherits whatever the single-select interaction left behind.
      setSelectedIds(new Set())
      return !wasActive
    })
  }, [])

  return { active, selectedIds: visible, setSelectedIds, toggleActive, clear, count: visible.size }
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
