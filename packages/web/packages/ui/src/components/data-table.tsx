"use client"

import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"

import { cn } from "../lib/utils"
import { Checkbox } from "./checkbox"
import { inlineCommitHoverScopeClass } from "./inline-commit-control"
import {
  SortableItem,
  SortableSurface,
  SortableZone,
  type DragRenderState,
  type SortableDrop,
} from "./dnd"

/** What a cell's `render` is told about its row's drag — inert unless {@link DataTableProps.reorder}. */
export interface DataTableRowContext {
  /** Spread on the element that PICKS THE ROW UP (a {@link DragGrip}). Empty when reordering is off. */
  dragHandleProps: React.HTMLAttributes<HTMLElement>
  /** This row is the one being dragged right now. */
  dragging: boolean
}

/** The row context every table hands a cell when reordering is off — module scope, so it is one object. */
const NO_DRAG: DataTableRowContext = { dragHandleProps: {}, dragging: false }

/** A table is ONE ordered zone; the id is internal and never leaves this module. */
const ROWS_ZONE = "rows"

/**
 * Reordering, opted into per table.
 *
 * The table does NOT render the grip itself. A grip has to sit in a cell, and which cell is the
 * consumer's decision — the List view already has a column for moving a row (its `ReorderControl`
 * arrows), and putting the grip anywhere else would give one act two widgets in two places. So
 * the table makes each row draggable and hands the handle to the cells via
 * {@link DataTableRowContext}; the column that wants it spreads it.
 */
export interface DataTableReorder {
  /** Where the row landed, in the ordering endpoint's own vocabulary (neighbours, not an index). */
  onDrop: (drop: SortableDrop) => void
  /** The row's name for the drag announcements ("Picked up <name>"). */
  describeRow?: (id: string) => string
  /** False for a row that must not move right now (a write in flight, a row the sort forbids). */
  canDrag?: (id: string) => boolean
}

export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  render?: (row: T, ctx: DataTableRowContext) => React.ReactNode
  sortable?: boolean
  /** A FIXED CSS grid track for this column (e.g. `"8rem"`, `"1fr"`). Omit and the column sizes
   *  itself to its widest cell (`max-content`) — see {@link DataTableProps.autoSizeColumns}. */
  width?: string
  align?: "start" | "end"
  /** Opt this column out of user resizing (a trailing actions/commit cell has nothing to widen). */
  resizable?: boolean
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
  /** OPEN this row — double-click, or Enter on the focused row.
   *
   *  Selecting and opening are different acts, and without this prop a table has to pick one:
   *  either it wires `onSelectionChange` and can multi-select but never open anything, or it
   *  repurposes `onSelectionChange` as "the user clicked a row, go open it" — which works, but
   *  costs it selection entirely, so bulk actions and a details pane become unreachable. Wire
   *  both and the table behaves the way every other dense list on the platform does: click
   *  selects, double-click opens.
   *
   *  Enter is the keyboard twin, and it is not optional garnish — a double-click-only affordance
   *  is unreachable without a mouse. It rides the grid's own key handler, so it applies when the
   *  table is SELECTABLE; an action-list table (no selection) claims no keys at all. */
  onRowActivate?: (id: string) => void
  sort?: { key: string; dir: "asc" | "desc" }
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void
  emptyLabel?: string
  loading?: boolean
  ariaLabel: string
  className?: string
  /** Size every column with no explicit `width` to its WIDEST cell (`max-content`) instead of
   *  sharing the width equally (`1fr`), and let the user drag a column's trailing border to
   *  override that. Default false, so existing tables keep their equal-share layout.
   *
   *  A trailing filler track absorbs any slack, so content-sized columns sit left-packed rather than
   *  stretching; when the columns outgrow the table it scrolls horizontally (the cells keep
   *  `truncate`, so a column dragged NARROWER than its content ellipsises rather than reflowing). */
  autoSizeColumns?: boolean
  /** Persist the user's dragged column widths under this key (localStorage), so a table remembers
   *  its layout across visits. Omit to keep them for the life of the component. */
  columnWidthsKey?: string
  /** Let rows be DRAGGED into a new order. Omit for a table whose order is not the user's to set —
   *  and omit it while a sort or a filter is in force, where a dragged position would describe the
   *  view rather than the list underneath it. See {@link DataTableReorder}. */
  reorder?: DataTableReorder
  /** Show a leading checkbox column: one box per row, plus a select-all in the header.
   *
   *  Selection works without it — click, shift-click and Space have always been wired — but a
   *  table that can be multi-selected and never says so is discoverable only by guessing. The
   *  column is built HERE rather than handed in by the caller because a caller-built column's
   *  `render` receives no selection state, so it would need its own copy of `selectedIds`; two
   *  copies of one fact disagree the first time a shift-click extends a range.
   *
   *  Ignored without `onSelectionChange`: an action-list table has no selection to show. */
  showSelectionCheckboxes?: boolean
  /** Name a row for its selection checkbox ("Select …"), overriding the guess below.
   *
   *  The guess reads the row's first non-empty string field that isn't the id, which is right
   *  often enough to be worth having and wrong in a way nothing catches: a table whose id IS its
   *  descriptive field falls through to whatever comes next, and if that next field is a category
   *  — a scope, a kind, a status — every checkbox on the page ends up with the same name. Pass
   *  this wherever a row has an obvious label; `getRowId` is usually it. */
  describeRow?: (row: T) => string
}

