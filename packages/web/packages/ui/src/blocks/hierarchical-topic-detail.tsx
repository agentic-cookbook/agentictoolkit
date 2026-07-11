"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react"

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
} from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/dialog"
import { TopicRail, FULL_RAIL, COLLAPSED_RAIL, type TopicDetailItem, type RailSlot } from "./topic-detail"

/** A leaf editor's unsaved-work guard. The package consults `isDirty()` before any select that
 *  clears or replaces the open detail (Back / breadcrumb-up / re-click / shallower select / a
 *  sibling swap at the deepest level) and, if dirty, raises a Save/Discard/Cancel prompt; `save()`
 *  resolves true once the draft is persisted so the package may then proceed. */
export interface PaneExitGuard {
  isDirty(): boolean
  save(): Promise<boolean>
}

// The enclosing frame for a hierarchy of topic/detail rails — the generalisation
// of the adh.com/home nesting (`[workspaces] | [features] | [content]`). Instead
// of hand-nesting TopicDetail inside TopicDetail, a consumer passes a flat
// `levels` array; this block:
//   1. renders a button bar (toolbar) + a breadcrumb trail UNDER it, and
//   2. nests the rails (each level's selection scopes the next) — every rail stays
//      available (expanded) by default. Optional auto-minimise (`maxExpanded`, OFF
//      by default) can collapse ancestors to their icon strip; the per-rail collapse
//      toggle is always available regardless.
// The `children` are the innermost detail content, computed by the consumer from
// the current selection; this block drops them into the deepest open rail's pane.

export interface TopicLevel {
  /** Stable key for the level (also its collapse-override + React key). */
  id: string
  /** Left-aligned heading naming this list (e.g. "Workspaces", "Ecosystems"), shown above the rows
   *  with a divider beneath. Every level should set one so the lists' rows align vertically. */
  title?: string
  items: TopicDetailItem[]
  selectedId: string | null
  /** Make `id` the selection at THIS level, keeping ancestors and clearing descendants.
   *  Pure navigation — the package decides WHEN to call it (a click on a not-yet-selected
   *  row), never auto-selecting. */
  onSelect: (id: string) => void
  /** Clear THIS level and everything below it, keeping ancestors. Pure navigation. The
   *  package calls it for re-click-deselect, breadcrumb up-navigation, and Back. */
  onClear: () => void
  emptyLabel?: string
  /** Create affordance: when set, a right-justified `+` in this level's list header fires it
   *  (replaces the old leading "New…" rail row). */
  onNew?: () => void
  /** Accessible name + tooltip for the `+` (e.g. "New Persona"). Defaults to "New". */
  newLabel?: string
  /** Tint the `+` gold to signal an in-progress create (nothing selected in the list). */
  newActive?: boolean
  /** Fixed rail width in px for THIS level (default 240 / FULL_RAIL). Widen a level
   *  whose rows must show on one line (e.g. long API paths). Covered style. */
  width?: number
  /** An optional leading ROW above this level's topics (scrolls with them, can carry
   *  the selection bar) — e.g. a "New…" affordance. Omit for a plain list. */
  railSlot?: RailSlot
  /** A pinned full-width strip between this level's title header and its rows (does
   *  NOT scroll with them) — the hook for the shared `ListHeader` (filter field +
   *  actions) when an entity list lives inside the stack. */
  headerSlot?: ReactNode
}

/** The top bar: a breadcrumb trail (leading root, then each selected level, then any
 *  non-interactive trailing crumbs) on the left, an optional `help` affordance right-
 *  justified on the breadcrumb bar, and an optional toolbar (e.g. a "New…" button) above. */
