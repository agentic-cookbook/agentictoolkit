"use client"

import * as React from "react"

import {
  DataTable,
  type DataTableColumn,
  type DataTableReorder,
} from "../components/data-table"
import { ResizableSplit } from "../components/resizable-split"
import { ListHeader } from "./list-header"
import { SelectionActions, type ListAction } from "./selection-actions"
import { cn } from "../lib/utils"

// `ListAction` was born here and is imported from here across the platform, so it keeps being
// exported from here — it now DESCRIBES the shared strip rather than owning it.
export type { ListAction }

export interface ListWithDetailsPaneProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  renderDetail: (row: T) => React.ReactNode
  emptyDetail?: React.ReactNode
  filterText?: string
  onFilterTextChange?: (t: string) => void
  filterPlaceholder?: string
  filterRow?: (row: T, query: string) => boolean
  onDelete?: (selectedIds: string[]) => void
  deleteConfirm?: { title: string; description?: React.ReactNode }
  actions?: ListAction[]
  storageKey?: string
  /** Opt-in URL-driven selection (a deep-linkable detail row). When provided, the
   *  SINGLE selected row is mirrored into `?<paramKey>=<id>` via `history.replaceState`
   *  (selecting a row neither remounts the route nor spams the history stack) and the
   *  initial selection is seeded from it on mount, so a reload / shared link restores
   *  the open row. A 0-or-many selection clears the param. Omit for the legacy
   *  internal-selection behavior — byte-for-byte unchanged. Sibling to `storageKey`
   *  (which persists only the split-bar position, never selection). */
  paramKey?: string
  loading?: boolean
  emptyLabel?: string
  /** Size each column to its widest cell and let the user drag a column's trailing border to
   *  override that (forwarded to {@link DataTable}). */
  autoSizeColumns?: boolean
  /** Persist the user's dragged column widths under this key (forwarded to {@link DataTable}).
   *  Distinct from `storageKey`, which persists only the split-bar position. */
  columnWidthsKey?: string
  /** Let rows be dragged into a new order (forwarded to {@link DataTable}). The list filters
   *  itself, so a caller that reorders should withhold this while its filter is non-empty — what
   *  is on screen is then a selection, and a position in it is not a position in the list. */
  reorder?: DataTableReorder
  /** Title on the details pane's header bar (and the disclosure's a11y label). */
  detailsLabel?: string
  ariaLabel: string
  className?: string
}