const NO_SELECTION: Set<string> = new Set()

/** The dragged px widths per column key. */
type ColumnWidths = Record<string, number>

/** A column dragged narrower than this is pointless (the header label would vanish). */
const MIN_COLUMN_PX = 48

/** The synthetic checkbox column's key. Underscored so it cannot collide with a data column. */
const SELECT_COLUMN_KEY = "__select"

/** A checkbox needs a name a screen reader can tell apart from the other rows'. The row's first
 *  string-ish field is the best guess available without asking every caller for a labeller. */
function describeRowForSelection(row: unknown, id: string): string {
  if (row !== null && typeof row === "object") {
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim() !== "" && value !== id) return value
    }
  }
  return `row ${id}`
}

/** Adapt a row-shaped labeller to the id-shaped one the drag announcements want. */
function describeIdWith<T>(
  rows: T[],
  getRowId: (row: T) => string,
  describeRow: (row: T) => string,
): (id: string) => string {
  return (id) => {
    const row = rows.find((r) => getRowId(r) === id)
    return row === undefined ? id : describeRow(row)
  }
}

function readWidths(key: string | undefined): ColumnWidths {
  if (!key || typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(`data-table-cols:${key}`)
    return raw ? (JSON.parse(raw) as ColumnWidths) : {}
  } catch {
    return {}
  }
}

