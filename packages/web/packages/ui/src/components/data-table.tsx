"use client"

import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"

import { cn } from "../lib/utils"

export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
  align?: "start" | "end"
}
export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  /** Omit BOTH selection props for an action-list table (per-row buttons/menus,
   *  no row selection): rows stop being clickable-to-select and carry no
   *  aria-selected, so in-cell controls own the interaction. */
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  sort?: { key: string; dir: "asc" | "desc" }
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void
  emptyLabel?: string
  loading?: boolean
  ariaLabel: string
  className?: string
}

const NO_SELECTION: Set<string> = new Set()

export function DataTable<T>({
  columns, rows, getRowId, selectedIds = NO_SELECTION, onSelectionChange,
  sort, onSortChange, emptyLabel = "No items.", loading = false, ariaLabel, className,
}: DataTableProps<T>): React.ReactElement {
  const selectable = onSelectionChange != null
  const baseId = React.useId()
  const anchorRef = React.useRef<string | null>(null)
  const ids = React.useMemo(() => rows.map(getRowId), [rows, getRowId])
  const [focusedId, setFocusedId] = React.useState<string | null>(null)

  function rowDomId(id: string): string {
    return `${baseId}-row-${id}`
  }

  function selectOne(id: string): void {
    anchorRef.current = id
    setFocusedId(id)
    onSelectionChange?.(new Set([id]))
  }
  function toggle(id: string): void {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    anchorRef.current = id
    setFocusedId(id)
    onSelectionChange?.(next)
  }
  function addToSelection(id: string): void {
    if (selectedIds.has(id)) return
    const next = new Set(selectedIds)
    next.add(id)
    anchorRef.current = id
    setFocusedId(id)
    onSelectionChange?.(next)
  }
  function range(toId: string): void {
    const anchor = anchorRef.current ?? toId
    const i = ids.indexOf(anchor)
    const j = ids.indexOf(toId)
    if (i < 0 || j < 0) return selectOne(toId)
    const [lo, hi] = i <= j ? [i, j] : [j, i]
    setFocusedId(toId)
    onSelectionChange?.(new Set(ids.slice(lo, hi + 1)))
  }

  function onRowClick(e: React.MouseEvent, id: string): void {
    if (e.shiftKey) range(id)
    else if (e.altKey) addToSelection(id)
    else selectOne(id)
  }

  function move(delta: number, extend: boolean): void {
    const cur = focusedId ?? anchorRef.current ?? (selectedIds.size ? [...selectedIds][0] : null)
    const i = cur == null ? -1 : ids.indexOf(cur)
    const ni = Math.min(ids.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))
    const target = ids[ni]
    if (target == null) return
    if (extend) range(target)
    else selectOne(target)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1, e.shiftKey) }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1, e.shiftKey) }
    else if (e.key === " ") {
      const cur = focusedId ?? anchorRef.current
      if (cur != null) { e.preventDefault(); toggle(cur) }
    }
  }

  function onGridFocus(): void {
    if (focusedId == null && ids.length > 0) {
      setFocusedId(ids[0] ?? null)
    }
  }

  function onHeader(col: DataTableColumn<T>): void {
    if (!col.sortable || !onSortChange) return
    const dir = sort && sort.key === col.key && sort.dir === "asc" ? "desc" : "asc"
    onSortChange({ key: col.key, dir })
  }

  const template = columns.map((c) => c.width ?? "1fr").join(" ")

  // In action-list mode (no selection) the container is a plain scrolling table:
  // NO grid keyboard/focus machinery, because its Arrow/Space handlers call
  // preventDefault on events BUBBLING from in-cell controls (inputs, selects,
  // buttons) — which would swallow typing a space, changing a native <select>,
  // or Space-activating a row button. Only the selectable grid claims those keys.
  const gridProps = selectable
    ? {
        role: "grid" as const,
        tabIndex: 0,
        onKeyDown,
        onFocus: onGridFocus,
        "aria-activedescendant": focusedId ? rowDomId(focusedId) : undefined,
      }
    : { role: "table" as const }

  return (
    <div {...gridProps} aria-label={ariaLabel}
      className={cn("overflow-auto rounded-lg border border-apt-border outline-none",
        selectable && "focus-visible:ring-2 focus-visible:ring-apt-gold/25", className)}>
      <div role="row" className="sticky top-0 z-10 grid bg-apt-surface-2 text-xs font-medium text-apt-text-muted"
        style={{ gridTemplateColumns: template }}>
        {columns.map((col) => (
          <div key={col.key} role="columnheader"
            aria-sort={sort?.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
            className={cn("px-3 py-2", col.align === "end" && "text-right")}>
            {col.sortable && onSortChange ? (
              <button type="button" onClick={() => onHeader(col)} className="inline-flex items-center gap-1 hover:text-apt-text">
                {col.header}
                {sort?.key === col.key && (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
            ) : col.header}
          </div>
        ))}
      </div>
      {loading ? (
        <div role="status" className="px-3 py-6 text-sm text-apt-text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-6 text-sm text-apt-text-muted">{emptyLabel}</div>
      ) : rows.map((row) => {
        const id = getRowId(row)
        const selected = selectable && selectedIds.has(id)
        const focused = focusedId === id
        return (
          <div key={id} id={rowDomId(id)} role="row"
            aria-selected={selectable ? selected : undefined}
            data-selected={selected || undefined}
            data-focused={focused || undefined}
            onMouseDown={selectable ? (e) => e.preventDefault() : undefined}
            onClick={selectable ? (e) => onRowClick(e, id) : undefined}
            className={cn("group/icc grid border-t border-apt-border text-sm text-apt-text",
              selectable && "cursor-pointer",
              selected ? "bg-apt-gold/15" : "hover:bg-apt-surface-2")}
            style={{ gridTemplateColumns: template }}>
            {columns.map((col) => (
              <div key={col.key} role={selectable ? "gridcell" : "cell"} className={cn("truncate px-3 py-1.5", col.align === "end" && "text-right")}>
                {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
