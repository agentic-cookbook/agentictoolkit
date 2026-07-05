"use client"

import * as React from "react"

import { Trash2 } from "lucide-react"
import { DataTable, type DataTableColumn } from "../components/data-table"
import { ResizableSplit } from "../components/resizable-split"
import { AlertModal } from "../components/alert-modal"
import { Button } from "../components/button"
import { Input } from "../components/input"
import { ButtonBar } from "./button-bar"
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
  loading?: boolean
  emptyLabel?: string
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
  loading,
  emptyLabel,
  ariaLabel,
  className,
}: ListWithDetailsPaneProps<T>): React.ReactElement {
  const [internalFilter, setInternalFilter] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [confirming, setConfirming] = React.useState(false)

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
    setSelectedIds(new Set())
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Toolbar — the shared ButtonBar shell (recessed strip), hosting the
          filter (left) + ghost selection-actions and a ghost-red Delete (right),
          so it matches every other button bar on the platform. */}
      <ButtonBar ariaLabel={`${ariaLabel} actions`}>
        <Input
          value={filterValue}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={filterPlaceholder}
          aria-label="Filter"
          className="max-w-xs"
        />
        <div className="flex-1" />
        {actions.map((action) => (
          <React.Fragment key={action.id}>
            {action.dividerBefore && (
              <div className="mx-1 h-5 w-px bg-apt-border" aria-hidden />
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
      </ButtonBar>

      {/* Table + details split */}
      <ResizableSplit
        storageKey={storageKey}
        top={
          <DataTable<T>
            columns={columns}
            rows={visible}
            getRowId={getRowId}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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