export function ListWithDetailsPane<T>({
  columns,
  rows,
  getRowId,
  renderDetail,
  emptyDetail = "Select a row to see details.",
  filterText,
  onFilterTextChange,
  filterPlaceholder = "Filter…",
  filterRow,
  onDelete,
  deleteConfirm,
  actions = [],
  storageKey,
  paramKey,
  loading,
  emptyLabel,
  autoSizeColumns,
  columnWidthsKey,
  reorder,
  detailsLabel = "Details",
  ariaLabel,
  className,
}: ListWithDetailsPaneProps<T>): React.ReactElement {
  const [internalFilter, setInternalFilter] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  // Opt-in URL selection (deep-linkable row): mirror the SINGLE selected row into
  // `?<paramKey>=<id>` and seed the initial selection from it on mount. When `paramKey`
  // is absent every branch below is inert, so behavior is byte-for-byte the legacy
  // internal-state one.
  function writeParam(ids: Set<string>): void {
    if (!paramKey || typeof window === "undefined") return
    const arr = [...ids]
    const only = arr.length === 1 ? arr[0] : undefined
    const url = new URL(window.location.href)
    if (only !== undefined) url.searchParams.set(paramKey, only)
    else url.searchParams.delete(paramKey)
    window.history.replaceState(null, "", url)
  }
  // The one write path for selection: update state AND reflect it to the URL.
  function updateSelection(ids: Set<string>): void {
    setSelectedIds(ids)
    writeParam(ids)
  }
  // Seed selection from the URL once on mount (deep-link / reload restore). An id no
  // longer present in `rows` is dropped by the existing stale-id prune below, so a
  // stale link fails safe to "nothing open" rather than a blank screen.
  React.useEffect(() => {
    if (!paramKey) return
    const id = new URLSearchParams(window.location.search).get(paramKey)
    if (id) setSelectedIds(new Set([id]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once rows are loaded, prune a URL-seeded id that no longer exists (deleted/renamed) from BOTH
  // state and the URL, so a stale `?<paramKey>=` doesn't linger and re-seed on reload. Guarded on
  // `loading` / non-empty rows so an async load never drops a valid deep-link before rows arrive.
  React.useEffect(() => {
    if (!paramKey || loading || rows.length === 0) return
    const kept = new Set([...selectedIds].filter((id) => rows.some((r) => getRowId(r) === id)))
    if (kept.size !== selectedIds.size) updateSelection(kept)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, loading, rows, selectedIds])

  // Controlled or internal filter
  const filterValue = filterText ?? internalFilter
  const query = filterValue.trim().toLowerCase()

  function setQuery(t: string): void {
    if (onFilterTextChange) {
      onFilterTextChange(t)
    } else {
      setInternalFilter(t)
    }
  }

  // Default filter: case-insensitive substring over column scalar values
  function defaultFilterRow(row: T): boolean {
    return columns.some((c) =>
      String((row as Record<string, unknown>)[c.key] ?? "")
        .toLowerCase()
        .includes(query)
    )
  }

  const visible = query
    ? rows.filter((r) => (filterRow ? filterRow(r, query) : defaultFilterRow(r)))
    : rows

  // Prune stale ids: only keep ids that are still present in rows
  const selectedArr = [...selectedIds].filter((id) => rows.some((r) => getRowId(r) === id))

  // Derive the single selected row for detail panel
  const selectedRow: T | null =
    selectedArr.length === 1
      ? (rows.find((r) => getRowId(r) === selectedArr[0]) ?? null)
      : null

  // Post-confirmation: the strip owns the modal, so by the time this runs the user has said yes.
  // The selection is emptied because the rows it named are gone — leaving it would arm the next
  // action against ids that no longer exist.
  function handleConfirmDelete(ids: string[]): void {
    onDelete?.(ids)
    updateSelection(new Set())
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* The shared list header (recessed ButtonBar strip): filter field left,
          ghost selection-actions and a ghost-red Delete right, so it matches
          every other list header on the platform. */}
      <ListHeader
        ariaLabel={`${ariaLabel} actions`}
        search={{ value: filterValue, onChange: setQuery, placeholder: filterPlaceholder }}
        actions={
          <SelectionActions
            selectedIds={selectedArr}
            actions={actions}
            onDelete={onDelete && handleConfirmDelete}
            deleteConfirm={deleteConfirm}
          />
        }
      />

      {/* Table + details split — list and details are PEERS in the column; the
          divider renders as the details pane's always-visible header bar.

          The two sizing classes are what make the split's RATIO mean anything, and
          neither is decorative. `flex-1` claims the column's remaining height: a
          ResizableSplit left at its `flex: 0 1 auto` default sizes to CONTENT, and a
          percentage flex-basis against a content-sized parent is circular, so the panes
          come out at their natural heights and the divider drags nothing — measured, a
          726px column held a 158px split with 568px of dead space under it.

          `min-h-[16rem]` is the other half: `flex-1` is `flex-basis: 0`, so in a column
          that is already over-full the split takes NEGATIVE free space and lands at
          height 0. That is worse than it sounds — the top pane's `overflow-auto` then
          clips the table out of hit-testing while `getBoundingClientRect` still reports
          the unclipped rows, so the list looks present to a test and to a screenshot and
          is unclickable to a person (measured at 1280x720: the list block got 46px and
          this header alone is 54px). The floor makes the page's own scroll container take
          the overflow instead, which is what it is there for. 16rem is the smallest height
          that still shows a header row, a few rows, the divider and a line of detail. */}
      <ResizableSplit
        className="min-h-[16rem] flex-1"
        storageKey={storageKey}
        header={detailsLabel}
        bottomLabel={detailsLabel}
        top={
          <DataTable<T>
            columns={columns}
            rows={visible}
            getRowId={getRowId}
            selectedIds={selectedIds}
            onSelectionChange={updateSelection}
            loading={loading}
            emptyLabel={emptyLabel}
            ariaLabel={ariaLabel}
            autoSizeColumns={autoSizeColumns}
            columnWidthsKey={columnWidthsKey}
            reorder={reorder}
            className="border-0 rounded-none"
          />
        }
        bottom={
          <div className="p-4 text-sm text-apt-text">
            {selectedArr.length === 0 || (selectedArr.length === 1 && selectedRow == null) ? (
              <div className="text-apt-text-muted">{emptyDetail}</div>
            ) : selectedArr.length > 1 ? (
              <div className="text-apt-text-muted">
                Select a single row to see details.
              </div>
            ) : (
              renderDetail(selectedRow!)
            )}
          </div>
        }
      />
    </div>
  )
}
