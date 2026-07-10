"use client"

import * as React from "react"

import { Trash2 } from "lucide-react"
import { DataTable, type DataTableColumn } from "../components/data-table"
import { ResizableSplit } from "../components/resizable-split"
import { AlertModal } from "../components/alert-modal"
import { Button } from "../components/button"
import { ListHeader } from "./list-header"
import { cn } from "../lib/utils"

export interface ListAction {
  id: string
  label: React.ReactNode
  onClick: (selectedIds: string[]) => void
  requiresSelection?: boolean
  dividerBefore?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
}

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
  detailsLabel = "Details",
  ariaLabel,
  className,
}: ListWithDetailsPaneProps<T>): React.ReactElement {
  const [internalFilter, setInternalFilter] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [confirming, setConfirming] = React.useState(false)

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

  function handleConfirmDelete(): void {
    setConfirming(false)
    onDelete?.(selectedArr)
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
          <>
            {actions.map((action) => (
              <React.Fragment key={action.id}>
                {action.dividerBefore && (
                  // A real toolbar separator (ARIA toolbar pattern) so AT users
                  // perceive the grouping the divider marks, not a decorative rule.
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="mx-1 h-5 w-px bg-apt-border"
                  />
                )}
                <Button
                  size="sm"
                  variant={action.variant ?? "ghost"}
                  disabled={action.requiresSelection === true && selectedArr.length === 0}
                  onClick={() => action.onClick(selectedArr)}
                >
                  {action.label}
                </Button>
              </React.Fragment>
            ))}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive-ghost"
                disabled={selectedArr.length === 0}
                onClick={() => setConfirming(true)}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            )}
          </>
        }
      />

      {/* Table + details split — list and details are PEERS in the column; the
          divider renders as the details pane's always-visible header bar. */}
      <ResizableSplit
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

      {/* Delete confirm modal */}
      {onDelete && (
        <AlertModal
          open={confirming}
          destructive
          title={deleteConfirm?.title ?? "Delete selected?"}
          description={deleteConfirm?.description}
          cancelLabel="Cancel"
          onCancel={() => setConfirming(false)}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
