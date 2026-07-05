"use client"

import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { Circle } from "lucide-react"

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
}

/** A leading rail row (e.g. a "New…" affordance). A function form receives the
 *  rail's collapsed state so it can shrink to an icon-only "+" when undisclosed. */
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

/**
 * A portaled overlay that floats `children` at a fixed on-screen rect, above everything. The
 * "covered" disclosure style uses it to reveal a peeking row (or list header) as its full uncovered
 * self in the EXACT spot it occupies. Portaled to <body> so it escapes the stack's clip + z-order.
 */
function RevealPortal({
  rect,
  className,
  onPointerLeave,
  onClick,
  children,
}: {
  rect: DOMRect
  className?: string
  onPointerLeave?: () => void
  onClick?: () => void
  children: ReactNode
}) {
  if (typeof document === "undefined") return null
  return createPortal(
    <div
      style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, zIndex: 60 }}
      className={cn("overflow-hidden", className)}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
    >
      {children}
    </div>,
    document.body,
  )
}

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
  railSlot?: RailSlot
  railSlotActive?: boolean
  /** Currently collapsed → icon-only rows; labels move to title/aria-label. */
  collapsed?: boolean
  /** This is the ROOT (outermost) list: its selected row shows a leading gold dash (marker style). */
  isRoot?: boolean
  /** Covered (peeking under a child in the "covered" style): render a clean LEFT-aligned icon strip
   *  (icon only, so the icon stays inside the ~40px peek) and, on hover of any icon, an INSTANT
   *  popover reproducing the full uncovered row over the EXACT spot the item occupies. Clicking the
   *  popover selects the item, exactly like clicking the row. */
  covered?: boolean
  /** How a selected row is marked: `"bar"` (default) is the classic gold left bar — for standalone
   *  TopicDetail and the minimized stack. `"marker"` drops the bar for the dash (root) + the
   *  parent→child connector line (drawn by the covered stack's overlay). */
  selectionStyle?: "bar" | "marker"
}) {
  // The covered row to reveal as a full-width popover. `via` records how it opened — a pointer hover
  // or keyboard focus — so the close logic can match (a pointer reveal closes when the pointer leaves
  // its box; a focus reveal closes on blur).
  const [reveal, setReveal] = useState<
    { item: TopicDetailItem; active: boolean; rect: DOMRect; via: "pointer" | "focus" } | null
  >(null)
  // While a reveal is open, close it on scroll (the captured rect would otherwise drift), Escape, or —
  // for a POINTER reveal — once the pointer is outside the row's box. The pointer-outside check also
  // covers the mount race (pointer already gone before the portal mounted) and replaces the popover's
  // own onPointerLeave so there's a single, robust close path.
  useEffect(() => {
    if (!reveal) return
    const close = () => setReveal(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    const onMove = (e: globalThis.PointerEvent) => {
      if (reveal.via !== "pointer") return
      const r = reveal.rect
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close()
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointermove", onMove, true)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointermove", onMove, true)
    }
  }, [reveal])
  // Icon-only layouts share the no-label row: `collapsed` CENTRES the icon (minimized icon strip);
  // `covered` keeps it LEFT-aligned so the icon stays inside the peek. Reveal applies only to covered.
  const iconOnly = !!collapsed || covered

  // One row renderer for both the list row and its reveal popover, so the popover IS the uncovered
  // row (DRY). `full` forces the uncovered shape (icon + label, left-aligned) for the popover.
  const itemButton = (
    item: TopicDetailItem,
    active: boolean,
    opts?: {
      full?: boolean
      onPointerEnter?: (e: PointerEvent<HTMLButtonElement>) => void
      onFocus?: (e: FocusEvent<HTMLButtonElement>) => void
      onBlur?: () => void
    },
  ) => {
    const full = opts?.full ?? false
    const hideLabel = full ? false : iconOnly
    const centered = full ? false : !!collapsed
    // Every row is guaranteed a leading icon so the icon-only strip never shows a blank slot.
    const icon = item.icon || FALLBACK_ICON
    return (
      <button
        type="button"
        disabled={item.disabled}
        onClick={() => {
          // Covered lists pure-SELECT: a click (on the icon or its reveal popover) only CHANGES the
          // selection — it never toggles/unselects, and is a no-op if this row is already selected.
          // Selecting clears the descendant lists and shows the chosen item's detail (onSelect's job).
          // Uncovered lists keep the package's toggle (re-click a selected row to deselect).
          if (covered && active) return
          onSelect(item.id)
        }}
        onPointerEnter={opts?.onPointerEnter}
        onFocus={opts?.onFocus}
        onBlur={opts?.onBlur}
        // The reveal popover is a transient duplicate of the selected row — only the real in-list row
        // carries aria-current, so AT doesn't see two "current" items.
        aria-current={active && !full ? "true" : undefined}
        // Icon-only rows have no visible text → carry the label as the accessible name.
        aria-label={hideLabel ? item.label : undefined}
        className={cn(
          // .settings-nav-item: mono, 0.8rem, tracking 0.02em.
          "relative flex w-full items-center border-l-2 border-transparent bg-transparent transition-colors",
          "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          centered
            ? "justify-center py-1.5"
            : "gap-2 pt-1 pr-3 pb-0.5 pl-4 text-left font-mono text-[0.8rem] tracking-[0.02em]",
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
        {/* Leading rail slot (e.g. a "New…" affordance). ALWAYS reserved at a fixed height —
            empty when there is no railSlot — so the first topic row sits at the same vertical
            position in every rail, whether or not the rail has a New button. It stays put when
            collapsed (only the topic list shrinks to icons), and carries the gold selection bar
            when nothing is focused (railSlotActive). */}
        <li
          className={cn(
            "flex min-h-[2.15rem] items-center border-l-2 border-transparent",
            collapsed && "justify-center",
            railSlotActive && "border-l-apt-gold",
          )}
        >
          {typeof railSlot === "function" ? railSlot(!!collapsed) : railSlot}
        </li>
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
          // Capture the row's rect to position the reveal over its exact spot. Pointer hover opens a
          // "pointer" reveal (closed by the global pointer-outside check); keyboard focus opens a
          // "focus" reveal (closed on blur) — so covered rows are reachable without a mouse.
          const open = (via: "pointer" | "focus", el: HTMLButtonElement) =>
            setReveal({ item, active, rect: el.getBoundingClientRect(), via })
          const button = itemButton(item, active, {
            onPointerEnter: covered ? (e) => open("pointer", e.currentTarget) : undefined,
            onFocus: covered ? (e) => open("focus", e.currentTarget) : undefined,
            onBlur: covered
              ? () => setReveal((r) => (r?.via === "focus" && r.item.id === item.id ? null : r))
              : undefined,
          })
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
      {/* Covered-row reveal: a full uncovered copy of the row, floated over its exact spot and
          INTERACTIVE — clicking it selects the item just like clicking the row. Closing is owned by
          the effect above (pointer-outside / blur / scroll / Escape), so there's no enter/leave
          flicker and it can't get stuck if the pointer left before the portal mounted. */}
      {covered && reveal && (
        <RevealPortal
          rect={reveal.rect}
          className="bg-apt-nav shadow-[6px_0_18px_-8px_var(--color-shadow)]"
          onClick={() => setReveal(null)}
        >
          {itemButton(reveal.item, reveal.active, { full: true })}
        </RevealPortal>
      )}
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
  railSlot?: RailSlot
  railSlotActive?: boolean
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
  /** This list is covered (peeking) in the "covered" style: rows render as an icon strip and
   *  hovering an icon — or the header — instantly reveals the full row/title in place. */
  covered?: boolean
  /** This is the ROOT (outermost) list — its selected row shows the leading gold dash (marker style). */
  isRoot?: boolean
  /** Selected-row marking: `"bar"` (classic gold bar; default) or `"marker"` (dash + connector). */
  selectionStyle?: "bar" | "marker"
}) {
  const asideRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerReveal, setHeaderReveal] = useState<DOMRect | null>(null)
  // Close the header reveal once the pointer leaves its box, or on scroll (its captured rect would
  // drift) or Escape. The pointer-outside check also covers the mount race.
  useEffect(() => {
    if (!headerReveal) return
    const close = () => setHeaderReveal(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    const onMove = (e: globalThis.PointerEvent) => {
      const r = headerReveal
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close()
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointermove", onMove, true)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointermove", onMove, true)
    }
  }, [headerReveal])
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

  // The titled header's inner content — rendered both in place (clipped under the covering card when
  // this list is covered) and, on hover of a covered list, in the RevealPortal. The control slot is a
  // fixed width matching where item icons start; the title sits where item labels start.
  const headerInner = (
    <>
      <div className="flex w-8 shrink-0 items-center justify-center">{leftControl ?? backSlot ?? null}</div>
      {title !== undefined && (
        <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
          {title}
        </span>
      )}
      {showToggle && !leftControl && (
        <span className="ml-auto shrink-0 max-md:hidden">
          <CollapseToggle collapsed={collapsed} onToggle={onToggle} label="topic list" controls={listId} />
        </span>
      )}
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
          start, the left-aligned title where item labels start, an optional right-justified collapse
          toggle, and a divider beneath — so every titled list reserves the same header height and
          their rows line up. Without a title (standalone TopicDetail) or when collapsed, fall back to
          the bare control strip (priority: leftControl → backSlot+toggle → toggle → nothing). */}
      {title !== undefined && !collapsed ? (
        <div
          ref={headerRef}
          // Covered (peeking) lists reveal their full header on hover — the same instant popover the
          // covered icons use — so a peeking list still shows its name + cover control.
          onPointerEnter={
            covered ? () => setHeaderReveal(headerRef.current?.getBoundingClientRect() ?? null) : undefined
          }
          className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border pr-2"
        >
          {headerInner}
        </div>
      ) : leftControl ? (
        <div className="flex shrink-0 items-center px-1.5 pt-1.5">{leftControl}</div>
      ) : backSlot ? (
        <div className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
          {backSlot}
          {showToggle && (
            <span className="max-md:hidden">
              <CollapseToggle collapsed={collapsed} onToggle={onToggle} label="topic list" controls={listId} />
            </span>
          )}
        </div>
      ) : showToggle ? (
        <div
          className={cn(
            "flex shrink-0 items-center pt-1.5 max-md:hidden",
            collapsed ? "justify-center" : "justify-end pr-1.5",
          )}
        >
          <CollapseToggle collapsed={collapsed} onToggle={onToggle} label="topic list" controls={listId} />
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
      {/* Covered header reveal: float the full header over its exact spot (above the covering cards),
          so a peeking list still names itself + offers its cover control on hover. Hides on leave. */}
      {covered && title !== undefined && headerReveal && (
        <RevealPortal
          rect={headerReveal}
          className="bg-apt-nav shadow-[6px_0_18px_-8px_var(--color-shadow)]"
        >
          <div className="flex min-h-[2.15rem] items-center gap-2 border-b border-apt-border pr-2">
            {headerInner}
          </div>
        </RevealPortal>
      )}
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
 * icon keeps the gold selection bar, and any railSlot stays put.
 */
export function TopicDetail({
  items,
  selectedId,
  onSelect,
  emptyLabel = "Nothing here yet.",
  railSlot,
  railSlotActive,
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
  /** Leading rail row above the topics (e.g. a "New…" affordance). Stays visible
   *  when the rail is collapsed; pass a `(collapsed) => node` function to shrink it
   *  to an icon-only "+" when undisclosed. */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (no topic active). */
  railSlotActive?: boolean
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
