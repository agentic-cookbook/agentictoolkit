"use client"

import { Fragment, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"

import { Circle, Plus, Trash2 } from "lucide-react"

import { AlertModal } from "../components/alert-modal"
import { CollapseToggle } from "../components/collapse-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip"
import { cn } from "../lib/utils"

// Faithful port of the adh.com/home topic rail — the SOURCE OF TRUTH:
// hub/src/components/settings/SettingsLayout.tsx + settings.css
// (.settings-layout / .settings-nav / .settings-nav-item / .settings-nav-divider
// / .settings-content), translated 1:1 from CSS to utilities with the apt-*
// tokens (--accent → apt-gold, --text → apt-text, --border → apt-border …).

export interface TopicDetailItem {
  id: string
  label: string
  /** Small dim second line (e.g. a reverse-domain identifier). */
  sublabel?: string
  /** 16px leading icon; tints with the label (currentColor). The rail is always
   *  collapsible, so every row is guaranteed an icon — a neutral ring fills in
   *  when omitted — so the collapsed icon-only strip never shows a blank slot. */
  icon?: ReactNode
  /** Render a separator row after this item (hub: before Settings). */
  dividerAfter?: boolean
  /** Render a flexible spacer after this item, pushing every following item to the
   *  rail's bottom edge (e.g. a bottom-pinned Settings). Applies in the collapsed /
   *  covered icon strips too. */
  spacerAfter?: boolean
  /** Dimmed + non-clickable (hub: scoped topics while "All" is active). */
  disabled?: boolean
  /** Trailing accessory pinned to the row's right edge (e.g. a warn Badge or a
   *  count). Hidden in icon-only modes (collapsed / covered), like the label. */
  trailing?: ReactNode
  /** Enable a right-justified trash button on this row, revealed on hover (and keyboard focus).
   *  Clicking it opens a confirmation dialog; ON CONFIRM this runs (may be async — the dialog shows
   *  a spinner until it settles). Only rendered in the expanded list, never the collapsed/covered
   *  icon strips. In the hierarchical stack the selection connector line breaks around the button. */
  onDelete?: () => void | Promise<void>
  /** Accessible name for the trash button and the confirm dialog's subject. Defaults to `label`. */
  deleteLabel?: string
  /** Confirmation body copy. Defaults to a generic "can't be undone" warning. */
  deleteConfirm?: ReactNode
}

/** A leading rail row rendered ABOVE the topics (e.g. a custom list header, or a PopupMenu control in
 *  FocusedTopicDetail). A function form receives the rail's collapsed state so it can shrink/hide when
 *  undisclosed. Rendered only when provided — an absent slot reserves NO space (the first topic sits at
 *  the top padding). This is distinct from the header `+` create affordance (`onNew`), which the
 *  hierarchical stack uses for its "New …" button. */
export type RailSlot = ReactNode | ((collapsed: boolean) => ReactNode)

// One shared element reference for icon-less rows — stable across renders so
// React's reconciler skips it. The rail always collapses to an icon-only strip,
// so every row needs a guaranteed leading icon; this fills in for rows that omit
// one. `||` (not `??`) also fills in for a `false` node from `cond && <Icon/>`.
const FALLBACK_ICON = <Circle size={16} aria-hidden />

// The rail's natural (full) width and the collapsed icon-strip width. Dragging the rail's
// trailing border narrower than a third of FULL snaps it to undisclosed; dragging it past
// FULL snaps it back to full.
// The rail's natural (full) width and the collapsed icon-strip width. Exported so
// HierarchicalTopicDetail's fit math uses the SAME contract (one authoritative home).
export const FULL_RAIL = 240
export const COLLAPSED_RAIL = 48

function TopicList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  railSlot,
  railSlotActive,
  collapsed,
  covered = false,
  isRoot = false,
  selectionStyle = "bar",
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided. */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Currently collapsed → icon-only rows; labels move to title/aria-label. */
  collapsed?: boolean
  /** This is the ROOT (outermost) list: its selected row shows a leading gold dash (marker style). */
  isRoot?: boolean
  /** Covered (peeking under a child in the "covered" style): render a clean LEFT-aligned icon strip
   *  (icon only, so the icon stays inside the ~40px peek). The whole list is revealed on hover by the
   *  covered stack (it re-layers the real rail full-width above its neighbours), so there is no
   *  per-row popover here. */
  covered?: boolean
  /** How a selected row is marked: `"bar"` (default) is the classic gold left bar — for standalone
   *  TopicDetail and the minimized stack. `"marker"` drops the bar for the dash (root) + the
   *  parent→child connector line (drawn by the covered stack's overlay). */
  selectionStyle?: "bar" | "marker"
}) {
  // Icon-only layouts share the no-label row: `collapsed` CENTRES the icon (minimized icon strip);
  // `covered` keeps it LEFT-aligned so the icon stays inside the peek.
  const iconOnly = !!collapsed || covered

  // Row delete: a row's hover-revealed trash button opens this confirm; ON CONFIRM the item's
  // (possibly async) onDelete runs, with a spinner shown until it settles. Reuses the shared
  // AlertModal so the prompt matches every other destructive confirm on the platform.
  const [pendingDelete, setPendingDelete] = useState<TopicDetailItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Retain the last target through the dialog's close animation so its title doesn't blank out.
  const lastDeleteRef = useRef<TopicDetailItem | null>(null)
  if (pendingDelete) lastDeleteRef.current = pendingDelete
  const deleteTarget = pendingDelete ?? lastDeleteRef.current
  const runDelete = async () => {
    if (!pendingDelete?.onDelete) {
      setPendingDelete(null)
      return
    }
    try {
      setDeleting(true)
      await pendingDelete.onDelete()
      setPendingDelete(null)
    } catch {
      // Leave the dialog open (no longer busy) so the user can retry or cancel; the consumer's
      // onDelete owns surfacing the failure.
    } finally {
      setDeleting(false)
    }
  }

  const itemButton = (item: TopicDetailItem, active: boolean) => {
    const hideLabel = iconOnly
    const centered = !!collapsed
    // Every row is guaranteed a leading icon so the icon-only strip never shows a blank slot.
    const icon = item.icon || FALLBACK_ICON
    // A deletable expanded row reserves extra right padding so the label never runs under the
    // hover-revealed trash button (and the rail width accounts for it).
    const deletable = !!item.onDelete && !hideLabel
    return (
      <button
        type="button"
        disabled={item.disabled}
        onClick={() => {
          // Covered lists pure-SELECT: a click only CHANGES the selection — it never toggles/unselects,
          // and is a no-op if this row is already selected. Selecting clears the descendant lists and
          // shows the chosen item's detail (onSelect's job). Uncovered lists keep the package's toggle
          // (re-click a selected row to deselect).
          if (covered && active) return
          onSelect(item.id)
        }}
        aria-current={active ? "true" : undefined}
        // Icon-only rows have no visible text → carry the label as the accessible name.
        aria-label={hideLabel ? item.label : undefined}
        className={cn(
          // .settings-nav-item: mono, 0.8rem, tracking 0.02em.
          "relative flex w-full items-center border-l-2 border-transparent bg-transparent transition-colors",
          "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          centered
            ? "justify-center py-1.5"
            : cn(
                "gap-2 pt-1 pb-0.5 pl-4 text-left font-mono text-[0.8rem] tracking-[0.02em]",
                deletable ? "pr-9" : "pr-3",
              ),
          item.disabled
            ? "cursor-default text-apt-text-dim"
            : active
              ? // "marker" selection (the hierarchical covered stack): no gold bar — selection shows as
                // the leading dash (root) + the connector line from the parent (drawn by the stack).
                // "bar" selection (standalone TopicDetail, the minimized stack): the classic gold left
                // bar, since those have no connector overlay to convey selection.
                selectionStyle === "marker"
                ? "text-apt-gold"
                : "border-l-apt-gold text-apt-gold"
              : "cursor-pointer text-apt-text hover:border-l-apt-text",
        )}
      >
        {/* Root list, marker style: a leading gold dash in front of the selected row's icon. */}
        {active && isRoot && !centered && selectionStyle === "marker" && (
          <span
            aria-hidden
            className="absolute top-1/2 left-1 h-0.5 w-2.5 -translate-y-1/2 rounded-full bg-apt-gold"
          />
        )}
        {/* Decorative: the label (text or aria-label) is the name, so the icon is hidden from AT. */}
        <span aria-hidden data-htd-icon className="flex shrink-0">
          {icon}
        </span>
        {!hideLabel && (
          <span data-htd-label className="min-w-0">
            <span className="block truncate">{item.label}</span>
            {item.sublabel && (
              <span className="block truncate text-[0.7rem] text-apt-text-dim">{item.sublabel}</span>
            )}
          </span>
        )}
        {!hideLabel && item.trailing && (
          <span className="ml-auto shrink-0 pl-1.5">{item.trailing}</span>
        )}
      </button>
    )
  }

  return (
    <TooltipProvider>
      {/* min-h-full lets a `spacerAfter` flex spacer push trailing items (e.g. a
          bottom-pinned Settings) to the rail's bottom when the list is shorter than it. */}
      <ul className="m-0 flex min-h-full list-none flex-col p-0">
        {/* Optional leading rail slot (a custom header / control). Rendered ONLY when a railSlot is
            supplied — an absent slot reserves no space, so the first topic sits at the list's top
            padding. Carries the gold selection bar when nothing is focused (railSlotActive). */}
        {railSlot !== undefined && (
          <li
            className={cn(
              "flex min-h-[2.15rem] items-center border-l-2 border-transparent",
              collapsed && "justify-center",
              railSlotActive && "border-l-apt-gold",
            )}
          >
            {typeof railSlot === "function" ? railSlot(!!collapsed) : railSlot}
          </li>
        )}
        {items.length === 0 && (
          <li>
            <p
              className={cn(
                "font-mono text-apt-text-dim",
                collapsed ? "px-1 py-2 text-center text-[0.7rem]" : "px-2 py-2 text-[0.8rem]",
              )}
            >
              {emptyLabel}
            </p>
          </li>
        )}
        {items.map((item) => {
          const active = item.id === selectedId
          const button = itemButton(item, active)
          const deletable = !!item.onDelete && !iconOnly
          return (
            <Fragment key={item.id}>
              <li>
                {collapsed ? (
                  // Collapsed to an icon-only strip: the row's label is no longer visible, so a
                  // hover/focus tooltip names it (replaces the native title — themed, with a delay).
                  <Tooltip>
                    <TooltipTrigger render={button} />
                    <TooltipContent side="right" arrow={false} className="max-w-none whitespace-nowrap">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : deletable ? (
                  // The row and its hover-revealed trash render as SIBLINGS (a button cannot nest in
                  // the row button). The trash carries `data-htd-delete` so the hierarchical stack's
                  // connector overlay breaks the selection line around it (a computed gap — the
                  // overlay paints above the rail, so occlusion is not possible).
                  <div className="group/htd-row relative">
                    {button}
                    <button
                      type="button"
                      data-htd-delete
                      aria-label={`Delete ${item.deleteLabel ?? item.label}`}
                      title={`Delete ${item.deleteLabel ?? item.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete(item)
                      }}
                      className={cn(
                        "absolute top-1/2 right-[3px] z-10 flex size-[19px] -translate-y-1/2 items-center justify-center rounded",
                        "bg-apt-nav text-apt-text-dim opacity-0 outline-none transition-opacity",
                        "hover:text-apt-red focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-apt-red/40 group-hover/htd-row:opacity-100",
                      )}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                ) : (
                  button
                )}
              </li>
              {item.dividerAfter && (
                <li
                  role="separator"
                  className={cn("my-1 h-px bg-apt-border", collapsed ? "mx-2" : "mx-3")}
                />
              )}
              {item.spacerAfter && <li aria-hidden className="min-h-4 flex-1" />}
            </Fragment>
          )
        })}
      </ul>
      {/* One confirm dialog per list; the target row is captured on trash-click. Destructive =
          red action, keyboard shortcuts off, initial focus on Cancel — so a delete is never a
          one-keystroke accident. `busy` shows a spinner and blocks dismissal during an async delete. */}
      <AlertModal
        open={pendingDelete != null}
        destructive
        title={`Delete ${deleteTarget?.deleteLabel ?? deleteTarget?.label ?? ""}?`}
        description={deleteTarget?.deleteConfirm ?? "This action can't be undone."}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={runDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </TooltipProvider>
  )
}

/**
 * One topic-list column: the darker `.settings-nav` aside with the disclosure toggle,
 * the scrollable list, and a trailing-border drag handle. Width is owned by the PARENT
 * (a CSS grid column), so this is reused as-is both as `TopicDetail`'s single rail and as
 * one of the flat sibling columns in `HierarchicalTopicDetail`. The drag handle measures
 * relative to this column's own left edge and reports a raw width up via `onResize`; the
 * parent clamps/snaps and decides collapse.
 */
export function TopicRail({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  railSlot,
  railSlotActive,
  onNew,
  newLabel,
  newActive,
  collapsed,
  onToggle,
  onResize,
  onResizeStart,
  onResizeEnd,
  footer,
  backSlot,
  leftControl,
  coveredShadow = false,
  showToggle = true,
  title,
  covered = false,
  isRoot = false,
  selectionStyle = "bar",
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided. */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Create affordance: when set, a right-justified `+` button in the list header fires it. */
  onNew?: () => void
  /** Accessible name + tooltip for the `+` (e.g. "New Persona"). Defaults to "New". */
  newLabel?: string
  /** Tint the `+` gold to signal an in-progress create (nothing selected in the list). */
  newActive?: boolean
  collapsed: boolean
  onToggle: () => void
  /** Drag of the trailing border reports the column's new pixel width (raw — the parent
   *  clamps to FULL and snaps to collapsed below a third). Omit to hide the drag
   *  handle (fixed-width rails like the theme editor's property columns). */
  onResize?: (widthPx: number) => void
  onResizeStart?: () => void
  onResizeEnd?: () => void
  /** Pinned below the list (border-t) — e.g. a "New…" affordance at the rail's foot. */
  footer?: ReactNode
  /** Optional leading affordance pinned top-left (e.g. a drill-down "Back" button). */
  backSlot?: ReactNode
  /** Optional control pinned top-left of THIS rail (the "covered" style's `«`/`»` cover
   *  toggle, which lives on the child rail rather than its parent). Renders in place of the
   *  top strip's contents; mutually used with `showToggle=false` to drop the desktop collapse
   *  toggle the covered style doesn't use. */
  leftControl?: ReactNode
  /** Cast a subtle LEFT drop-shadow on this rail (the "covered" style uses it on a child whose
   *  parent is covered, so the stack reads as physically layered). Default off. */
  coveredShadow?: boolean
  /** Show the desktop collapse toggle (the minimized style's `«` icon-strip toggle). Default
   *  true; the covered style passes false and supplies its own `leftControl` instead. */
  showToggle?: boolean
  /** A left-aligned heading naming the list (e.g. "Workspaces"), with a divider beneath. The control
   *  slot (covered `«`/`»` or a Back) sits where item ICONS start and the title where item LABELS
   *  start, so every titled list reserves the same header height and rows align vertically across
   *  lists. Omit (standalone TopicDetail) to keep the bare control strip with no header/divider. */
  title?: string
  /** This list is covered (peeking) in the "covered" style: rows render as a left-aligned icon
   *  strip. The covered stack reveals the whole list on hover by re-layering the real rail
   *  full-width above its neighbours (there is no per-row/header popover). */
  covered?: boolean
  /** This is the ROOT (outermost) list — its selected row shows the leading gold dash (marker style). */
  isRoot?: boolean
  /** Selected-row marking: `"bar"` (classic gold bar; default) or `"marker"` (dash + connector). */
  selectionStyle?: "bar" | "marker"
}) {
  const asideRef = useRef<HTMLElement>(null)
  const listId = useId()
  const draggingRef = useRef(false)
  const onDragStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    onResizeStart?.()
  }
  const onDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !asideRef.current) return
    onResize?.(e.clientX - asideRef.current.getBoundingClientRect().left)
  }
  const onDragEnd = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    onResizeEnd?.()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // The create affordance: a compact `+` right-justified in the header (replaces the old leading
  // "New…" rail row). Gold while a create is in progress (`newActive`). Icon-only, so its label
  // rides as the accessible name + native tooltip.
  const newButton = onNew ? (
    <button
      type="button"
      aria-label={newLabel ?? "New"}
      title={newLabel ?? "New"}
      onClick={onNew}
      className={cn(
        "flex shrink-0 items-center justify-center rounded p-0.5 outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        newActive ? "text-apt-gold" : "text-apt-text-muted",
      )}
    >
      <Plus size={16} aria-hidden />
    </button>
  ) : null

  const collapseToggle = (
    <CollapseToggle collapsed={collapsed} onToggle={onToggle} label="topic list" controls={listId} />
  )

  // Right-justified header controls: the New `+` (all widths) and, in the minimized style, the
  // desktop collapse toggle (`«`). The covered style passes `showToggle=false` + its own leftControl.
  const rightControls =
    newButton || (showToggle && !leftControl) ? (
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {newButton}
        {showToggle && !leftControl && <span className="max-md:hidden">{collapseToggle}</span>}
      </span>
    ) : null

  // The titled header's inner content. The control slot is a fixed width matching where item icons
  // start; the title sits where item labels start; the New/toggle controls are right-justified.
  const headerInner = (
    <>
      <div className="flex w-8 shrink-0 items-center justify-center">{leftControl ?? backSlot ?? null}</div>
      {title !== undefined && (
        <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
          {title}
        </span>
      )}
      {rightControls}
    </>
  )
  return (
    // .settings-nav: darker column, divider on the right, no left inset so the selection bar
    // sits flush against the edge.
    <aside
      ref={asideRef}
      aria-label="Topic list"
      // A left drop-shadow (covered style) reads against `--color-shadow` (a token, not a raw
      // colour) so the child casts a physical edge over its covered parent. Referenced via a CSS
      // var so the project-guidelines colour checker stays clean (no raw hex / rgb()).
      className={cn(
        "relative flex min-h-0 flex-col border-r border-apt-border bg-apt-nav",
        coveredShadow && "shadow-[-10px_0_22px_-8px_var(--color-shadow)]",
      )}
    >
      {/* Drag handle on the trailing border (desktop): resize the column; the parent snaps to
          undisclosed below a third, full past the natural width. Fixed-width rails
          (no onResize) render no handle. */}
      {onResize && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize topic list"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          className="absolute top-0 right-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-apt-gold/40 max-md:hidden"
        />
      )}
      {/* Top of the list. With a `title` (and not collapsed to an icon strip) this is the titled
          HEADER: a fixed control slot (the covered `«`/`»` or a minimized Back) where item icons
          start, the left-aligned title where item labels start, the right-justified New `+` / collapse
          toggle, and a divider beneath — so every titled list reserves the same header height and
          their rows line up. Without a title (standalone TopicDetail) or when collapsed, fall back to
          the bare control strip (priority: leftControl → backSlot → toggle/`+` → nothing). */}
      {title !== undefined && !collapsed ? (
        <div className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border pr-2">
          {headerInner}
        </div>
      ) : leftControl ? (
        <div className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
          {leftControl}
          {newButton}
        </div>
      ) : backSlot ? (
        <div className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
          {backSlot}
          <span className="flex items-center gap-1">
            {newButton}
            {showToggle && <span className="max-md:hidden">{collapseToggle}</span>}
          </span>
        </div>
      ) : showToggle || newButton ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 pt-1.5",
            // Collapsed icon strip (~48px): stack the `+` above the toggle. Else right-justify the row.
            collapsed ? "flex-col" : "justify-end pr-1.5",
            // Without a `+`, the strip is just the desktop-only collapse toggle — hidden on mobile.
            !newButton && "max-md:hidden",
          )}
        >
          {newButton}
          {showToggle && <span className={cn(newButton && "max-md:hidden")}>{collapseToggle}</span>}
        </div>
      ) : null}
      <div
        id={listId}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pb-8",
          collapsed ? "pl-0 pr-1 pt-2" : "pl-0 pr-4 pt-2",
        )}
      >
        <TopicList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyLabel={emptyLabel}
          railSlot={railSlot}
          railSlotActive={railSlotActive}
          collapsed={collapsed}
          covered={covered}
          isRoot={isRoot}
          selectionStyle={selectionStyle}
        />
      </div>
      {footer && <div className="shrink-0 border-t border-apt-border p-2">{footer}</div>}
    </aside>
  )
}

/**
 * The reusable two-pane primitive: a selectable [topic list] on the left and a
 * [detail pane] on the right — exactly the adh.com/home rail | content split.
 * That is ALL it is — no title row, no action bar. Compose those from other
 * blocks (see FocusedTopicDetail). Fills its container; give it a height.
 *
 * The rail is ALWAYS collapsible (a core part of the site design, not a config
 * flag): a top-right toggle (desktop only) shrinks the topic list to an icon-only
 * strip for more pane room — each topic stays clickable as its icon, the active
 * icon keeps the gold selection bar, and the header `+` stays put.
 */
export function TopicDetail({
  items,
  selectedId,
  onSelect,
  emptyLabel = "Nothing here yet.",
  railSlot,
  railSlotActive,
  onNew,
  newLabel,
  newActive,
  panePadding = true,
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = false,
  railWidth: railWidthProp = FULL_RAIL,
  children,
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel?: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided;
   *  an absent slot reserves no space. Distinct from the header `+` create affordance (`onNew`). */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Create affordance: when set, a right-justified `+` in the list header fires it. */
  onNew?: () => void
  /** Accessible name + tooltip for the `+` (e.g. "New Topic"). Defaults to "New". */
  newLabel?: string
  /** Tint the `+` gold to signal an in-progress create (nothing selected in the list). */
  newActive?: boolean
  /** Default true: the pane carries the standard content inset (px-6 py-4 +
   *  gap-6). Pass false for edge-to-edge content (hub's .settings-content has
   *  no inset — each row carries its own, e.g. a ButtonBar) so consumers never
   *  need negative-margin hacks. */
  panePadding?: boolean
  /** Controlled collapse: pass with `onCollapsedChange` to drive the rail's
   *  collapsed state from outside (HierarchicalTopicDetail auto-minimizes
   *  ancestor rails this way). Omit for the default self-managed toggle. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Initial collapsed state in uncontrolled mode (ignored when `collapsed` is set). */
  defaultCollapsed?: boolean
  /** The rail's natural (full) width in px; the drag handle clamps to it.
   *  Default FULL_RAIL (240) — the standard hub rail. Widen for rails whose
   *  rows are long identifiers (URLs). */
  railWidth?: number
  children: ReactNode
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  // Standard controllable pattern: `collapsed` wins when provided, else local state.
  const collapsed = collapsedProp ?? internalCollapsed
  const setCollapsedState = (next: boolean) => {
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }
  const toggleCollapsed = () => setCollapsedState(!collapsed)

  // Drag-to-resize the rail by its trailing border (desktop). The width drives a `--rail-w`
  // CSS var; the transition is suppressed while dragging so the rail tracks the pointer live.
  const [railWidth, setRailWidth] = useState(railWidthProp)
  const [dragging, setDragging] = useState(false)
  const onResize = (w: number) => {
    if (w < railWidthProp / 3) {
      // Narrower than a third → animate to undisclosed.
      if (!collapsed) setCollapsedState(true)
      return
    }
    // Dragging out of (or within) the disclosed range; past FULL snaps back to full.
    if (collapsed) setCollapsedState(false)
    setRailWidth(Math.min(w, railWidthProp))
  }
  return (
    <div
      // The rail column width is driven by the `--rail-w` CSS var (collapsed → the icon strip,
      // else the dragged width); the var changes animate via the transition. The global
      // accessibility CSS (data-reduce-motion / OS pref) zeroes transition durations, so this
      // honours the user's "reduce animation" setting. Transition is off while dragging so the
      // rail tracks the pointer live.
      style={{ "--rail-w": collapsed ? `${COLLAPSED_RAIL}px` : `${railWidth}px` } as CSSProperties}
      className={cn(
        "grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] md:[grid-template-columns:var(--rail-w)_minmax(0,1fr)]",
        !dragging && "md:transition-[grid-template-columns] md:duration-200 md:ease-out",
      )}
    >
      <TopicRail
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyLabel={emptyLabel}
        railSlot={railSlot}
        railSlotActive={railSlotActive}
        onNew={onNew}
        newLabel={newLabel}
        newActive={newActive}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onResize={onResize}
        onResizeStart={() => setDragging(true)}
        onResizeEnd={() => setDragging(false)}
      />
      {/* .settings-content: the surface panel for the whole right side. `overflow-auto` so a
          leaf detail with a minimum width scrolls horizontally here (rather than being crushed)
          when its column is narrower than that minimum; intermediate panes hold a shrinking grid
          so they never overflow. */}
      <section
        className={cn(
          "flex min-w-0 flex-col overflow-auto bg-apt-surface",
          panePadding && "gap-6 px-6 py-4",
        )}
      >
        {children}
      </section>
    </div>
  )
}