export function DataTable<T>({
  columns, rows, getRowId, selectedIds = NO_SELECTION, onSelectionChange, onRowActivate,
  sort, onSortChange, emptyLabel = "No items.", loading = false, ariaLabel, className,
  autoSizeColumns = false, columnWidthsKey, reorder, showSelectionCheckboxes = false, describeRow,
}: DataTableProps<T>): React.ReactElement {
  const selectable = onSelectionChange != null
  const baseId = React.useId()
  const anchorRef = React.useRef<string | null>(null)
  const ids = React.useMemo(() => rows.map(getRowId), [rows, getRowId])
  const [focusedId, setFocusedId] = React.useState<string | null>(null)

  // The synthetic leading column. `columns` below means "what the table renders", so the width
  // template, the header row, the cells and the auto-size measuring pass all pick it up without
  // any of them learning that a checkbox exists.
  //
  // Placed after `ids` (rather than immediately after `selectable`, above) because `allSelected`
  // below reads it, and `const` bindings are not hoisted — sitting any earlier is a
  // temporal-dead-zone crash the first time a selectable table renders.
  const allSelected = selectable && ids.length > 0 && ids.every((id) => selectedIds.has(id))
  const selectColumn: DataTableColumn<T> = {
    key: SELECT_COLUMN_KEY,
    width: "2.75rem",
    // Nothing to widen, and a drag handle on a 44px column is mostly a way to break it.
    resizable: false,
    header: (
      <Checkbox
        aria-label="Select all"
        checked={allSelected}
        // Adds and removes THE ROWS THIS TABLE IS SHOWING, leaving any other selected id alone.
        // `new Set(ids)` and `new Set()` were symmetrical and both wrong the moment the list is
        // paginated or filtered above the table: the first silently DROPPED a selection made on
        // another page while the checkbox said "select all", and the second cleared rows the user
        // could not see and had not asked about. What "all" means here is what is on screen.
        onCheckedChange={() => {
          const next = new Set(selectedIds)
          for (const id of ids) {
            if (allSelected) next.delete(id)
            else next.add(id)
          }
          onSelectionChange?.(next)
        }}
      />
    ),
    render: (row) => {
      const id = getRowId(row)
      return (
        // The stopPropagation is the whole point. The checkbox's clickable surface sits INSIDE
        // this cell, so without it the click bubbles up to the row's own onClick and calls
        // selectOne() — REPLACING the selection with this one row. Ticking three boxes would
        // leave one ticked.
        <span onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            aria-label={`Select ${describeRow?.(row) ?? describeRowForSelection(row, id)}`}
            checked={selectedIds.has(id)}
            onCheckedChange={() => toggle(id)}
          />
        </span>
      )
    },
  }
  const renderedColumns =
    selectable && showSelectionCheckboxes ? [selectColumn, ...columns] : columns

  // The user's dragged column widths (px), seeded from storage on first render and written back on
  // every change. A column with no entry falls back to its declared `width`, else the auto size.
  const [widths, setWidths] = React.useState<ColumnWidths>(() => readWidths(columnWidthsKey))
  const [dragging, setDragging] = React.useState(false)
  const setWidth = React.useCallback(
    (key: string, px: number | null) => {
      setWidths((prev) => {
        const next = { ...prev }
        if (px == null) delete next[key]
        else next[key] = Math.max(MIN_COLUMN_PX, Math.round(px))
        if (columnWidthsKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(`data-table-cols:${columnWidthsKey}`, JSON.stringify(next))
          } catch {
            // storage full / blocked — the widths still apply for this session
          }
        }
        return next
      })
    },
    [columnWidthsKey],
  )

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
    // A click that lands on an in-cell control still SELECTS the row (so the details pane follows
    // the row you are editing) but must not steal the control's own click — and it must never
    // SHRINK a selection, which is what makes this a guard rather than the bare `selectOne` it
    // used to be.
    //
    // The two shapes this component serves pull in opposite directions here. A details-pane list
    // selects exactly one row, and "clicking into a cell moves the pane to that row" is the whole
    // reason a control click touches the selection at all. A bulk-action table selects many, and
    // there `selectOne` is destructive: the operator ticks thirty rows, opens one row's inline
    // menu to check something, and the toolbar count quietly becomes 1 — so the Delete they press
    // next acts on one row instead of thirty. The checkbox column defends itself with a
    // stopPropagation wrapper; nothing else in a cell does, and asking every consumer to remember
    // one is a convention rather than a guarantee.
    //
    // So: a control click still moves a single selection, and leaves a multiple one alone. Neither
    // use case loses anything, and the case that loses data cannot happen.
    if (fromCellControl(e.target)) {
      if (selectedIds.size > 1) return
      selectOne(id)
      return
    }
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

  /** An event that came from a control INSIDE a cell (an inline editor, a select, a button). The
   *  grid must keep its hands off those: its Arrow/Space handlers call preventDefault, which would
   *  swallow a space typed into an inline editor or a native select's keyboard use; and its
   *  mousedown-preventDefault would stop the control from taking focus at all. This is what lets a
   *  SELECTABLE table also be inline-editable (row selection drives a details pane while the cells
   *  stay editable) — previously the two were mutually exclusive. */
  function fromCellControl(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest(
        // `[role='button']` is not padding: a drag handle is a SPAN carrying dnd-kit's attributes
        // (a `<button>` there would nest one role="button" inside another), and while it holds
        // focus during a keyboard drag every Arrow and Space belongs to the drag, not to the grid.
        "input, textarea, select, button, a, [role='button'], [contenteditable='true']",
      ) != null
    )
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (fromCellControl(e.target)) return
    if (e.key === "ArrowDown") { e.preventDefault(); move(1, e.shiftKey) }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1, e.shiftKey) }
    else if (e.key === " ") {
      const cur = focusedId ?? anchorRef.current
      if (cur != null) { e.preventDefault(); toggle(cur) }
    }
    else if (e.key === "Enter" && onRowActivate) {
      // The keyboard twin of the double-click. Claimed only when a consumer asked for activation,
      // so a table without it leaves Enter to whatever encloses the grid (a form, a dialog).
      const cur = focusedId ?? anchorRef.current
      if (cur != null) { e.preventDefault(); onRowActivate(cur) }
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

  // AUTO-SIZING, in two pre-paint passes. Every row is its OWN grid (they must be, to carry row
  // background/selection), so a `max-content` track would size each row independently — the header
  // to "Title", the body cell to its content — and the columns would not line up. So: render once
  // with `max-content` (each cell at its natural width), MEASURE the widest cell per column, then
  // lock that in as an explicit px track shared by every row. `null` means "needs measuring".
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [autoWidths, setAutoWidths] = React.useState<ColumnWidths | null>(null)
  // Re-measure whenever the rows or the columns change (new content ⇒ new natural widths).
  const sig = `${ids.join("|")}::${renderedColumns.map((c) => c.key).join(",")}`
  const measuredSig = React.useRef<string | null>(null)

  React.useLayoutEffect(() => {
    if (!autoSizeColumns) return
    if (measuredSig.current === sig) return
    // Pass 1 — drop the measured widths so the next layout renders at `max-content`.
    if (autoWidths !== null) {
      setAutoWidths(null)
      return
    }
    // Pass 2 — every cell is now at its natural width; take each column's widest.
    const el = gridRef.current
    if (!el) return
    const next: ColumnWidths = {}
    for (const c of renderedColumns) {
      let max = 0
      el.querySelectorAll(`[data-col="${c.key}"]`).forEach((cell) => {
        max = Math.max(max, cell.getBoundingClientRect().width)
      })
      next[c.key] = Math.ceil(max)
    }
    measuredSig.current = sig
    setAutoWidths(next)
  }, [autoSizeColumns, sig, renderedColumns, autoWidths])

  // The grid track for each column: a width the USER dragged wins, then the column's declared
  // `width`, then the measured natural width — falling back to `max-content` for the one measuring
  // pass, or to an equal `1fr` share when auto-sizing is off.
  //
  // In auto-size mode a trailing `minmax(0,1fr)` FILLER track (one more track than there are cells)
  // soaks up any leftover width, so content-sized columns pack to the left instead of stretching.
  const trackOf = (c: DataTableColumn<T>): string => {
    const dragged = widths[c.key]
    if (dragged != null) return `${dragged}px`
    if (c.width) return c.width
    if (!autoSizeColumns) return "1fr"
    const measured = autoWidths?.[c.key]
    return measured != null ? `${measured}px` : "max-content"
  }
  const template =
    renderedColumns.map(trackOf).join(" ") + (autoSizeColumns ? " minmax(0,1fr)" : "")

  // Drag the trailing border of a header cell: the new width is the pointer's distance from that
  // cell's left edge. Double-click clears the override, returning the column to its content size.
  const onColumnDragStart = (e: React.PointerEvent<HTMLDivElement>, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    const header = e.currentTarget.parentElement
    if (!header) return
    const left = header.getBoundingClientRect().left
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    const onMove = (ev: PointerEvent) => setWidth(key, ev.clientX - left)
    const onUp = (ev: PointerEvent) => {
      setDragging(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      void ev
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

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

  // A table is ONE ordered zone — there is no such thing as dragging a row into another table —
  // so the zone id is a constant and the model is just the rendered ids.
  const zones = React.useMemo(() => [{ id: ROWS_ZONE, itemIds: ids }], [ids])

  /** One row. `drag` is null in a table that does not reorder, and the cells are told so. */
  const renderRow = (row: T, drag: DragRenderState | null): React.ReactElement => {
    const id = getRowId(row)
    const selected = selectable && selectedIds.has(id)
    const focused = focusedId === id
    const ctx: DataTableRowContext = drag
      ? { dragHandleProps: drag.handleProps, dragging: drag.dragging }
      : NO_DRAG
    return (
      <div key={id} id={rowDomId(id)} role="row"
        ref={drag?.setNodeRef}
        aria-selected={selectable ? selected : undefined}
        data-selected={selected || undefined}
        data-focused={focused || undefined}
        // The preventDefault keeps a row click from stealing focus into the grid — but NOT when
        // the click is on an in-cell control, which must be allowed to focus itself (an inline
        // editor you cannot click into is no editor at all).
        onMouseDown={selectable ? (e) => { if (!fromCellControl(e.target)) e.preventDefault() } : undefined}
        onClick={selectable ? (e) => onRowClick(e, id) : undefined}
        // Same carve-out as the click: a double-click that lands on an in-cell control belongs
        // to the control (double-clicking a word in an inline editor selects it), not to the row.
        onDoubleClick={
          onRowActivate
            ? (e) => { if (!fromCellControl(e.target)) onRowActivate(id) }
            : undefined
        }
        className={cn(inlineCommitHoverScopeClass, "grid border-t border-apt-border text-sm text-apt-text",
          (selectable || onRowActivate) && "cursor-pointer",
          selected ? "bg-apt-highlight/15" : "hover:bg-apt-surface-2")}
        // The drag's transform comes LAST: while a row is being dragged its position is the
        // pointer's, not the layout's.
        style={{ gridTemplateColumns: template, ...drag?.style }}>
        {renderedColumns.map((col) => (
          // `truncate` (with min-w-0) matters even when a column sizes to its content: the moment
          // the user DRAGS it narrower than that, the cell must ellipsise rather than reflow and
          // knock every row out of alignment.
          <div key={col.key} role={selectable ? "gridcell" : "cell"} data-col={col.key} className={cn("min-w-0 truncate px-3 py-1.5", col.align === "end" && "text-right")}>
            {col.render ? col.render(row, ctx) : String((row as Record<string, unknown>)[col.key] ?? "")}
          </div>
        ))}
      </div>
    )
  }

  const body = loading ? (
    <div role="status" className="px-3 py-6 text-sm text-apt-text-muted">Loading…</div>
  ) : rows.length === 0 ? (
    <div className="px-3 py-6 text-sm text-apt-text-muted">{emptyLabel}</div>
  ) : reorder ? (
    rows.map((row) => {
      const id = getRowId(row)
      return (
        <SortableItem key={id} id={id} enabled={reorder.canDrag?.(id) ?? true}>
          {(drag) => renderRow(row, drag)}
        </SortableItem>
      )
    })
  ) : (
    rows.map((row) => renderRow(row, null))
  )

  // `dropRef` is the zone's droppable, and it goes on the SCROLLER rather than a wrapper around the
  // rows: a `role="grid"` may only hold rows and rowgroups, so an extra div would have to be given
  // a role to stay valid, and the zone exists to catch a drop over EMPTY space — which is exactly
  // the space the scroller has and a tight wrapper does not.
  const table = (dropRef?: (node: HTMLElement | null) => void): React.ReactElement => (
    <div {...gridProps}
      ref={(node) => { gridRef.current = node; dropRef?.(node) }}
      aria-label={ariaLabel}
      className={cn("overflow-auto rounded-lg border border-apt-border outline-none",
        selectable && "focus-visible:ring-2 focus-visible:ring-apt-gold/25", className)}>
      <div role="row" className="sticky top-0 z-10 grid bg-apt-surface-2 text-xs font-medium text-apt-text-muted"
        style={{ gridTemplateColumns: template }}>
        {renderedColumns.map((col) => (
          <div key={col.key} role="columnheader" data-col={col.key}
            aria-sort={sort?.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
            className={cn("relative px-3 py-2", col.align === "end" && "text-right")}>
            {col.sortable && onSortChange ? (
              <button type="button" onClick={() => onHeader(col)} className="inline-flex items-center gap-1 hover:text-apt-text">
                {col.header}
                {sort?.key === col.key && (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
            ) : col.header}
            {/* Resize handle on the column's TRAILING border (auto-size mode). Drag sets an explicit
                px width; double-click drops it, so the column springs back to fitting its content. */}
            {autoSizeColumns && col.resizable !== false && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize column ${col.key}`}
                onPointerDown={(e) => onColumnDragStart(e, col.key)}
                onDoubleClick={() => setWidth(col.key, null)}
                className="absolute top-0 right-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-apt-gold/40"
              />
            )}
          </div>
        ))}
      </div>
      {body}
    </div>
  )

  if (!reorder) return table()
  return (
    <SortableSurface
      zones={zones}
      onDrop={reorder.onDrop}
      // A row has ONE name, so the drag announcements fall back to the table's own `describeRow`
      // rather than making a table that reorders AND selects say two different things about the
      // same row. `reorder.describeRow` still wins where it is given: it takes an id, so it can
      // name a row this table is not currently holding.
      describeItem={reorder.describeRow ?? (describeRow ? describeIdWith(rows, getRowId, describeRow) : undefined)}
      describeZone={() => ariaLabel}
    >
      <SortableZone id={ROWS_ZONE} itemIds={ids}>
        {({ setNodeRef }) => table(setNodeRef)}
      </SortableZone>
    </SortableSurface>
  )
}