function TopBar({
  rootLabel,
  crumbs,
  onNavigate,
  toolbar,
  help,
  showBreadcrumb,
}: {
  rootLabel?: string
  /** Selected-item labels in order, deepest last. Each `onNavigate`-able crumb carries the
   *  level it deselects-down-to; a trailing crumb (e.g. an in-pane leaf) has no levelIndex. */
  crumbs: { levelIndex: number | null; label: string; interactive: boolean }[]
  /** `null` = the root crumb (deselect everything); else navigate to that level
   *  (deselect everything deeper). Omit a handler to render a static trail. */
  onNavigate?: (levelIndex: number | null) => void
  toolbar?: ReactNode
  /** Right-justified affordance on the breadcrumb bar (e.g. a help "?" describing the view). */
  help?: ReactNode
  showBreadcrumb: boolean
}) {
  // The whole trail; the last entry is current. The leading root deselects everything.
  const trail: { levelIndex: number | null; label: string; interactive: boolean }[] = showBreadcrumb
    ? [
        ...(rootLabel !== undefined
          ? [{ levelIndex: null as number | null, label: rootLabel, interactive: true }]
          : []),
        ...crumbs,
      ]
    : []
  const hasCrumbs = trail.length > 0
  if (!hasCrumbs && !toolbar) return null
  return (
    // Two stacked bars: the button bar (toolbar) on top, then the breadcrumb trail
    // UNDER it — not in the same row.
    <>
      {toolbar && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-apt-border bg-apt-bg px-4 py-2">
          {toolbar}
        </div>
      )}
      {hasCrumbs && (
        <div className="flex min-w-0 shrink-0 items-center gap-3 border-b border-apt-border bg-apt-nav px-4 py-2">
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
              {trail.map((c, i) => {
                const last = i === trail.length - 1
                return (
                  <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
                    {i > 0 && (
                      <ChevronRight size={12} aria-hidden className="shrink-0 text-apt-text-dim" />
                    )}
                    {last || !c.interactive || !onNavigate ? (
                      <span
                        aria-current={last ? "page" : undefined}
                        className={cn(
                          "truncate font-mono text-xs tracking-[0.02em]",
                          last ? "text-apt-gold" : "text-apt-text-muted",
                        )}
                      >
                        {c.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate(c.levelIndex)}
                        className="truncate rounded font-mono text-xs tracking-[0.02em] text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
                      >
                        {c.label}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
          {help && <div className="flex shrink-0 items-center">{help}</div>}
        </div>
      )}
    </>
  )
}

export function HierarchicalTopicDetail({
  levels,
  rootLabel,
  trailingCrumbs,
  toolbar,
  help,
  showBreadcrumb = true,
  minDetailWidth = "28rem",
  detailTitle,
  exitGuard = null,
  manualCollapse = true,
  disclosureStyle = "covered",
  autoHideTopics = true,
  children,
}: {
  /** The rail levels, outermost first. Each level's selection scopes the next. */
  levels: TopicLevel[]
  /** Leading breadcrumb (e.g. the feature/workspace name); its crumb deselects
   *  everything (clears level 0). Omit to start the trail at the first selection. */
  rootLabel?: string
  /** Extra non-interactive crumbs appended after the level crumbs (e.g. an in-pane
   *  master/detail leaf label the package doesn't own). */
  trailingCrumbs?: { label: string }[]
  /** Right-aligned content in the toolbar row above the breadcrumb (e.g. a "New…" button). */
  toolbar?: ReactNode
  /** Right-justified affordance on the breadcrumb bar (e.g. a help "?" for the view). */
  help?: ReactNode
  /** Show the breadcrumb trail (default true). Pass false when an enclosing chrome
   *  renders the breadcrumb instead (the rails then carry no top bar of their own). */
  showBreadcrumb?: boolean
  /** Minimum width of the leaf detail pane (CSS length). Below it the package drills
   *  down (slides parent topic lists off-screen) so the detail keeps this width. Default `28rem`. */
  minDetailWidth?: string
  /** A title shown in the detail (leaf) pane's top strip, aligned with the rail
   *  headers — names what the pane is showing (covered style). */
  detailTitle?: ReactNode
  /** The leaf editor's unsaved-work guard. When dirty, Back / breadcrumb-up / re-click /
   *  selecting a shallower row / swapping to a sibling at the deepest level first prompt
   *  Save/Discard/Cancel. Omit for no guard. */
  exitGuard?: PaneExitGuard | null
  /** Keep the per-rail manual disclosure toggle (the `«` icon strip). Default true. A
   *  manually-collapsed list counts as its icon width in the fit math, then slides
   *  off-screen if there is still no room. (Minimized style only.) */
  manualCollapse?: boolean
  /** How ancestor lists yield room to the detail as the window narrows. Default `"covered"`.
   *   - `"minimized"` — the leftmost lists shrink to icon strips, then slide off-screen; a
   *      top-left Back walks back up.
   *   - `"covered"` — the lists stay FULL width; the leftmost slide LEFT *under* their child
   *      (covered), with a `«`/`»` cover toggle on each child and a left drop-shadow making the
   *      stack read as physically layered. No Back button. */
  disclosureStyle?: "minimized" | "covered"
  /** Start with only the LEAF-MOST topic list disclosed — every parent list is covered by its
   *  child even when there is room to show it. Default `true`; the first list's header carries a
   *  toggle so the user can flip it (off ⇒ every list discloses, subject to the fit rules). Pass
   *  `false` for a surface whose ancestry must stay glanceable (the hub's `/home`). */
  autoHideTopics?: boolean
  /** Innermost detail content for the current selection (lands in the rightmost
   *  detail pane). */
  children: ReactNode
}) {
  // Frontier = the deepest rendered rail: the first level with no selection, else the last level.
  // Rails 0..frontier render as flat sibling columns; `children` are the rightmost (detail) column.
  const firstUnselected = levels.findIndex((l) => l.selectedId == null)
  const frontier = firstUnselected === -1 ? levels.length - 1 : firstUnselected
  const rendered = levels.slice(0, frontier + 1)
  // The deepest SELECTED level (whose detail is showing): the frontier if every level is selected,
  // else one above it; -1 when nothing is selected. Back clears exactly this level.
  const deepestSelected = firstUnselected === -1 ? frontier : frontier - 1

  // The unsaved-work gate: every action that would clear a level (Back, re-click-deselect,
  // breadcrumb up-nav, selecting a shallower row) runs through here. Dirty → open the 3-action
  // modal and remember the pending action; clean → act now.
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null)
  const [savingExit, setSavingExit] = useState(false)
  const attemptExit = useCallback(
    (action: () => void) => {
      if (exitGuard?.isDirty()) setPendingExit(() => action)
      else action()
    },
    [exitGuard],
  )

  // Each selected level contributes a crumb; clicking it deselects EVERYTHING DEEPER — i.e. it
  // clears the next level down (`levels[i+1].onClear()`), leaving this level's selection in place.
  // The package owns this so consumers write no breadcrumb-up logic. Trailing crumbs (e.g. an
  // in-pane leaf label) are appended non-interactively.
  const crumbs: { levelIndex: number | null; label: string; interactive: boolean }[] = [
    ...levels
      .map((l, i) =>
        l.selectedId == null
          ? null
          : {
              levelIndex: i,
              label: l.items.find((it) => it.id === l.selectedId)?.label ?? l.selectedId,
              interactive: true,
            },
      )
      .filter((c): c is { levelIndex: number; label: string; interactive: boolean } => c !== null),
    ...(trailingCrumbs ?? []).map((c) => ({ levelIndex: null, label: c.label, interactive: false })),
  ]

  // Breadcrumb navigation, package-owned via onClear (gated by the exit guard): the root crumb
  // clears level 0 (deselect all); a level crumb clears the level below it (deselect deeper).
  const onCrumbNavigate = (levelIndex: number | null) =>
    attemptExit(() => (levelIndex === null ? levels[0]?.onClear() : levels[levelIndex + 1]?.onClear()))

  // Disclosure INTENT, owned here so both layouts share one contract (they differ only in how a
  // hidden list is drawn — a peek vs an icon strip):
  //   autoHide — only the LEAF-MOST list stays disclosed; every parent is hidden by its child even
  //              when there IS room. The frame's default; the root list's header toggles it.
  //   pins     — per-level user intent from the `«`/`»` toggles, overriding autoHide either way
  //              (true = keep hidden, false = keep disclosed). Width pressure may still hide a list
  //              the user pinned open — there is no room — but never discloses one they pinned shut.
  // Flipping autoHide CLEARS the pins: turning it on hides every parent that was disclosed; turning
  // it off discloses every list that fits (the fit rules then re-hide whatever doesn't).
  const [autoHide, setAutoHide] = useState(autoHideTopics)
  const [pins, setPins] = useState<Record<string, boolean>>({})
  const toggleAutoHide = useCallback(() => {
    setAutoHide((prev) => !prev)
    setPins({})
  }, [])

  // The two layouts share the same selection / breadcrumb / exit-guard semantics above and differ
  // ONLY in how ancestor lists yield room to the detail — so each is its own subcomponent owning its
  // observer + layout state (kept distinct so either can evolve or be deleted independently).
  const stackProps = {
    rendered,
    deepestSelected,
    firstUnselected,
    frontier,
    minDetailWidth,
    detailTitle,
    attemptExit,
    autoHide,
    toggleAutoHide,
    pins,
    setPins,
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopBar
        rootLabel={rootLabel}
        crumbs={crumbs}
        onNavigate={onCrumbNavigate}
        toolbar={toolbar}
        help={help}
        showBreadcrumb={showBreadcrumb}
      />
      {disclosureStyle === "minimized" ? (
        <MinimizedStack {...stackProps} levels={levels} manualCollapse={manualCollapse}>
          {children}
        </MinimizedStack>
      ) : (
        <CoveredStack {...stackProps}>{children}</CoveredStack>
      )}

      {/* Unsaved-work guard: a 3-action Save / Discard / Cancel modal. Save → persist then act;
          Discard → act; Cancel → keep the dirty editor. */}
      <UnsavedChangesModal
        open={pendingExit !== null}
        busy={savingExit}
        onSave={async () => {
          if (!exitGuard) return
          setSavingExit(true)
          try {
            const ok = await exitGuard.save()
            if (ok) {
              pendingExit?.()
              setPendingExit(null)
            }
          } finally {
            // Always clear busy — a rejected save() must not leave the modal stuck/undismissable.
            setSavingExit(false)
          }
        }}
        onDiscard={() => {
          pendingExit?.()
          setPendingExit(null)
        }}
        onCancel={() => setPendingExit(null)}
      />
    </div>
  )
}

// Covered (stacked) style: how much of a covered list still peeks out on the left under its child —
// a PARTIAL cover, so the stack reads as physically layered cards (not a full cover / off-screen).
// FULL_RAIL / COLLAPSED_RAIL are imported from topic-detail (the one authoritative home).
const COVERED_PEEK = 40

/** Parse `minDetailWidth` (a CSS length) to px for the fit math. Handles the units that make sense
 *  for a fixed minimum — `rem`/`em` (×16, the app's root size) and `px`. Viewport/percent units
 *  (`vw`/`%`/`vh`/`ch`) can't be resolved to a fixed px here, so they fall back to a sane default
 *  rather than being silently mis-read as raw px. */
function minDetailPx(minDetailWidth: string): number {
  const s = minDetailWidth.trim()
  const n = parseFloat(s)
  if (Number.isNaN(n)) return 28 * 16 // unparseable → the 28rem default
  if (s.endsWith("rem") || s.endsWith("em")) return n * 16
  if (s.endsWith("px") || /^\d*\.?\d+$/.test(s)) return n // explicit px or a bare number
  return 28 * 16 // a relative/viewport unit we can't resolve to fixed px → the 28rem default
}

/** The selection wiring shared by both stacks. Any select that would clear or replace
 *  the open deeper detail is exit-guarded: re-clicking the selected row (deselects this
 *  level), AND selecting a DIFFERENT row in a level that already has a selection —
 *  whether an ancestor (clears everything below) or the deepest selected level itself
 *  (a sibling swap that replaces the open leaf editor). Only a forward drill-down into a
 *  not-yet-selected level (`selectedId == null`) is unguarded: there is no open detail to
 *  lose. Because selections are contiguous from the top, `selectedId != null` is exactly
 *  "this level is at or above the deepest selection". */
function railOnSelect(level: TopicLevel, attemptExit: (action: () => void) => void) {
  return (id: string) =>
    id === level.selectedId
      ? attemptExit(() => level.onClear())
      : level.selectedId != null
        ? attemptExit(() => level.onSelect(id))
        : level.onSelect(id)
}

interface StackProps {
  rendered: TopicLevel[]
  deepestSelected: number
  firstUnselected: number
  frontier: number
  minDetailWidth: string
  detailTitle?: ReactNode
  attemptExit: (action: () => void) => void
  /** Hide every list but the leaf-most, even when there is room (see HierarchicalTopicDetail). */
  autoHide: boolean
  toggleAutoHide: () => void
  /** Per-level user intent from the `«`/`»` toggles: true = pinned hidden, false = pinned disclosed. */
  pins: Record<string, boolean>
  setPins: (next: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  children: ReactNode
}

/** The root list's header control: flips {@link StackProps.autoHide}. Unlike the `«`/`»` cover
 *  toggles (which name the ACTION they perform on one list) this reports STATE — gold + a closed
 *  panel while auto-hide is on, muted + an open panel while every list is disclosed — so the user
 *  can see at a glance why their parent lists are hidden. */
function AutoHideToggle({ autoHide, onToggle }: { autoHide: boolean; onToggle: () => void }) {
  const label = autoHide
    ? "Auto-hide parent topic lists: on — show them all"
    : "Auto-hide parent topic lists: off — hide all but the last"
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={autoHide}
      title={label}
      className={cn(
        "rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        autoHide ? "text-apt-gold hover:text-apt-gold/80" : "text-apt-text-muted hover:text-apt-text",
      )}
    >
      {autoHide ? (
        <PanelLeftClose size={16} aria-hidden className="shrink-0" />
      ) : (
        <PanelLeftOpen size={16} aria-hidden className="shrink-0" />
      )}
    </button>
  )
}

/**
 * True for the ONE render that follows a STRUCTURAL change — a level appearing/disappearing or any
 * level's selection changing. Both stacks use it to drop their `left`/`width`/`grid` transitions for
 * that commit, so choosing a topic lands the new geometry IN PLACE (instantly) instead of sliding the
 * detail pane in from the left edge as the lists re-cover behind it. Width-driven changes (a window
 * resize, a cover toggle, the hover reveal) still animate: they don't touch this signature.
 *
 * The bump re-renders with the transitions back on, but the geometry it re-renders with is the SAME
 * one the browser already painted — a transition can only animate a CHANGE, so nothing moves.
 */
function useInPlaceOnStructureChange(signature: string): boolean {
  const prev = useRef(signature)
  const [, bump] = useState(0)
  const changed = prev.current !== signature
  useLayoutEffect(() => {
    if (prev.current === signature) return
    prev.current = signature
    bump((n) => n + 1)
  }, [signature])
  return changed
}

/** The signature {@link useInPlaceOnStructureChange} watches: the level count + every selection. */
function structureSignature(rendered: TopicLevel[]): string {
  return `${rendered.length}::${rendered.map((l) => l.selectedId ?? "").join("|")}`
}

/**
 * Selection connectors, shared by BOTH stacks: a gold elbow from each selected PARENT row to its
 * selected CHILD row. Every coordinate is measured from the DOM in one snapshot (parent exit = its
 * label end, or its ICON's right when collapsed to an icon strip; child entry = just before its icon;
 * the bend = the child column's left edge), so collapsed/peeking columns work and the parts never
 * disagree. Columns are matched by `data-htd-col`; the selected row by `aria-current`. The lists slide
 * over ~0.3s, so re-measure on a short rAF loop; a scroll re-measures once via the returned `onScroll`
 * (no re-render). `sig` is the caller's layout+selection signature; when connectors are impossible
 * (fewer than two columns, or nothing selected) the loop is skipped entirely.
 */
function useSelectionConnectors(
  containerRef: RefObject<HTMLDivElement | null>,
  levelCount: number,
  sig: string,
  possible: boolean,
): { connectors: string[]; onScroll: () => void } {
  const [connectors, setConnectors] = useState<string[]>([])
  const measureRef = useRef<() => void>(() => {})
  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    let raf = 0
    const measure = () => {
      const crect = cont.getBoundingClientRect()
      const anchor = (i: number) => {
        const sel = cont.querySelector(`[data-htd-col="${i}"] [aria-current="true"]`)
        if (!sel) return null
        const r = sel.getBoundingClientRect()
        const labelEl = sel.querySelector("[data-htd-label]")
        const iconEl = sel.querySelector("[data-htd-icon]")
        const end = labelEl ?? iconEl
        // A deletable row's trash button is a sibling of the row button; the connector breaks around
        // it — but ONLY while the trash is actually REVEALED (the row is hovered, or the trash has
        // keyboard focus), not merely because the slot is reserved. The stack re-measures on pointer /
        // focus activity (see the container handlers), so the gap opens and closes with the button.
        const delEl = sel.parentElement?.querySelector("[data-htd-delete]") ?? null
        const delShown =
          !!delEl && ((sel.parentElement?.matches(":hover") ?? false) || delEl.matches(":focus-visible"))
        const delRect = delShown && delEl ? delEl.getBoundingClientRect() : null
        return {
          y: r.top + r.height / 2 - crect.top,
          rightX: (end ? end.getBoundingClientRect().right : r.right) - crect.left,
          iconLeft: (iconEl ? iconEl.getBoundingClientRect().left : r.left) - crect.left,
          left: r.left - crect.left,
          delLeft: delRect ? delRect.left - crect.left : null,
          delRight: delRect ? delRect.right - crect.left : null,
        }
      }
      const next: string[] = []
      for (let i = 0; i < levelCount - 1; i++) {
        const p = anchor(i)
        const c = anchor(i + 1)
        if (!p || !c) continue
        if (p.rightX < 0 || c.left > crect.width) continue // an endpoint drilled off-screen
        const boundary = c.left // the child column's current left edge (the bend)
        const startX = Math.min(p.rightX + 6, boundary - 4) // just past the parent's visible content
        const endX = Math.max(c.iconLeft - 6, boundary + 2) // just before the child's icon
        // The elbow after the parent's horizontal run: to the child column's edge (the bend), down/up
        // to the child row, then in to just before its icon.
        const elbow = `L ${boundary} ${p.y} L ${boundary} ${c.y} L ${endX} ${c.y}`
        // Break the horizontal run around a deletable parent row's trash button, so the line never
        // crosses it (the overlay paints above the rail, so this gap — not occlusion — is the break).
        if (p.delLeft != null && p.delRight != null && p.delRight > startX && p.delLeft < boundary) {
          const gapL = Math.max(p.delLeft - 4, startX)
          const gapR = Math.min(p.delRight + 4, boundary)
          if (gapL > startX + 0.5) next.push(`M ${startX} ${p.y} L ${gapL} ${p.y}`)
          next.push(`M ${gapR} ${p.y} ${elbow}`)
        } else {
          next.push(`M ${startX} ${p.y} ${elbow}`)
        }
      }
      setConnectors((prev) =>
        prev.length === next.length && prev.every((d, k) => d === next[k]) ? prev : next,
      )
    }
    measureRef.current = measure // a scroll re-measures once via this ref (no re-render)
    if (!possible) {
      setConnectors((prev) => (prev.length === 0 ? prev : []))
      return
    }
    const start = performance.now()
    const loop = () => {
      measure()
      if (performance.now() - start < 400) raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [containerRef, levelCount, sig, possible])
  return { connectors, onScroll: () => measureRef.current() }
}

/** The SVG overlay that draws the measured connector paths above the columns (pointer-transparent). */
function SelectionConnectorOverlay({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          className="stroke-apt-gold"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

/**
 * The "minimized" disclosure style (unchanged from the original single-layout block): the lists are
 * flat grid columns; as the window narrows the leftmost shrink to icon strips (auto), then slide
 * off-screen (hidden), and a top-left Back walks back up.
 */
function MinimizedStack({
  rendered,
  deepestSelected,
  firstUnselected,
  frontier,
  minDetailWidth,
  detailTitle,
  attemptExit,
  autoHide,
  toggleAutoHide,
  pins,
  setPins,
  levels,
  manualCollapse,
  children,
}: StackProps & { levels: TopicLevel[]; manualCollapse: boolean }) {
  // `pins` (from the frame) is this stack's manual collapse-to-icon-strip intent, and auto-hide is
  // its default for every non-leaf list — the same two intent layers the covered stack uses, drawn
  // as an icon strip instead of a peek. `widths` is a dragged column width (≤ FULL).
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [dragging, setDragging] = useState(false)
  const override = pins
  const setOverride = setPins

  // ONE ResizeObserver over the WHOLE row (not one per nested rail) is the single disclosure /
  // drill-down controller. The leaf minimum is parsed from `minDetailWidth`.
  const minPx = minDetailPx(minDetailWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  // Window auto-disclosure, in TWO PHASES as the window shrinks (recomputed in the single
  // ResizeObserver from container width, before paint):
  //   auto   — ids UNDISCLOSED to their icon strip (general→specific). This is the FIRST response:
  //            collapse the leftmost lists to icons until everything fits, or every list is an icon.
  //   hidden — how many leftmost lists are then slid OFF-SCREEN. The LAST resort, reached only once
  //            every list is already an icon strip and they + the detail minimum STILL don't fit.
  const [auto, setAuto] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState(0)

  const naturalWidth = (level: TopicLevel) => widths[level.id] ?? level.width ?? FULL_RAIL
  // Intent: the user's pin (`«`) if they set one, else auto-hide's default (every list but the
  // leaf-most). Width pressure (`auto`) only ever ADDS a collapse on top of this.
  const pinnedOrAutoHidden = (level: TopicLevel, i: number) =>
    override[level.id] ?? (autoHide && i < rendered.length - 1)
  // A list shows as its icon strip when intent says so OR the window auto-undisclosed it (`auto`).
  // Off-screen drilling (`hidden`) is separate and applied last.
  const isCollapsed = (level: TopicLevel, i: number) =>
    pinnedOrAutoHidden(level, i) || auto.has(level.id)
  // The visible width a list occupies in the fit math: 0 if slid off-screen, its icon strip if
  // collapsed, else its full/dragged width.
  const visibleWidth = (level: TopicLevel, i: number) =>
    i < hidden ? 0 : isCollapsed(level, i) ? COLLAPSED_RAIL : naturalWidth(level)

  // Recompute the window auto-disclosure for the current container width — the spec's TWO-PHASE
  // response, planned from scratch each time (so growing the window re-discloses then re-shows, in
  // reverse). Computed in the observer (pre-paint) so a narrow first render starts correct (no flash).
  const recompute = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.clientWidth
    if (width <= 0) return
    const cols = rendered
    // Keep the FRONTIER list visible while it has no selection (its "detail" is only a landing
    // placeholder, so the user needs the list to pick from). Once every level is selected the detail
    // is real content, so every list may slide off (a phone shows the detail full-width).
    const maxHide = firstUnselected === -1 ? cols.length : frontier

    const collapsed = new Set<string>() // window-undisclosed (icon strip) ids
    let h = 0 // off-screen count
    const shown = (l: TopicLevel, i: number) => pinnedOrAutoHidden(l, i) || collapsed.has(l.id)
    const widthOf = (l: TopicLevel, i: number) =>
      i < h ? 0 : shown(l, i) ? COLLAPSED_RAIL : naturalWidth(l)
    const total = () => cols.reduce((s, l, i) => s + widthOf(l, i), 0) + minPx

    // PHASE 1 — UNDISCLOSE: collapse the leftmost still-full list to its icon strip (general→specific)
    // until everything fits, or every list is already an icon strip.
    while (total() > width) {
      const target = cols.find((l, i) => !shown(l, i))
      if (!target) break
      collapsed.add(target.id)
    }
    // PHASE 2 — OFF-SCREEN: only now — every list an icon strip and they + the detail minimum STILL
    // don't fit — slide the leftmost icon strips off the left edge, until the detail fits (≤ maxHide).
    while (total() > width && h < maxHide) h++

    setAuto((prev) =>
      prev.size === collapsed.size && [...collapsed].every((id) => prev.has(id)) ? prev : collapsed,
    )
    setHidden((prev) => (prev === h ? prev : h))
  }, [rendered, frontier, firstUnselected, override, autoHide, widths, minPx])

  // Re-run on container resize (the window) and whenever the rendered lists / manual collapse change.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    recompute()
    const ro = new ResizeObserver(() => recompute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [recompute])

  // The `«`/`»` toggle pins this list to the state it is moving TO. Holding the platform's
  // multi-select modifier (⌘ on macOS, Ctrl elsewhere) applies that state to EVERY list at once. The
  // fit rules still run on top, so an "expand all" only discloses the lists that actually fit.
  const setCollapse = (i: number, e: ReactMouseEvent) => {
    const level = rendered[i]!
    const target = !isCollapsed(level, i)
    if (e.metaKey || e.ctrlKey) {
      setOverride(Object.fromEntries(rendered.map((l) => [l.id, target])))
      return
    }
    setOverride((o) => ({ ...o, [level.id]: target }))
  }

  // Drag of a column's trailing border: narrower than a third snaps to the icon strip (override),
  // else sets its width and clears any collapse override.
  const onResizeLevel = (level: TopicLevel, w: number) => {
    if (w < FULL_RAIL / 3) {
      if (manualCollapse && override[level.id] !== true) setOverride((o) => ({ ...o, [level.id]: true }))
      return
    }
    setWidths((wd) => ({ ...wd, [level.id]: Math.min(w, FULL_RAIL) }))
    if (override[level.id]) setOverride((o) => ({ ...o, [level.id]: false }))
  }

  // Drill-down Back: shown iff at least one rail is hidden AND something is selected. It clears the
  // deepest selected level (re-disclosing one parent); repeated Back walks up to root.
  const showBack = hidden > 0 && deepestSelected >= 0
  const onBack = () => attemptExit(() => levels[deepestSelected]?.onClear())
  // The Back button lives on the LEFTMOST-VISIBLE pane: the first rail that isn't hidden, or the
  // detail when every rail is hidden (phone width). `backOnRail` = that rail's index, else -1 → detail.
  const backOnRail = showBack && hidden < rendered.length ? hidden : -1
  const backButton = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className="flex items-center gap-1 rounded px-1.5 py-1 font-mono text-xs tracking-[0.02em] text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
    >
      <ChevronLeft size={14} aria-hidden className="shrink-0" />
      <span>Back</span>
    </button>
  )

  // The flat grid template: one column per rendered rail (0 if slid off-screen, icon strip if
  // manually collapsed, else its width), then the detail column. Held in a CSS var so changes
  // animate via the single grid transition (reduce-motion honoured by the global accessibility CSS).
  const cols = [...rendered.map((l, i) => `${visibleWidth(l, i)}px`), "minmax(0,1fr)"].join(" ")

  // Choosing a topic must land the detail IN PLACE, never slide it in as the columns re-flow behind
  // it; only width-driven changes (resize, a manual toggle) animate the grid.
  const inPlace = useInPlaceOnStructureChange(structureSignature(rendered))
  const animate = !dragging && !inPlace

  // Selection connectors (shared with the covered stack). The signature is the per-level selection
  // plus the grid template (column widths) and off-screen count — everything that moves a row.
  const connectorSig = `${rendered.map((l) => l.selectedId ?? "").join("|")}::${cols}::${hidden}`
  const connectorsPossible = rendered.length >= 2 && rendered.some((l) => l.selectedId != null)
  const { connectors, onScroll } = useSelectionConnectors(
    containerRef,
    rendered.length,
    connectorSig,
    connectorsPossible,
  )

  return (
    <div
      ref={containerRef}
      // `onScroll` is the connector re-measure trigger; fire it on pointer / focus movement too so
      // the gap around a row's trash button tracks the button's hover / keyboard-focus reveal.
      onScrollCapture={onScroll}
      onPointerOver={onScroll}
      onPointerOut={onScroll}
      onFocus={onScroll}
      onBlur={onScroll}
      style={{ "--cols": cols } as CSSProperties}
      className={cn(
        // Drill-down applies at EVERY width (it IS the small-screen layout): the lists are grid
        // columns and the leftmost slide off-screen when the detail can't fit — so a phone shows
        // the deepest pane full-width from first paint, with Back to walk up. No `md:` gate.
        // `relative` anchors the absolute selection-connector overlay.
        "relative grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] [grid-template-columns:var(--cols)]",
        animate && "transition-[grid-template-columns] duration-200 ease-out",
      )}
    >
      {rendered.map((level, i) => {
        const offscreen = i < hidden
        return (
          // A hidden rail is slid off-screen (0-width column): inert + aria-hidden + no pointer
          // events so it is fully out of the tab order / AT tree while it animates away.
          <div
            key={level.id}
            data-htd-col={i}
            className={cn(
              "grid min-h-0 min-w-0 [grid-template-columns:minmax(0,1fr)]",
              offscreen && "pointer-events-none overflow-hidden",
            )}
            aria-hidden={offscreen || undefined}
            // React 19 types `inert` as a boolean prop; `undefined` (not false) omits the attribute.
            inert={offscreen || undefined}
          >
            <TopicRail
              title={level.title}
              isRoot={i === 0}
              // Selection is shown by the dash (root) + the connector overlay, matching the covered
              // stack — not the gold bar (which standalone TopicDetail keeps).
              selectionStyle="marker"
              items={level.items}
              selectedId={level.selectedId}
              onSelect={railOnSelect(level, attemptExit)}
              emptyLabel={level.emptyLabel ?? "Nothing here yet."}
              onNew={level.onNew}
              newLabel={level.newLabel}
              newActive={level.newActive}
              railSlot={level.railSlot}
              headerSlot={level.headerSlot}
              collapsed={isCollapsed(level, i)}
              onToggle={manualCollapse ? (e) => setCollapse(i, e) : () => {}}
              onResize={(w) => onResizeLevel(level, w)}
              onResizeStart={() => setDragging(true)}
              onResizeEnd={() => setDragging(false)}
              // The root rail's leading slot carries the auto-hide toggle for the whole stack. Back
              // only ever lands on a rail to its right (it appears once a rail is hidden), so the two
              // never contend for the slot.
              leftControl={
                i === 0 ? (
                  <AutoHideToggle autoHide={autoHide} onToggle={toggleAutoHide} />
                ) : undefined
              }
              // The drill-down Back lands top-left of the leftmost-visible rail.
              backSlot={i === backOnRail ? backButton : undefined}
            />
          </div>
        )
      })}
      {/* Selection connectors: gold elbows linking each selected parent row to its selected child. */}
      <SelectionConnectorOverlay paths={connectors} />
      {/* The detail (leaf) column — ALWAYS the rightmost sibling with a stable key, so it mounts
          once and never remounts as the rail count changes. When every rail is hidden (phone
          width) the Back button rides the top of this pane. The inner div holds a minimum width so
          the pane scrolls horizontally rather than crushing when its column is narrower. */}
      <section key="__detail__" className="flex min-w-0 flex-col overflow-auto bg-apt-surface">
        {detailTitle !== undefined ? (
          <div className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border bg-apt-nav px-2">
            {backOnRail === -1 && showBack && backButton}
            <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
              {detailTitle}
            </span>
          </div>
        ) : (
          backOnRail === -1 &&
          showBack && (
            <div className="flex shrink-0 items-center border-b border-apt-border bg-apt-nav px-2 py-1.5">
              {backButton}
            </div>
          )
        )}
        {/* Hold the leaf to its min width so it scrolls rather than crushing — but never wider than
            the viewport, so on a phone (where every list has drilled off) the form reflows to the
            full width instead of forcing a horizontal scroll. */}
        <div
          className="flex min-h-0 w-full flex-1 flex-col"
          style={{ minWidth: `min(${minDetailWidth}, 100%)` }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}

/**
 * The "covered" disclosure style. The lists stay FULL width and are laid out left→right; the detail
 * fills the remaining width down to `minDetailWidth`. As the window narrows, the leftmost lists are
 * COVERED — each slides LEFT *under* its child (the next list, or the detail), which sits in front
 * (higher z-index) casting a left drop-shadow so the stack reads as physically layered. The cover
 * toggle lives on each CHILD's top-left: `«` covers the child's parent, `»` uncovers it. No Back
 * button; the breadcrumb is the navigation.
 */
function CoveredStack({
  rendered,
  firstUnselected,
  frontier,
  minDetailWidth,
  detailTitle,
  attemptExit,
  autoHide,
  toggleAutoHide,
  pins,
  setPins,
  children,
}: StackProps) {
  const minPx = minDetailPx(minDetailWidth)
  // Per-level rail width: a DRAGGED width (the trailing-border handle) wins, else the level's own
  // `width`, else FULL_RAIL. The covered style has no icon strip, so a rail resizes FREELY within a
  // readable range (widening a rail to read long rows is the point) — unlike the minimized style,
  // which snaps a narrow drag to an icon strip and caps at FULL_RAIL.
  const MIN_DRAG_RAIL = 160
  const MAX_DRAG_RAIL = 640
  const [widths, setWidths] = useState<Record<string, number>>({})
  // True mid-drag, so the left/width transitions are suppressed (the rail tracks the pointer 1:1
  // instead of easing) and restored on release.
  const [dragging, setDragging] = useState(false)
  const railWidth = (l: TopicLevel) => widths[l.id] ?? l.width ?? FULL_RAIL
  const onResizeLevel = (level: TopicLevel, w: number) =>
    setWidths((wd) => ({ ...wd, [level.id]: Math.max(MIN_DRAG_RAIL, Math.min(w, MAX_DRAG_RAIL)) }))
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  // Whole-list HOVER reveal: the covered (peeking) list the pointer is inside (`hoverId`) wipes OPEN to
  // full width above its neighbours (a `clip-path` from the 40px peek to full), so no popover copy is
  // needed. Disclosed ONLY while the pointer stays inside it; leaving — or clicking a row — wipes it
  // back to the peek. It is pointer-only on purpose: a keyboard/mouse FOCUS reveal would keep a list
  // disclosed after a click (the clicked button holds focus), jamming the auto-cover as the window shrinks.
  const [hoverId, setHoverId] = useState<string | null>(null)
  // The revealed list is lifted above its neighbours (z-50) so its expanding clip shows OVER them. On
  // CLOSE the z-lift must LINGER for the wipe-shut transition (z-index can't animate) — else the list
  // would drop behind its child mid-close and the wipe would be invisible. `zLiftId` tracks `hoverId`
  // but trails it by the transition duration when clearing.
  const [zLiftId, setZLiftId] = useState<string | null>(null)
  useEffect(() => {
    if (hoverId !== null) {
      setZLiftId(hoverId)
      return
    }
    const t = setTimeout(() => setZLiftId(null), 300)
    return () => clearTimeout(t)
  }, [hoverId])

  // Measure the container in a ResizeObserver. useLayoutEffect (not useEffect) takes the FIRST
  // measurement before the browser paints, so the detail pane never flashes at width 0 (containerW
  // starts 0 and the detail width is gated on containerW > 0).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerW((prev) => (prev === el.clientWidth ? prev : el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The frontier list stays uncovered while it has no selection (its "detail" is only a landing, so
  // the user needs the list to pick from), and is never shifted off-screen for it — an unselected
  // frontier's placeholder claims NO minimum width (must-not-hide-frontier-choosing-list).
  const coverableCount = firstUnselected === -1 ? rendered.length : frontier
  const detailMin = firstUnselected === -1 ? minPx : 0

  // COVER LAYER 1 — intent. A list is covered because the user pinned it (`«`), or because auto-hide
  // is on and it isn't the leaf-most list. A pin wins either way, so the user can hold a parent open
  // under auto-hide (until width pressure below takes the room back).
  const pinnedOrAutoHidden = (i: number): boolean => {
    if (i >= coverableCount) return false
    return pins[rendered[i]!.id] ?? (autoHide && i < rendered.length - 1)
  }

  // COVER LAYER 2 — width pressure. Cover MORE lists, leftmost-first (general → specific), until the
  // detail keeps its minimum. This layer only ever ADDS a cover: it may take the room back from a
  // list the user pinned open (there is none to give), but never discloses one they pinned shut.
  let pressure = 0
  if (containerW > 0) {
    const listsWidth = (n: number) =>
      rendered.reduce(
        (w, l, i) => w + (pinnedOrAutoHidden(i) || i < n ? COVERED_PEEK : railWidth(l)),
        0,
      )
    while (pressure < coverableCount && listsWidth(pressure) + detailMin > containerW) pressure++
  }
  const isCovered = (i: number) => pinnedOrAutoHidden(i) || i < pressure
  const widthOf = (i: number) => (isCovered(i) ? COVERED_PEEK : railWidth(rendered[i]!))

  // PHASE 2 — OFF-SCREEN. Every list is down to its peek and they STILL don't leave the detail its
  // minimum: slide the leftmost list off the left edge and shift the whole stack by exactly THAT
  // list's width, repeating until the detail fits (or only the frontier is left). Quantised to whole
  // lists on purpose — a continuous shift would park a list half off the edge, which reads as a
  // clipped rail rather than a drilled-down one.
  let hidden = 0
  let offshift = 0
  if (containerW > 0) {
    const widthFrom = (h: number) =>
      rendered.reduce((w, _l, i) => (i < h ? w : w + widthOf(i)), 0) + detailMin
    while (hidden < coverableCount && widthFrom(hidden) > containerW) {
      offshift += widthOf(hidden)
      hidden++
    }
  }

  // Layout pass (running x): each list's natural left. A covered list advances x only by its PEEK (it
  // stays visible as a stacked-card edge under its child), so the next list / the detail slides left
  // to PARTIALLY cover it. `offshift` then slides the whole row left over the hidden lists.
  const left: number[] = []
  let x = 0
  rendered.forEach((_l, i) => {
    left.push(x)
    x += widthOf(i)
  })
  const detailLeft = Math.max(0, x - offshift)
  const detailWidth = containerW > 0 ? Math.max(0, containerW - detailLeft) : 0

  // The `«`/`»` toggle sets a list's pin to the state it is moving TO. Holding the platform's
  // multi-select modifier (⌘ on macOS, Ctrl elsewhere) applies that same state to EVERY list at once
  // — one click to collapse the whole ancestry, or to open all of it. The fit rules still run on top,
  // so "open all" only discloses the lists that actually fit.
  const setCover = (parentIndex: number, e: ReactMouseEvent) => {
    const target = !isCovered(parentIndex) // the state the clicked button moves that list TO
    if (e.metaKey || e.ctrlKey) {
      setPins(Object.fromEntries(rendered.map((l) => [l.id, target])))
      return
    }
    setPins((prev) => ({ ...prev, [rendered[parentIndex]!.id]: target }))
  }

  // The `«`/`»` cover control for a CHILD whose parent is rendered list `parentIndex`. `«` (parent
  // not covered) covers the parent; `»` (parent covered) uncovers it. Purely presentational layout —
  // it never changes selection.
  const coverControl = (parentIndex: number) => {
    const parent = rendered[parentIndex]
    if (!parent) return undefined
    const parentCovered = isCovered(parentIndex)
    const label = parentCovered
      ? "Uncover previous list (⌘/Ctrl-click: uncover all)"
      : "Cover previous list (⌘/Ctrl-click: cover all)"
    return (
      <button
        type="button"
        onClick={(e) => setCover(parentIndex, e)}
        aria-label={label}
        title={label}
        className="rounded px-1 font-mono text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
      >
        {parentCovered ? (
          <ChevronsRight size={16} aria-hidden className="shrink-0" />
        ) : (
          <ChevronsLeft size={16} aria-hidden className="shrink-0" />
        )}
      </button>
    )
  }

  // Choosing a topic must land the detail IN PLACE — never slide it in from the left edge as the
  // lists re-cover behind it. Only width-driven moves (resize, cover toggle, hover reveal) animate.
  const inPlace = useInPlaceOnStructureChange(structureSignature(rendered))
  const animate = !dragging && !inPlace

  // Selection connectors (shared with the minimized stack). The signature is everything that moves a
  // selected row: the per-level selection and the column layout (left edges + off-screen shift +
  // width); scroll is NOT in it (it re-measures once via `onScroll`).
  const connectorSig = `${rendered.map((l) => l.selectedId ?? "").join("|")}::${left.join(",")}::${offshift}::${containerW}`
  const connectorsPossible = rendered.length >= 2 && rendered.some((l) => l.selectedId != null)
  const { connectors, onScroll } = useSelectionConnectors(
    containerRef,
    rendered.length,
    connectorSig,
    connectorsPossible,
  )

  return (
    // Absolute-positioned stack: lists overlap their children, z-index increases left→right, the
    // detail highest. The lists' `left` and the detail's `left`/`width` animate over 0.3s (the global
    // accessibility CSS zeroes the duration under reduce-motion).
    <div
      ref={containerRef}
      // `onScroll` is the connector re-measure trigger; fire it on pointer / focus movement too so
      // the gap around a row's trash button tracks the button's hover / keyboard-focus reveal.
      onScrollCapture={onScroll}
      onPointerOver={onScroll}
      onPointerOut={onScroll}
      onFocus={onScroll}
      onBlur={onScroll}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      {rendered.map((level, i) => {
        const covered = isCovered(i)
        // Slid off the left edge (phase 2). It stays MOUNTED (so it slides back in when the window
        // grows) but is fully out of the tab order / AT tree while it is gone.
        const offscreen = i < hidden
        // The covered list directly under THIS one (its parent is covered) → cast a left shadow on
        // THIS child so the overlap reads as physical. Index 0 has no parent.
        const parentCovered = i > 0 && isCovered(i - 1)
        // Whole-list reveal: a covered list is rendered at its FULL width but the wrapper is clipped
        // (`overflow-hidden`) to a COVERED_PEEK-wide box, so only the leading icon of each row shows —
        // the same 40px peek. Hovering it WIPES the box open to the full rail width (animated via the
        // `width` transition) above its neighbours (z-lifted); leaving/selecting wipes it shut. The rows
        // are always FULL (never an icon strip), so the wipe reveals the labels with no content swap.
        const revealed = covered && !offscreen && hoverId === level.id
        const zLifted = covered && !offscreen && zLiftId === level.id
        return (
          <div
            key={level.id}
            data-htd-col={i}
            // Reveal on pointer-enter of a covered list; conceal when the pointer leaves it (only
            // disclosed while the mouse is inside it) OR when a row is selected (below).
            onPointerEnter={covered && !offscreen ? () => setHoverId(level.id) : undefined}
            onPointerLeave={() => setHoverId((p) => (p === level.id ? null : p))}
            aria-hidden={offscreen || undefined}
            // React 19 types `inert` as a boolean prop; `undefined` (not false) omits the attribute.
            inert={offscreen || undefined}
            style={{
              left: left[i]! - offshift,
              // Peek → full: the covered box is COVERED_PEEK wide (clipping all but the leading icons) and
              // wipes open to the level's full rail width when revealed; the inner rail stays a fixed
              // railWidth so its rows don't reflow as the box widens.
              width: covered ? (revealed ? railWidth(level) : COVERED_PEEK) : railWidth(level),
              gridTemplateColumns: `${railWidth(level)}px`,
              // z-lift LINGERS through the wipe-shut (zLifted trails hoverId) so the closing box stays
              // above its child instead of dropping behind it mid-animation.
              zIndex: zLifted ? 50 : i + 1,
            }}
            className={cn(
              "absolute top-0 bottom-0 grid overflow-hidden",
              offscreen && "pointer-events-none",
              animate &&
                "transition-[left,width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
              // Shadows ride the WRAPPER (its own box-shadow isn't clipped by its overflow, unlike a
              // child's): a RIGHT shadow while revealed so the lifted list floats over its neighbours
              // (fades out as it wipes shut), else a LEFT shadow when the list under this one is covered
              // so the peek stack reads as layered cards. The two are mutually exclusive.
              revealed
                ? "shadow-[8px_0_24px_-6px_var(--color-shadow)]"
                : parentCovered && "shadow-[-10px_0_22px_-8px_var(--color-shadow)]",
            )}
          >
            <TopicRail
              title={level.title}
              // Rows are ALWAYS full (never an icon strip): the wrapper's clip makes the peek, and the
              // hover wipe reveals the labels — so there is no covered↔full content swap to jar the wipe.
              covered={false}
              isRoot={i === 0}
              // Selection is shown by the dash (root) + connector overlay, not the gold bar.
              selectionStyle="marker"
              items={level.items}
              selectedId={level.selectedId}
              // Selecting a row also drops the hover reveal, so the list animates closed (back to its
              // peek) on click instead of lingering disclosed under the pointer.
              onSelect={(id) => {
                setHoverId(null)
                railOnSelect(level, attemptExit)(id)
              }}
              emptyLabel={level.emptyLabel ?? "Nothing here yet."}
              onNew={level.onNew}
              newLabel={level.newLabel}
              newActive={level.newActive}
              railSlot={level.railSlot}
              headerSlot={level.headerSlot}
              // Covered lists never shrink to an icon strip (no toggle) — but the trailing-border
              // handle DOES resize the rail: drag it to widen/narrow the column.
              collapsed={false}
              onToggle={() => {}}
              onResize={(w) => onResizeLevel(level, w)}
              onResizeStart={() => setDragging(true)}
              onResizeEnd={() => setDragging(false)}
              showToggle={false}
              // The header's leading control slot. On the ROOT list (which has no parent to cover)
              // it is the auto-hide toggle for the whole stack; on every other list it is the
              // `«`/`»` that covers/uncovers THIS list's PARENT (the list to its left).
              leftControl={
                i === 0 ? (
                  <AutoHideToggle autoHide={autoHide} onToggle={toggleAutoHide} />
                ) : (
                  coverControl(i - 1)
                )
              }
              // The layered-card left shadow rides the wrapper (the rail's own shadow would be clipped
              // by the wrapper's overflow), so the rail doesn't draw one.
              coveredShadow={false}
            />
          </div>
        )
      })}
      {/* Selection connectors: gold elbows linking each selected parent row to its selected child
          row, drawn above the lists (so they bridge the list boundary) but pointer-transparent. */}
      <SelectionConnectorOverlay paths={connectors} />
      {/* The detail (leaf) pane — rightmost, highest z-index, fills to the container's right edge
          down to `minDetailWidth`. Its top-left carries the cover toggle for the frontier list. The
          left shadow turns on when its parent (the frontier list) is covered, so the overlap reads
          as physical (token colour via a CSS var, so the colour checker stays clean). */}
      <section
        key="__detail__"
        style={{ left: detailLeft, width: detailWidth, zIndex: rendered.length + 1 }}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col overflow-auto bg-apt-surface",
          animate && "transition-[left,width] duration-300 ease-in-out motion-reduce:transition-none",
          rendered.length > 0 && isCovered(rendered.length - 1) && "shadow-[-10px_0_22px_-8px_var(--color-shadow)]",
        )}
      >
        {/* The frontier list is the detail's "parent": its cover toggle rides the detail's top-left.
            WITH a detailTitle the strip matches the rails' titled-header height (2.15rem) and shows
            the title so the top row aligns across all columns; WITHOUT one it keeps the original
            compact toggle strip, so consumers that don't set detailTitle are unshifted. */}
        {rendered.length > 0 &&
          (detailTitle !== undefined ? (
            <div className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border bg-apt-nav pr-2">
              <div className="flex w-8 shrink-0 items-center justify-center">{coverControl(rendered.length - 1)}</div>
              <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
                {detailTitle}
              </span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center border-b border-apt-border bg-apt-nav px-1.5 py-1.5">
              {coverControl(rendered.length - 1)}
            </div>
          ))}
        {/* Hold the leaf to its min width so it scrolls rather than crushing — but never wider than
            the viewport, so on a phone the form reflows to the full width instead of scrolling. */}
        <div
          className="flex min-h-0 w-full flex-1 flex-col"
          style={{ minWidth: `min(${minDetailWidth}, 100%)` }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}

/** The 3-action unsaved-work prompt the package raises before discarding a dirty leaf editor on
 *  Back / breadcrumb-up / re-click. Built on the shared Dialog so it dims + blurs like every modal. */
function UnsavedChangesModal({
  open,
  busy,
  onSave,
  onDiscard,
  onCancel,
}: {
  open: boolean
  busy: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent showClose={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-apt-gold">
            <TriangleAlert className="size-5 shrink-0 text-apt-red" aria-hidden />
            Unsaved changes
          </DialogTitle>
          <DialogDescription>
            You have unsaved changes. Save them, discard them, or stay to keep editing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive-ghost"
            onClick={onDiscard}
            disabled={busy}
          >
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
