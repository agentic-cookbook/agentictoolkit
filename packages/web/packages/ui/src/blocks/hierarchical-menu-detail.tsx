"use client"

// Hierarchical Menu Details View (HMDV) — the VERTICAL nested-menu ("cascading") experiment,
// extracted verbatim from HierarchicalTopicDetail so the HTDV can stay at its pre-experiment
// shape. HMDV is a self-contained copy of the whole HTDV frame (all four stacks); consumers pick
// the cascade via `disclosureStyle="cascading"`. It carries its OWN module `surfaceStates` map, so
// every HMDV surface coordinates disclosure independently of any HTDV surface. The shared public
// row/level types (`TopicLevel`, `PaneExitGuard`) are owned by HTDV and consumed from the barrel;
// this file re-declares them privately only so the copy compiles standalone. Delete this whole file
// (and its barrel line) to retire the experiment.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
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
import { TopicOverview } from "./topic-overview"
import { useShowDebugFrames, useSlowAnimations, SLOW_ANIM_FACTOR } from "./debug-options"
// The cascade's DECISIONS — the selection chain's weight, the entrance bounce, the exit curve, the
// ground's release rule, the rail-click plan and the detection frames' arming — live there as named,
// pure, TESTED rules rather than as expressions buried in this file. Every one of them was reported,
// fixed, and then silently regressed by a later fix; see that module's header for why they moved out.
import {
  CHAIN_STROKE_PX,
  ENTER_MS,
  EXIT_MS,
  enterKeyframes,
  exitKeyframes,
  mayMoveGround,
  menuRegion,
  planRailSelect,
  pointInRegion,
  triggerRectArmed,
  type MenuRect,
} from "./cascade-rules"

/** A leaf editor's unsaved-work guard. The package consults `isDirty()` before any select that
 *  clears or replaces the open detail (Back / breadcrumb-up / re-click / shallower select / a
 *  sibling swap at the deepest level) and, if dirty, raises a Save/Discard/Cancel prompt; `save()`
 *  resolves true once the draft is persisted so the package may then proceed. */
interface PaneExitGuard {
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

interface TopicLevel {
  /** Stable key for the level (also its collapse-override + React key). */
  id: string
  /** Left-aligned heading naming this list (e.g. "Workspaces", "Ecosystems"), shown above the rows
   *  with a divider beneath. Every level should set one so the lists' rows align vertically. */
  title?: string
  items: TopicDetailItem[]
  selectedId: string | null
  /** OPT-IN landing selection: the item to select the moment this level APPEARS with nothing chosen
   *  — i.e. when the parent topic that opens this list is picked (Work Items → List). It fires this
   *  level's own `onSelect`, so the consumer's state/URL owns the selection exactly as if the row had
   *  been clicked, and everything downstream (breadcrumb, detail, deep link) follows for free.
   *
   *  It arms once per APPEARANCE: a manual deselect INSIDE the same visit sticks (the default must
   *  never fight the user), while leaving the parent topic and coming back re-applies it. Deliberately
   *  narrow — selecting a row still NEVER auto-selects anything at a deeper level unless that level
   *  asks for it here. Omit for the platform default: nothing is chosen for the user. */
  defaultSelectedId?: string
  /** The automatic TOPIC OVERVIEW (default on): while this level is the frontier with nothing
   *  selected, the detail pane shows one card per row (icon + label + `description`) and
   *  clicking a card selects it. Pass `false` for a level whose unselected state has a REAL
   *  landing of its own (ResourceExplorer's searchable entity landing). */
  overview?: boolean
  /** Make `id` the selection at THIS level, keeping ancestors and clearing descendants.
   *  Pure navigation — the package decides WHEN to call it (a click on a not-yet-selected
   *  row, or this level's `defaultSelectedId` when the list appears). */
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
  /** Extra right-justified controls in this level's TITLE row, just ahead of the `+`
   *  (e.g. the Sites list's Auto Configure). Keep them compact — the row is one line. */
  titleActions?: ReactNode
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

/**
 * What the stack looks like right now, as opposed to what it is showing: the auto-hide toggle, the
 * per-list `«`/`»` pins, and the list whose branch the pointer currently holds open.
 */
type SurfaceState = {
  autoHide: boolean
  pins: Record<string, boolean>
  hoverId: string | null
  /** How the open reveal was rooted: a pointer ENTER opens EVERY on-screen list (`true`), the
   *  covering CLICK opens only the clicked list's own branch (`false`) — a click on a visible row
   *  must never spring the user's collapsed parents open (must-not-expand-parents-on-select). */
  hoverAll: boolean
  /** NARROW mode: the pane index the stack was last PAINTED at. The slide animates from here to
   *  wherever the new selection puts the top pane — and since selecting is a route change that
   *  remounts everything, a pane would otherwise mount already at its final position with nothing to
   *  transition FROM, which is why the push and pop never animated in the app. `null` = never painted
   *  (a fresh load lands where it lands; there is nothing to slide from). */
  narrowTop: number | null
  /** Per level: the appearance its `defaultSelectedId` has already been applied for (see the frame).
   *  Remembering this is what lets a manual clear stick — and it must outlive the mount for the same
   *  reason everything else here does: clearing the row IS a route change, so a per-instance memory
   *  would forget it was ever fired and immediately re-select the row the user just cleared. */
  autoSelected: Record<string, string>
}

/**
 * That state per SURFACE, keyed by the stack's root level id — deliberately OUTSIDE React.
 *
 * Selecting a row inside the stack is a route change, and a route change REMOUNTS the page subtree
 * (Next re-creates it on a param nav). Anything the frame held in component state was therefore
 * destroyed by the user's own click, which produced two bugs that look unrelated and are the same
 * one: the lists you had just opened all snapped shut with the auto-hide toggle flipped back on
 * under you, and a revealed branch collapsed the instant you picked a row inside it — with the
 * pointer still sitting in it, so nothing would reopen it. None of this belongs to a mount: it
 * belongs to the SURFACE the user is looking at, and it has to outlive the click.
 *
 * Module scope gives exactly that lifetime. It does NOT survive a reload, which is the right seam —
 * a fresh load is a deliberate fresh start, and it keeps the frame free of storage and hydration
 * concerns. Writes only ever happen in event handlers, so SSR never touches this map.
 */
const surfaceStates = new Map<string, SurfaceState>()

export function HierarchicalMenuDetail({
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
  layoutMode = "auto",
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
   *      stack read as physically layered. No Back button.
   *   - `"cascading"` — a VERTICAL cascade (nested-menu layout): only the ROOT list is full
   *      height. Each deeper list opens to the RIGHT of its parent, its TOP just under the
   *      parent's HEADER (one header-height step per level), and its height HUGS its own rows
   *      (capped at the container bottom, scrolling past it). The detail pane is pinned BESIDE the
   *      root list, and the deeper lists disclose OVER it like menus over content. Covering —
   *      auto-hide, the `«`/`»` pins, width pressure, the hover branch reveal — follows
   *      `covered`'s rules, but a covered list is never resized: its child simply draws OVER it
   *      (back-to-front z-order), indented so the covered rows' text is obscured while their icons
   *      and full HEADER row stay visible. The detail strip's `«` immerses the detail: every list
   *      slides off-screen and the detail takes the full width (`»` restores). */
  disclosureStyle?: "minimized" | "covered" | "cascading"
  /** Start with every list above the FRONTIER (the deepest rendered list) hidden — covered by its
   *  child to a peek (`covered`), overdrawn by its child down to its header row (`cascading`), or
   *  an icon strip (`minimized`) — even
   *  when there is room to show it. Default `true`; the first list's header carries a toggle so
   *  the user can flip it (off ⇒ every list discloses, subject to the fit rules). Pass `false`
   *  for a surface whose ancestry must stay glanceable (the hub's `/home`). The covering styles
   *  never snap a list shut under the cursor: the click that covers a list also roots the branch
   *  reveal at it (the pointer is still inside), so the new choosing list slides out floating
   *  over the detail, and the stack settles when the pointer leaves. */
  autoHideTopics?: boolean
  /** WIDE (lists beside the detail, `disclosureStyle` above) vs NARROW (one full-width pane at a
   *  time, pushed/popped like an iOS `UINavigationController`). Default `"auto"`: narrow when only a
   *  detail can fit — the container is narrower than one topic list plus `minDetailWidth` — or the
   *  browser is a phone. `"wide"` / `"narrow"` force one (for a showcase or a test). */
  layoutMode?: "auto" | "wide" | "narrow"
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
  //   autoHide — only the FRONTIER list (the deepest rendered one) stays disclosed; every list
  //              above it is hidden by its child even when there IS room. The frame's default;
  //              the root list's header toggles it. (The covered style keeps a freshly covered
  //              list open under the pointer that clicked it — see the branch reveal.)
  //   pins     — per-level user intent from the `«`/`»` toggles, overriding autoHide either way
  //              (true = keep hidden, false = keep disclosed). Width pressure may still hide a list
  //              the user pinned open — there is no room — but never discloses one they pinned shut.
  // Flipping autoHide CLEARS the pins: turning it on hides every parent that was disclosed; turning
  // it off discloses every list that fits (the fit rules then re-hide whatever doesn't).
  //
  // These live in the module store (see `surfaceStates`), NOT in component state, because a click in
  // the stack is a route change and a route change remounts this whole subtree — component state
  // would be destroyed by the very click that must not disturb it. Keyed by the ROOT list, the one
  // level a surface keeps across its own navigations. The key resolves late where a host registers
  // its levels in an effect (the first render has none), which is harmless: there is nothing to
  // toggle or hover before the stack exists.
  const surfaceKey = levels[0]?.id ?? ""
  const [, bumpSurface] = useReducer((n: number) => n + 1, 0)
  const surface = surfaceStates.get(surfaceKey) ?? {
    autoHide: autoHideTopics,
    pins: {},
    hoverId: null,
    hoverAll: false,
    narrowTop: null,
    autoSelected: {},
  }
  const { autoHide, pins, hoverId, hoverAll } = surface
  // Always patch from what is IN the store, never from the render's snapshot: a remount replays this
  // component around state that outlived it, so a closed-over `surface` can be a render behind.
  const patchSurface = useCallback(
    (update: (prev: SurfaceState) => SurfaceState) => {
      if (!surfaceKey) return
      const prev = surfaceStates.get(surfaceKey) ?? {
        autoHide: autoHideTopics,
        pins: {},
        hoverId: null,
        hoverAll: false,
        narrowTop: null,
        autoSelected: {},
      }
      surfaceStates.set(surfaceKey, update(prev))
      bumpSurface()
    },
    [surfaceKey, autoHideTopics],
  )
  // Flipping the mode also DROPS any open reveal: a revealed group renders at full width no
  // matter what autoHide says, so with the pointer parked inside it the flip would change
  // nothing on screen until the pointer happened to leave — the toggle read as dead. Closing
  // the reveal settles the stack to the new mode on the click itself
  // (must-apply-disclosure-toggles-immediately).
  const toggleAutoHide = useCallback(
    () =>
      patchSurface((p) => ({
        ...p,
        autoHide: !p.autoHide,
        pins: {},
        hoverId: null,
        hoverAll: false,
      })),
    [patchSurface],
  )
  const setPins: Dispatch<SetStateAction<Record<string, boolean>>> = useCallback(
    (update) =>
      patchSurface((p) => ({
        ...p,
        pins: typeof update === "function" ? update(p.pins) : update,
      })),
    [patchSurface],
  )
  const setHoverId = useCallback(
    (id: string | null, all = false) =>
      patchSurface((p) => ({ ...p, hoverId: id, hoverAll: id === null ? false : all })),
    [patchSurface],
  )
  const setNarrowTop = useCallback(
    (i: number) => patchSurface((p) => (p.narrowTop === i ? p : { ...p, narrowTop: i })),
    [patchSurface],
  )

  // A level's OPT-IN `defaultSelectedId`: select it for the user the moment the list appears with
  // nothing chosen. Fired as the level's own `onSelect`, so it is indistinguishable from a click.
  //
  // Armed per APPEARANCE, which is the whole subtlety. The arming key is the ancestor selections that
  // produced this list, remembered per level (in the surface store, because applying or clearing the
  // selection is itself a route change that remounts this component — a per-instance memory would
  // forget it had fired and re-select the row the user just cleared, making the row undeselectable):
  //   - the list is not rendered at all (its parent is unselected) → DISARM, so the next visit fires;
  //   - already fired for this key and the user has since cleared the row → stay disarmed. The
  //     default may choose FOR the user, never argue WITH them.
  // A default naming an item the list doesn't have (yet) is simply not applied — an async list arms
  // when its rows land, and a stale default never selects a phantom row.
  useEffect(() => {
    levels.forEach((level, i) => {
      const wanted = level.defaultSelectedId
      if (wanted == null) return
      if (i > frontier) {
        // The list is gone (its parent is unselected): re-arm it for the next visit.
        if (surface.autoSelected[level.id] !== undefined) {
          patchSurface((p) => {
            const next = { ...p.autoSelected }
            delete next[level.id]
            return { ...p, autoSelected: next }
          })
        }
        return
      }
      if (level.selectedId != null) return
      if (!level.items.some((it) => it.id === wanted)) return
      const key = `${levels
        .slice(0, i)
        .map((l) => l.selectedId ?? "")
        .join("|")}::${wanted}`
      if (surface.autoSelected[level.id] === key) return // fired for this visit; a manual clear stands
      patchSurface((p) => ({ ...p, autoSelected: { ...p.autoSelected, [level.id]: key } }))
      level.onSelect(wanted)
    })
  })

  // ONE measurement of the row, owned by the frame: it decides WIDE vs NARROW, and the covered stack
  // reuses it for its fit math (so there is still a single disclosure controller). `useLayoutEffect`
  // inside takes the first measurement before paint, so a narrow container never flashes the wide
  // layout on its first frame.
  const rowRef = useRef<HTMLDivElement>(null)
  const containerW = useContainerWidth(rowRef)
  const phone = usePhoneUserAgent()
  // NARROW = "only a details view fits": the container can't hold ONE full topic list beside a
  // minimum-width detail. A phone is always narrow regardless of the box it is given. Until the first
  // measurement lands (containerW === 0) we assume wide — the layout effect corrects it pre-paint.
  const narrow =
    layoutMode === "narrow" ||
    (layoutMode === "auto" &&
      (phone || (containerW > 0 && containerW < minDetailPx(minDetailWidth) + FULL_RAIL)))

  // THE AUTOMATIC TOPIC OVERVIEW: while the frontier list has no selection, the detail pane is the
  // standard overview — one card per row (icon + label + description); clicking a card selects it —
  // for EVERY stack, instead of whatever placeholder the host passed as children. It exists ONLY in
  // that state: the moment the frontier gains a selection the host's real detail (children) shows.
  // A level whose unselected state has a real landing of its own opts out (`overview: false`).
  // Titled by the parent's selected row (the entity whose topics these are), else the level's title.
  const frontierLevel = firstUnselected === -1 ? null : levels[firstUnselected]
  const parentOfFrontier = firstUnselected > 0 ? levels[firstUnselected - 1] : null
  const overviewTitle =
    parentOfFrontier?.items.find((it) => it.id === parentOfFrontier.selectedId)?.label ??
    frontierLevel?.title
  const overview =
    frontierLevel && frontierLevel.overview !== false && frontierLevel.items.length > 0 ? (
      <TopicOverview
        title={overviewTitle}
        items={frontierLevel.items}
        onSelect={(id) => frontierLevel.onSelect(id)}
      />
    ) : null
  // `children` stay MOUNTED under the overview AND in the SAME tree position: in a merged stack
  // the deeper levels are PUBLISHED by components living in children (StackLevels), so unmounting
  // them would unregister the very frontier level this overview is for. The wrapper is therefore
  // ALWAYS present and only its visibility toggles — conditionally re-parenting children into it
  // IS a remount (React reconciles by position), which resets their state and unregisters their
  // levels, looping the stack between the two states (a mount/fetch storm, found live). Inline
  // display (not the `hidden` attribute) so the flex utility class can't override it.
  const detail = (
    <>
      {overview}
      <div
        style={overview ? { display: "none" } : undefined}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {children}
      </div>
    </>
  )

  // The layouts share the same selection / breadcrumb / exit-guard semantics above and differ ONLY in
  // how the lists yield room to the detail — so each is its own subcomponent owning its layout state
  // (kept distinct so any one can evolve or be deleted independently).
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
    hoverId,
    hoverAll,
    setHoverId,
    narrowTop: surface.narrowTop,
    setNarrowTop,
    containerW,
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
      {/* The measured row. Every stack fills it, so ONE ResizeObserver here is the whole view's
          width signal — the mode decision above and the covered stack's fit math below. */}
      <div ref={rowRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {narrow ? (
          <NarrowStack {...stackProps} levels={levels}>
            {detail}
          </NarrowStack>
        ) : disclosureStyle === "minimized" ? (
          <MinimizedStack {...stackProps} levels={levels} manualCollapse={manualCollapse}>
            {detail}
          </MinimizedStack>
        ) : disclosureStyle === "cascading" ? (
          <CascadingStack {...stackProps}>{detail}</CascadingStack>
        ) : (
          <CoveredStack {...stackProps}>{detail}</CoveredStack>
        )}
      </div>

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

// The cascading style's cover indent: how far a covering child sits RIGHT of the list it covers.
// Deliberately tighter than COVERED_PEEK and sized to the rail's row anatomy (border 2 + pl-2 8 +
// icon 16 + gap-2 8 → text starts at 34px): the child obscures every covered row's TEXT while the
// leading icons stay visible.
const CASCADE_INDENT = 32

// The cascading detail's reserved key in the shared `pins` record (no topic level can collide with
// it — it is the detail section's own React key): pinned true = the detail is IMMERSED, every list
// off-screen (see CascadingStack).
const DETAIL_PIN = "__detail__"

// (The selection chain's weight, the entrance bounce, the exit curve, the ground's release rule and
// the rail-click decision are imported from `cascade-rules` at the top of this file.)

/** Per-surface cascade memory that MUST SURVIVE A REMOUNT, keyed by the root level's id exactly like
 *  `surfaceStates`.
 *
 *  Next remounts the whole page subtree when a ROUTE PARAM changes — and choosing a different
 *  workspace in the root list IS a param change (`/[slug]/…`). React state therefore resets in the
 *  middle of one continuous interaction, which is invisible in the code but very visible on screen:
 *  the entrance loses all knowledge of which menus were already open and concludes "first mount,
 *  animate nothing", and the ground latch re-seeds from whatever the layout happens to be at mount
 *  and snaps the root's width. Both bugs are the same bug, so both live here.
 *
 *  Deliberately NOT folded into `surfaceStates`: that store is React state and every write re-renders
 *  the surface. These two are a cache read during render and written from effects — they must never
 *  drive a render of their own. */
const cascadeMemory = new Map<
  string,
  {
    /** Menu keys on screen at the last commit — `null` until primed. Primed-but-empty and never-primed
     *  must stay distinguishable: on a genuine first load nothing was "opened", so nothing animates. */
    seenKeys: Set<string> | null
    /** Last ground right edge observed with the stack settled; `null` until one has been seen. */
    groundRight: number | null
    /** Was the pointer last seen inside the menu region? Out here for the same reason as `groundRight`
     *  — and it is load-bearing WITH it, not merely adjacent. The menus are held open while the pointer
     *  is in the region, and the click that must hold them is USUALLY THE REMOUNT ITSELF (choosing a
     *  row is a route-param change). Component state would therefore reset to "outside" on exactly the
     *  frame the hold matters, freeing the ground AND dropping the reveal — the bug this whole layer
     *  exists to stop. `false` before any pointer has been seen: a deep link has no pointer in the
     *  stack, and its first paint must take the real width. */
    pointerInMenus: boolean
    /** The selection the detail pane last painted, so its fade can tell "became a different detail"
     *  from "mounted". `null` until first painted — and it must live out here for the same reason as
     *  `seenKeys`: choosing a row IS the param change that remounts the subtree, so component state
     *  would forget on precisely the transition that must animate. */
    detailToken: string | null
    /** The width-pressure covering (`pressure` + off-screen `hidden`) observed with the stack SETTLED
     *  — i.e. the last time the pointer was OUT of the menus. Held and reused while the pointer is IN
     *  the menus, for the SAME reason as `groundRight`: choosing a row that publishes a NEW level
     *  re-covers the leftmost lists to make room, sliding the whole cascade LEFT under the pointer
     *  mid-gesture. `groundRight` alone can't stop it — it pins the root's WIDTH and the detail's edge,
     *  not the columns' x. This is the column analogue: `mayMoveGround`'s rule is that the layout
     *  settles only once the pointer has left, and this holds the covering to that same rule. `null`
     *  until a settled paint has been seen. */
    heldCover: { pressure: number; hidden: number } | null
  }
>()
const cascadeMemoryFor = (key: string) => {
  const existing = cascadeMemory.get(key)
  if (existing) return existing
  const fresh = {
    seenKeys: null,
    groundRight: null,
    detailToken: null,
    pointerInMenus: false,
    heldCover: null,
  }
  cascadeMemory.set(key, fresh)
  return fresh
}
// The beat between one menu's exit and the next when a whole branch closes (see `exitBranch`). Short
// enough that the collapse still reads as ONE gesture rather than a queue of separate closes — the
// menus overlap heavily, since each runs for EXIT_MS.
const EXIT_STAGGER_MS = 70

/** How long the detail's content takes to fade in when it becomes a DIFFERENT detail (see
 *  `DetailContent`). */
const DETAIL_FADE_MS = 220

// How long an exit waits for React to unmount the column before deciding the clear no-opped and making
// the menu visible again (see `exitCol`'s `finish`). Generous on purpose: `onClear` is often a route
// change, and restoring while one is still in flight is the flash this guards against.
const EXIT_RESTORE_GIVEUP_MS = 2000

// NOTE — nothing in this component is gated on `prefers-reduced-motion`, per a standing instruction
// from this block's owner to ignore that setting until further notice. It is NOT a claim about
// anyone's OS configuration; keep it that way unless he lifts the instruction.

// The z-floor of a hover-revealed branch: its members lift to REVEAL_Z + i so the whole cascade
// floats over the detail. The connector overlay rides just above the highest member (see below), so
// the gold selection chain still crosses the branch it links.
const REVEAL_Z = 50

/** The union of every on-screen MENU box, in viewport coords — the one measurement BOTH mouse
 *  -detection rects in `CascadingStack` are built from, so they can never disagree about where the
 *  menus end. `right`/`bottom` are the union's far edges: as wide as the widest and AS TALL AS THE
 *  TALLEST menu (Mike), spanning the gaps between them (a bounding box over the boxes — crossing a
 *  seam must not flicker the stack).
 *
 *  The full-height ROOT (`data-htd-col="0"`) is EXCLUDED: it runs to the container's bottom, so
 *  including it would drag the union down to the window's edge — a vast dead region below the menus.
 *  Nothing is lost, because both rects start at the container's top-left and the root's ROWS sit at
 *  the very top with the submenus always hanging lower; only the root's empty ground below the
 *  deepest menu falls outside, which is exactly the region that should read as "out".
 *
 *  Null when no menu is measurable. */
function menuUnion(cont: HTMLElement): { right: number; bottom: number } | null {
  let right = -Infinity
  let bottom = -Infinity
  cont.querySelectorAll<HTMLElement>("[data-htd-col]").forEach((col) => {
    if (col.getAttribute("aria-hidden")) return // off-screen / immersed columns don't count
    if (col.getAttribute("data-htd-col") === "0") return // the full-height root — see above
    const rc = col.getBoundingClientRect()
    // A zero-size box is a menu mid-entrance (scaled to a point) — it would drag the union in to its
    // origin, so let the caller's settle re-measure pick it up at full size instead.
    if (rc.width === 0 || rc.height === 0) return
    right = Math.max(right, rc.right)
    bottom = Math.max(bottom, rc.bottom)
  })
  return right === -Infinity ? null : { right, bottom }
}

/**
 * THE SINGLE AUTHORITY for "is the pointer in the menus?" — the layer whose absence made choosing a
 * row auto-collapse the cascade (Mike). It governs both the ground latch and whether the reveal is
 * held, and it is the ONE thing (with the explicit `«/»` toggles) that may close a reveal. See
 * `cascade-rules`' `menuRegion` for the full why; in short, the two used to be computed separately
 * and both from stale sources — `hoverIndex >= 0` (width pressure, a beat late) against an
 * effect-measured `revealRect` (a render behind) — on precisely the remount a click triggers.
 *
 * The fix is to read the region FRESH from the DOM inside the pointer handler, so the test is never
 * against a stale rect: only a real `pointermove` whose coordinates fall outside what is painted NOW
 * can report "left the menus". If the pointer never moves after a click, nothing ever closes — which
 * is exactly "clicking does nothing; only the mouse leaving collapses".
 *
 * Seeded from `mem` across the remount (a fresh `false` would report "left" on the click's own frame),
 * and it keeps a measured rect in state PURELY for the debug overlay to draw — never for hit-testing.
 */
function usePointerInMenus(
  containerRef: RefObject<HTMLDivElement | null>,
  mem: { pointerInMenus: boolean },
  regionSig: string,
): { pointerInMenus: boolean; regionRect: MenuRect | null } {
  const readRegion = useCallback((): MenuRect | null => {
    const cont = containerRef.current
    if (!cont) return null
    const rects: MenuRect[] = []
    cont.querySelectorAll<HTMLElement>("[data-htd-col]").forEach((col) => {
      if (col.getAttribute("aria-hidden")) return // off-screen / immersed columns are not "the menus"
      const r = col.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return // a menu mid-entrance (scaled to a point)
      if (col.getAttribute("data-htd-col") === "0") {
        // The ROOT column is FULL HEIGHT (it is the ground the cascade sits on), but the menus occupy
        // only its ROWS — everything below is empty ground where the detail shows through. Contribute
        // the rows' bottom, not the box's, so the region ends where the menus end and moving down onto
        // the detail reads as leaving them. Clamp to the box bottom so a long, scrolling root (whose
        // last row is scrolled past the cut) still counts only to where it is actually cut off.
        const rows = col.querySelectorAll<HTMLElement>("[data-htd-row]")
        const last = rows[rows.length - 1]
        const bottom = last ? Math.min(last.getBoundingClientRect().bottom, r.bottom) : r.top
        rects.push({ left: r.left, top: r.top, right: r.right, bottom })
        return
      }
      rects.push(r) // a submenu already hugs its rows (height-capped), so its box IS its content
    })
    return menuRegion(rects, cont.getBoundingClientRect())
  }, [containerRef])

  const [pointerInMenus, setPointerInMenus] = useState(() => mem.pointerInMenus)
  useEffect(() => {
    // Coalesce to ONE region read per animation frame: this is a document-wide pointermove, and
    // `readRegion` calls `getBoundingClientRect`, which forces a synchronous reflow while the cascade
    // is animating. Reading once per frame bounds that to at most one reflow per frame no matter how
    // fast the pointer moves — and it is still FRESH (the frame reads live layout, never a React state
    // value that lags a render), which is the whole reason the old effect-measured rect raced.
    let raf = 0
    let last: { x: number; y: number } | null = null
    const flush = () => {
      raf = 0
      if (!last) return
      const region = readRegion()
      const inside = region != null && pointInRegion(region, last.x, last.y)
      mem.pointerInMenus = inside // survives the remount; the state only drives THIS render
      setPointerInMenus((prev) => (prev === inside ? prev : inside))
    }
    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      if (raf === 0) raf = requestAnimationFrame(flush)
    }
    document.addEventListener("pointermove", onMove)
    return () => {
      document.removeEventListener("pointermove", onMove)
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [readRegion, mem])

  // A measured rect for the DEBUG overlay ONLY (never hit-testing — that reads fresh above). Re-measured
  // when the layout signature changes and once more after the width transition settles.
  const [regionRect, setRegionRect] = useState<MenuRect | null>(null)
  useLayoutEffect(() => {
    const measure = () =>
      setRegionRect((prev) => {
        const next = readRegion()
        return prev &&
          next &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.right === next.right &&
          prev.bottom === next.bottom
          ? prev
          : next
      })
    measure()
    const raf = requestAnimationFrame(measure)
    const settle = setTimeout(measure, 340)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [readRegion, regionSig])

  return { pointerInMenus, regionRect }
}

/**
 * The detail pane's content, FADED IN whenever it becomes a different detail (Mike) — swapping from
 * one leaf to another was previously a hard cut.
 *
 * This fades the incoming content in; it does NOT hold the outgoing content on screen to dissolve
 * between the two. That is deliberate. The host owns whatever is in here — CSS editors, forms, live
 * queries — and the only two ways to keep the old picture through the swap both make it worse:
 * rendering the outgoing element a second time MOUNTS IT AGAIN (a second editor booting from scratch,
 * so the "old" half of the dissolve would be a blank pane, not the thing that was there), and cloning
 * the subtree copies markup but not the pixels — a canvas or an editor's viewport clones empty. So the
 * incoming leaf rises over the pane's own surface, which is what is behind it either way.
 *
 * Imperative, like the menu entrance, so the start frame is flushed before the transition is armed —
 * and so the swap never depends on a `key`, which would remount the host's content on every selection
 * and throw away exactly the state it is being asked to preserve.
 */
function DetailContent({
  token,
  minWidth,
  mem,
  children,
}: {
  token: string
  minWidth: string
  mem: { detailToken: string | null }
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const slowAnimations = useSlowAnimations()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const prev = mem.detailToken
    mem.detailToken = token
    // Never primed = a genuine first paint: the detail did not BECOME anything, so fading it in would
    // be an unasked-for intro on load. Unchanged = a re-render that is not a swap.
    if (prev === null || prev === token) return
    const ms = DETAIL_FADE_MS * (slowAnimations ? SLOW_ANIM_FACTOR : 1)
    el.style.transition = "none"
    el.style.opacity = "0"
    void el.offsetWidth // flush the start state so the transition has something to run FROM
    el.style.transition = `opacity ${ms}ms ease-in-out`
    el.style.opacity = "1"
    const done = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "opacity") return
      el.removeEventListener("transitionend", done)
      el.style.transition = ""
      el.style.opacity = ""
    }
    el.addEventListener("transitionend", done)
    return () => el.removeEventListener("transitionend", done)
  }, [token, mem, slowAnimations])
  return (
    /* Hold the leaf to its min width so it scrolls rather than crushing — but never wider than the
       viewport. */
    <div
      ref={ref}
      className="flex min-h-0 w-full flex-1 flex-col"
      style={{ minWidth: `min(${minWidth}, 100%)` }}
    >
      {children}
    </div>
  )
}

/** DEV-ONLY overlay: one labelled mouse-detection rectangle (see the debug frames block in
 *  CascadingStack). Inert and `fixed`, because the rects are measured in viewport coords.
 *
 *  `armed` is the whole point of the overlay (must-draw-every-detection-frame). A region that exists
 *  but is currently INERT is drawn dashed and labelled "off" rather than omitted: "no rect on screen"
 *  and "the rect is disarmed, so nothing can trigger it" look identical when the answer is to draw
 *  nothing — and the second one is the diagnosis. Omitting them is how the trigger rect sat dead for
 *  a whole round (nothing was covered, so there was nothing to disclose) and read as a broken switch. */
function DebugFrame({
  rect,
  color,
  label,
  armed,
}: {
  rect: MenuRect
  color: string
  label: string
  armed: boolean
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: Math.max(0, rect.right - rect.left),
        height: Math.max(0, rect.bottom - rect.top),
        border: `1px ${armed ? "solid" : "dashed"} ${color}`,
        opacity: armed ? 1 : 0.55,
        pointerEvents: "none",
        zIndex: 2147483647,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: color,
          color: "#000",
          font: "9px/1.4 ui-monospace, monospace",
          padding: "0 3px",
        }}
      >
        {armed ? label : `${label} (off)`}
      </span>
    </div>
  )
}

// The card edges of the covered stack — the boundary a clipped peek's own `border-r` cannot draw.
// (Colour via a CSS var so the no-raw-hex colour checker stays clean.)
const SHADOW_RIGHT = "8px 0 24px -6px var(--color-shadow)"
const SHADOW_LEFT = "-10px 0 22px -8px var(--color-shadow)"

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

/** The measured width of `ref`'s element, tracked by a ResizeObserver. `useLayoutEffect` (not
 *  `useEffect`) takes the FIRST measurement before the browser paints, so a layout gated on the width
 *  — the wide/narrow mode, the covered stack's fit math — never flashes a wrong first frame. */
function useContainerWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth((prev) => (prev === el.clientWidth ? prev : el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/** A phone browser — iOS or Android. Phones take the NARROW layout at any width: the wide layout's
 *  peeks and cover toggles are pointer affordances, and a phone has no pointer. Tablets and desktops
 *  are NOT phones (iPadOS reports a desktop UA anyway) — they go by width, so a narrow window on a
 *  big screen behaves like a phone and a wide one doesn't.
 *
 *  Read AFTER mount (not during render): the server has no user agent, so branching the first render
 *  on it would be a hydration mismatch. Width alone already picks NARROW on a phone-sized viewport,
 *  so the post-mount flip is only for the odd phone with a wide layout viewport. */
function usePhoneUserAgent(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const ua = navigator.userAgent
    setPhone(/iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua)))
  }, [])
  return phone
}

/** The selection wiring shared by both stacks. Any select that would clear or replace
 *  the open deeper detail is exit-guarded: re-clicking the selected row (deselects this
 *  level), AND selecting a DIFFERENT row in a level that already has a selection —
 *  whether an ancestor (clears everything below) or the deepest selected level itself
 *  (a sibling swap that replaces the open leaf editor). Only a forward drill-down into a
 *  not-yet-selected level (`selectedId == null`) is unguarded: there is no open detail to
 *  lose. Because selections are contiguous from the top, `selectedId != null` is exactly
 *  "this level is at or above the deepest selection".
 *
 *  `exit` runs the change through the caller's close animation, which must finish while the menus
 *  are still mounted (see `exitCol`) — so it takes the real navigation as a callback rather than
 *  returning. Default: run it immediately. Only the cascade passes one; the covering and minimized
 *  styles grow no menu out of the clicked row, so they have no entrance to reverse.
 *
 *  WHICH clicks animate is `planRailSelect`'s call, not this function's — see `cascade-rules`. The
 *  short version: BOTH a re-click (clear) and a swap to a different row destroy every menu below
 *  this level, so both collapse them first; only a forward drill into an unselected level skips it,
 *  having nothing open below to take away. Routing just the clear through `exit` — as this did — is
 *  why switching workspace made the whole cascade vanish in one frame. */
function railOnSelect(
  level: TopicLevel,
  attemptExit: (action: () => void) => void,
  exit: (proceed: () => void) => void = (proceed) => proceed(),
) {
  return (id: string) => {
    const plan = planRailSelect(level.selectedId ?? null, id)
    const navigate = () => (plan.action === "clear" ? level.onClear() : level.onSelect(id))
    const run = () => (plan.collapse ? exit(navigate) : navigate())
    return plan.guarded ? attemptExit(run) : run()
  }
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
  /** The covered list whose BRANCH the pointer is holding open (the reveal's root), or null. Owned by
   *  the frame's surface store, not by the stack, so a selection — which remounts this subtree — can't
   *  yank the branch shut from under a pointer that is still inside it. */
  hoverId: string | null
  /** True when the open reveal was rooted by a pointer ENTER (expand EVERY on-screen list); false
   *  for the covering-click root (only the clicked list's own branch — parents stay put). */
  hoverAll: boolean
  setHoverId: (id: string | null, all?: boolean) => void
  /** NARROW mode's animation origin — the pane index last painted (see `SurfaceState.narrowTop`), and
   *  the setter that records the pane the stack has now settled on. */
  narrowTop: number | null
  setNarrowTop: (i: number) => void
  /** The row's measured width (the frame's single ResizeObserver); 0 until the first measurement. */
  containerW: number
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
  /** When the child list is open with NOTHING selected, connect to the LIST ITSELF (see the loop).
   *  Opt-in: only the cascade wants it; the other stacks keep drawing nothing. */
  anchorUnselectedChild = false,
  /** How long to keep re-measuring after `sig` changes — long enough to cover whatever motion that
   *  change starts. Default 400ms: the lists slide over ~0.3s. The cascade raises it to cover a
   *  staggered branch collapse, which runs longer and is driven imperatively. */
  trackMs = 400,
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
      // The whole child COLUMN as a connector target: its left edge, at the point NEAREST the
      // parent's row (Mike) — the row's own height, clamped to the column's vertical span. The
      // parent's row is usually already beside the list, so this is normally a straight horizontal
      // run with no bend at all; it only elbows when the row sits above or below the list, and then
      // only as far as the nearer end. (Aiming at the column's CENTRE instead made every connector
      // bend, and the deeper the cascade the longer the pointless vertical run.)
      const colAnchor = (i: number, fromY: number) => {
        const col = cont.querySelector(`[data-htd-col="${i}"]`)
        if (!col) return null
        const r = col.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return null // mid-entrance (scaled to a point)
        const top = r.top - crect.top
        const bottom = r.bottom - crect.top
        return { y: Math.min(Math.max(fromY, top), bottom), left: r.left - crect.left }
      }
      const next: string[] = []
      for (let i = 0; i < levelCount - 1; i++) {
        const p = anchor(i)
        if (!p) continue
        const c = anchor(i + 1)
        // A connector normally joins a selected PARENT row to a selected CHILD row. When the child
        // list is open with NOTHING selected, the ORIGINAL rule drew nothing (spec:
        // must-connect-selected-rows-only — a line pointing at whatever row happens to sit at the
        // parent's height reads as a phantom selection). The cascade now instead points at the
        // SUBMENU AS A WHOLE (Mike): it lands ON the list's left edge, at the point nearest the
        // parent's row, where that list's gold rail runs. That keeps the parent→child chain visible
        // while a branch is being chosen from, and it cannot be misread as a row selection because it
        // never enters the list or touches a row — the rail it meets spans the list's whole height.
        const cc = c ?? (anchorUnselectedChild ? colAnchor(i + 1, p.y) : null)
        if (!cc) continue
        if (p.rightX < 0 || cc.left > crect.width) continue // an endpoint drilled off-screen
        const boundary = cc.left // the child column's current left edge (the bend)
        const startX = Math.min(p.rightX + 6, boundary - 4) // just past the parent's visible content
        // The elbow after the parent's horizontal run: to the child column's edge (the bend), then
        // down/up to the target. With a selected child row it carries on IN to just before that row's
        // icon; with no selection it STOPS on the edge, meeting the rail.
        const tail = c ? ` L ${Math.max(c.iconLeft - 6, boundary + 2)} ${c.y}` : ""
        const elbow = `L ${boundary} ${p.y} L ${boundary} ${cc.y}${tail}`
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
      if (performance.now() - start < trackMs) raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [containerRef, levelCount, sig, possible, trackMs])
  return { connectors, onScroll: () => measureRef.current() }
}

/**
 * The SVG overlay that draws the measured connector paths above the columns (pointer-transparent).
 * `zIndex` must beat EVERY column it crosses: the default clears the ordinary stack, but a covered
 * stack whose hover-revealed branch is z-lifted over the detail has to lift the overlay with it —
 * otherwise the branch paints over its own connectors and the selection chain vanishes on hover.
 */
function SelectionConnectorOverlay({ paths, zIndex = 30 }: { paths: string[]; zIndex?: number }) {
  if (paths.length === 0) return null
  return (
    <svg
      aria-hidden
      data-htd-connectors
      style={{ zIndex }}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      // THE CHAIN IS ONE LINE (must-draw-one-chain-line): these strokes must be indistinguishable
      // from the selected row's `border-l-2` and the submenu's gold rail — both CSS boxes, both
      // crisp. Matching the WIDTH alone did not do it: an anti-aliased stroke spreads 2px of gold
      // across 3 device pixels at partial alpha, so it came out both softer and DIMMER than the
      // borders beside it, and read as a different gold. Every path here is axis-aligned (horizontal
      // runs, vertical elbows), so snapping to the pixel grid costs nothing and buys exact parity.
      // `crispEdges` also makes round caps/joins meaningless — hence their absence below.
      shapeRendering="crispEdges"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" className="stroke-apt-gold" strokeWidth={CHAIN_STROKE_PX} />
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
}: Omit<StackProps, "containerW"> & { levels: TopicLevel[]; manualCollapse: boolean }) {
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
  // Intent: the user's pin (`«`) if they set one, else auto-hide's default (every list above the
  // FRONTIER). This style has no floating reveal — a hidden list is an icon strip, still visible
  // and clickable — so the parent goes straight to its strip when a selection pushes a new list.
  // Width pressure (`auto`) only ever ADDS a collapse on top of this.
  const pinnedOrAutoHidden = (level: TopicLevel, i: number) =>
    override[level.id] ?? (autoHide && i < frontier)
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
        animate && "transition-[grid-template-columns] duration-[calc(200ms*var(--apt-anim-scale,1))] ease-out",
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
              titleActions={level.titleActions}
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
  hoverId,
  hoverAll,
  setHoverId,
  containerW,
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
  // Whole-BRANCH hover reveal: hovering a covered (peeking) list opens it AND every list below it —
  // the hovered list and its children, side by side, floating over the detail. `hoverId` names the
  // list the pointer opened (the reveal's ROOT); the group is that list and everything to its right.
  //
  // Revealing the hovered list ALONE (what this used to do) showed a list whose children were still
  // covered behind it — you could see the rows you were choosing between, but not what choosing one
  // would show you. The branch is the unit the user is actually looking at, so the branch is what
  // opens. It is pointer-only on purpose: a FOCUS reveal would keep the group open after a click (the
  // clicked button holds focus), jamming the auto-cover as the window shrinks.
  //
  // `hoverId` is the FRAME's (see `surfaceStates`), not this component's: selecting a row inside the
  // branch is a route change, which remounts this subtree — local state would be destroyed by the
  // click, collapsing the branch under a pointer that never left it and that no event will reopen it
  // with (the pointer hasn't moved, so nothing re-enters). Held above the mount, the branch survives
  // the selection and closes on the one thing that should close it: the pointer leaving.

  // The frontier list stays uncovered while it has no selection (its "detail" is only a landing, so
  // the user needs the list to pick from), and is never shifted off-screen for it — an unselected
  // frontier's placeholder claims NO minimum width (must-not-hide-frontier-choosing-list).
  const coverableCount = firstUnselected === -1 ? rendered.length : frontier
  const detailMin = firstUnselected === -1 ? minPx : 0

  // COVER LAYER 1 — intent. A list is covered because the user pinned it (`«`), or because auto-hide
  // is on and it sits ABOVE the frontier. A pin wins either way, so the user can hold a parent open
  // under auto-hide (until width pressure below takes the room back).
  //
  // Covering the list the user JUST clicked in is not this layer's problem: the click roots the
  // branch reveal at that list (see the rail's onSelect below), so a freshly covered parent stays
  // open under the pointer — its new child floating over the detail — until the pointer leaves.
  const pinnedOrAutoHidden = (i: number): boolean => {
    if (i >= coverableCount) return false
    return pins[rendered[i]!.id] ?? (autoHide && i < frontier)
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
  const restingDetailLeft = Math.max(0, x - offshift)

  // THE REVEAL GROUP — mode depends on how it was rooted (`hoverAll`):
  //   - pointer ENTER on a covered list → EVERY on-screen list, parents and children alike, opens
  //     in one cascade chained from the left edge (walking the stack leftwards list-by-list is the
  //     thing this replaces);
  //   - the covering CLICK → only the clicked list and its children (the classic branch). A click
  //     on a visible row must never spring the user's collapsed parents open — the root exists only
  //     so the clicked list doesn't snap shut under the pointer.
  // Members lay out side by side at full width, floating over the detail. Nothing under the group
  // moves; the detail keeps its geometry and is simply overlapped, and dropping the group (pointer
  // out) animates every member straight back to the layout above. Off-screen (drilled-down) lists
  // stay out of the group — Back is their affordance.
  //
  // A reveal that reveals NOTHING is dropped: when no member is covered, the revealed geometry IS
  // the resting layout — but the z-lift and the floating card's shadows are not, and a stack at
  // rest must not cast them. A select roots a reveal blindly (at click time it cannot know whether
  // it pushes a choosing list over the clicked one or completes the path — see the rail's
  // onSelect); this is where a blind root that ended up covering nothing becomes the no-op it
  // should be.
  const hoverRoot = hoverId === null ? -1 : rendered.findIndex((l) => l.id === hoverId)
  const groupFrom = (root: number) => (hoverAll ? hidden : root)
  const hoverIndex =
    hoverRoot >= 0 && rendered.some((_, i) => i >= groupFrom(hoverRoot) && isCovered(i))
      ? hoverRoot
      : -1
  const effectiveHoverId = hoverIndex >= 0 ? hoverId : null
  const groupStart = hoverIndex >= 0 ? groupFrom(hoverIndex) : -1
  const inGroup = (i: number) => hoverIndex >= 0 && i >= groupStart

  // The group is lifted above the detail (z-50+) so it floats OVER the UI. On CLOSE the lift must
  // LINGER for the wipe-shut transition (z-index can't animate) — else the lists would drop behind
  // the detail mid-close and the wipe would be invisible. `zLiftId` tracks the OPEN reveal but
  // trails it by the transition duration when clearing. It SEEDS from the open reveal so a remount
  // mid-hover re-lifts the branch on its first frame instead of flashing it behind the detail.
  const [zLiftId, setZLiftId] = useState<string | null>(effectiveHoverId)
  useEffect(() => {
    if (effectiveHoverId !== null) {
      setZLiftId(effectiveHoverId)
      return
    }
    const t = setTimeout(() => setZLiftId(null), 300)
    return () => clearTimeout(t)
  }, [effectiveHoverId])
  // The lifted group for z-index only — it TRAILS the open reveal on close (see `zLiftId`). The
  // lift region trails with it: capture the group start alongside the id so the wipe-shut lifts
  // exactly the members that were open, whichever mode rooted them.
  const zRoot = zLiftId === null ? -1 : rendered.findIndex((l) => l.id === zLiftId)
  const [zStart, setZStart] = useState<number>(groupStart)
  useEffect(() => {
    if (groupStart >= 0) setZStart(groupStart)
  }, [groupStart])
  const zFrom = zRoot === -1 ? -1 : zStart >= 0 ? zStart : zRoot
  const revealLeft: number[] = []
  if (hoverIndex >= 0) {
    // The group opens in place: chain full widths from its first member's resting left (for the
    // expand-all mode that is the container's left edge once `offshift` is applied).
    let rx = left[groupStart] ?? 0
    for (let i = groupStart; i < rendered.length; i++) {
      revealLeft[i] = rx
      rx += railWidth(rendered[i]!)
    }
  }
  // A member's geometry: revealed → full rail width, chained from the hovered list; else the covered
  // layout above (a 40px peek, or its full width when disclosed).
  const leftOf = (i: number) => (inGroup(i) ? revealLeft[i]! : left[i]!) - offshift
  const boxWidth = (i: number) => (inGroup(i) ? railWidth(rendered[i]!) : widthOf(i))

  // The reveal PUSHES THE DETAIL RIGHT instead of floating over it (v1.13.1): the detail's left
  // edge tracks the open group's right edge, so the user never loses sight of what they were
  // reading — it slides aside (possibly clipping at the container's right edge on deep stacks)
  // and slides back when the reveal closes. The lists still float over the covered PEEKS behind
  // them; only the detail yields.
  const lastIdx = rendered.length - 1
  const revealRight =
    hoverIndex >= 0 && lastIdx >= 0 ? revealLeft[lastIdx]! + railWidth(rendered[lastIdx]!) - offshift : -1
  const detailLeft = Math.max(restingDetailLeft, revealRight)
  const detailWidth = containerW > 0 ? Math.max(0, containerW - detailLeft) : 0

  // Closing the group is a property of the GROUP, not of one list: moving the pointer from the
  // hovered list into one of its revealed children must NOT collapse it. So a leave only closes when
  // the pointer landed outside every member — `relatedTarget` (the element being entered) is not in a
  // column at or below the hovered one. Leaving the window entirely gives a null target → close.
  const columnIndexOf = (target: EventTarget | null): number => {
    if (!(target instanceof Element)) return -1
    const col = target.closest("[data-htd-col]")
    return col ? Number(col.getAttribute("data-htd-col")) : -1
  }
  const onGroupPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (hoverIndex < 0) return
    if (inGroup(columnIndexOf(e.relatedTarget))) return // still inside the revealed branch
    setHoverId(null)
  }

  // The group leave above fires from the COLUMNS, which only works while the pointer is over the
  // columns it opened. Since the branch now outlives the mount (`surfaceStates`), it can also outlive
  // the pointer: leave a surface with the pointer resting in an open branch, come back with the mouse
  // somewhere else, and no column would ever fire a leave to close it. So the open branch also
  // watches the document: a pointer that turns up ANYWHERE OUTSIDE THE COLUMNS is proof it is not in
  // the branch, and closes it. Only armed while a branch IS open.
  //
  // "Outside the columns" — not "outside the group". The columns own what happens between themselves:
  // entering a shallower covered list must RE-ROOT the branch there (that is how you walk the stack
  // leftwards, each list joining the cascade), and this listener runs last, on the document, so a
  // group test here would overrule that enter and collapse everything the user was walking through.
  //
  // Armed on the RAW `hoverId`, not the open reveal: a blind root that revealed nothing (see above)
  // must still be cleared when the pointer turns up elsewhere — left to linger, a later width squeeze
  // could cover its list and spring the branch open with no pointer anywhere near it.
  useEffect(() => {
    if (hoverId === null) return
    const onPointerOver = (e: PointerEvent) => {
      if (columnIndexOf(e.target) < 0) setHoverId(null)
    }
    document.addEventListener("pointerover", onPointerOver)
    return () => document.removeEventListener("pointerover", onPointerOver)
  })

  // The `«`/`»` toggle sets a list's pin to the state it is moving TO. Holding the platform's
  // multi-select modifier (⌘ on macOS, Ctrl elsewhere) applies that same state to EVERY list at once
  // — one click to collapse the whole ancestry, or to open all of it. The fit rules still run on top,
  // so "open all" only discloses the lists that actually fit.
  const setCover = (parentIndex: number, e: ReactMouseEvent) => {
    const target = !isCovered(parentIndex) // the state the clicked button moves that list TO
    // The toggle must SHOW its work on the click: while a reveal is open the group renders at
    // full width regardless of pins, so a pin flip alone changes nothing until the pointer
    // happens to leave — the click reads as dead and its effect "turns up later". Dropping the
    // reveal settles the stack to the new pin state immediately; the pointer hasn't moved, so
    // no enter re-opens it (must-apply-disclosure-toggles-immediately).
    setHoverId(null)
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
  // width + the reveal group, which slides its members); scroll is NOT in it (it re-measures once via
  // `onScroll`).
  const connectorSig = `${rendered.map((l) => l.selectedId ?? "").join("|")}::${left.join(",")}::${offshift}::${containerW}::${hoverIndex}`
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
        // A covered list is rendered at its FULL width but its wrapper is clipped (`overflow-hidden`)
        // to a COVERED_PEEK-wide box, so only the leading icon of each row shows — the 40px peek.
        // Revealing WIPES the box open to the full rail width (the `width` transition); the inner rail
        // keeps a fixed railWidth so its rows never reflow as the box widens.
        const revealed = inGroup(i) && !offscreen
        // The lift is a property of the group: while it is open every member floats above the detail;
        // on close the lift LINGERS (zLiftId trails hoverId) so the wipe-shut happens over the UI
        // instead of behind it. The members keep their relative order (left → right) inside the lift.
        const zLifted = !offscreen && zFrom >= 0 && i >= zFrom
        // The group floats as ONE card over the UI, so BOTH its outer edges are edges: its trailing
        // edge shadows the detail it covers, and its LEADING edge shadows the peek stack it slid out
        // of (a peek's own `border-r` is clipped away with the rest of its rail, so that shadow IS
        // the boundary — without it the opened list bleeds into the icon strip behind it). Members
        // inside the group abut each other and are separated by their own rail borders.
        const groupTrailing = revealed && i === rendered.length - 1
        const groupLeading = revealed && i === groupStart && i > 0
        return (
          <div
            key={level.id}
            data-htd-col={i}
            // Entering a COVERED list opens the branch rooted at it. Entering a list already inside the
            // open branch keeps it (the pointer is walking the cascade, not opening a new one);
            // entering a disclosed list outside the branch closes it.
            onPointerEnter={() => {
              if (inGroup(i)) return
              // A pointer ENTER on a covered list opens EVERYTHING on-screen (hoverAll).
              setHoverId(covered && !offscreen ? level.id : null, true)
            }}
            // Closing is the GROUP's business (see onGroupPointerLeave): a leave into a revealed child
            // must not collapse the branch the pointer is still inside.
            onPointerLeave={onGroupPointerLeave}
            aria-hidden={offscreen || undefined}
            // React 19 types `inert` as a boolean prop; `undefined` (not false) omits the attribute.
            inert={offscreen || undefined}
            style={{
              left: leftOf(i),
              width: boxWidth(i),
              gridTemplateColumns: `${railWidth(level)}px`,
              zIndex: zLifted ? REVEAL_Z + i : i + 1,
              // Shadows ride the WRAPPER (its own box-shadow isn't clipped by its overflow, unlike a
              // child's). They compose — a one-list group is both the leading and the trailing edge of
              // its card — which is why this is an inline `boxShadow` and not two utility classes
              // (the second would just overwrite the first).
              boxShadow:
                [
                  groupTrailing && SHADOW_RIGHT,
                  (groupLeading || (parentCovered && !revealed)) && SHADOW_LEFT,
                ]
                  .filter(Boolean)
                  .join(", ") || undefined,
            }}
            className={cn(
              "absolute top-0 bottom-0 grid overflow-hidden",
              offscreen && "pointer-events-none",
              animate &&
                "transition-[left,width,box-shadow] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
              // The rail's own `bg-apt-nav` is 96% opaque — right for a nav sitting on the page, wrong
              // for a branch FLOATING over the detail, which ghosts the detail's text through it. A
              // lifted member gets the page background under its rail, so the card is opaque while it
              // floats and composites exactly as it does at rest.
              zLifted && "bg-apt-bg",
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
              // Selecting does NOT close the branch: the pointer is still inside it, and collapsing
              // under the cursor yanks the rows away mid-gesture — you cannot pick a parent and then
              // pick its child, which is the whole point of revealing the branch. The reveal is
              // pointer-scoped, so it collapses when (and only when) the pointer leaves it.
              //
              // And a select from a list at REST roots a branch here itself: a select that pushes a
              // new choosing list COVERS this list (auto-hide, or width pressure) with the pointer
              // still inside it — exactly the state pointer-enter names, except the pointer never
              // moved, so no enter will ever fire. Without this the list snaps shut under the cursor
              // on the very click and nothing reopens it; with it, the new list slides out floating
              // over the detail and the stack settles when the pointer leaves. A select that instead
              // completes the path covers nothing at/below this list, and the blind root is dropped
              // as meaningless (see the reveal group above).
              onSelect={(id) => {
                if (!inGroup(i)) setHoverId(level.id, false)
                railOnSelect(level, attemptExit)(id)
              }}
              emptyLabel={level.emptyLabel ?? "Nothing here yet."}
              onNew={level.onNew}
              newLabel={level.newLabel}
              newActive={level.newActive}
              titleActions={level.titleActions}
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
          row, drawn above the lists (so they bridge the list boundary) but pointer-transparent. While
          a branch is z-lifted (hover reveal, and the lingering lift as it wipes shut) the overlay
          rides above the whole lift — the chain is exactly what you are reading when you open the
          branch, so the branch must never paint over it. */}
      <SelectionConnectorOverlay
        paths={connectors}
        zIndex={zFrom >= 0 ? REVEAL_Z + rendered.length : undefined}
      />
      {/* The detail (leaf) pane — rightmost, highest z-index, fills to the container's right edge
          down to `minDetailWidth`. Its top-left carries the cover toggle for the frontier list. The
          left shadow turns on when its parent (the frontier list) is covered, so the overlap reads
          as physical (token colour via a CSS var, so the colour checker stays clean). */}
      <section
        key="__detail__"
        style={{ left: detailLeft, width: detailWidth, zIndex: rendered.length + 1 }}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col overflow-auto bg-apt-surface",
          animate && "transition-[left,width] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
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

/**
 * The "cascading" disclosure style — a VERTICAL cascade (nested-menu layout).
 *
 * Only the ROOT list is full height, on the left. Every deeper list opens to the RIGHT of its
 * parent, its TOP just under the parent's HEADER bar — one header-height step per level,
 * regardless of which row is selected — and its height HUGS its own rows, capped at the
 * container's bottom (its list scrolls past it). So the stack reads as a chain of menus stepping
 * down-and-right, with every list's HEADER always visible. The DETAIL pane is pinned BESIDE the
 * root list at full height, UNDER the deeper lists: the cascade discloses over it like menus over
 * content, and the detail never moves with it.
 *
 * The disclosure INTENT machinery is the covered stack's, unchanged — auto-hide and the `«`/`»`
 * pins, width pressure covering leftmost-first (until the LISTS fit; the detail no longer competes
 * for width), the hover branch reveal. But covering DRAWS differently here: a covered list is
 * never resized or clipped. Covering only shrinks the list's horizontal ADVANCE to CASCADE_INDENT,
 * so its child — painted above it, back-to-front z-order — literally draws over it, obscuring the
 * covered rows' TEXT while their leading icons stay visible. And because the child's top sits at
 * the parent's header bottom, what stays visible of a covered list is its full HEADER row, the
 * icon strip of its rows, and whatever its child is too short to overdraw:
 *
 *   Workspaces
 *     « Workspace
 *       « Personas
 *         « mike        ← the detail strip
 *
 * The detail strip's `«` IMMERSES the detail — every list (root included) slides off the left edge
 * and the detail takes the whole surface; the strip's `»` brings the stack back.
 *
 * Kept as its own component so either layout can evolve or be deleted independently — the price is
 * the mirrored covering logic, annotated where it is ported verbatim.
 */
function CascadingStack({
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
  hoverId,
  hoverAll,
  setHoverId,
  containerW,
  children,
}: StackProps) {
  // Per-level rail width, resizable by the trailing-border handle within a readable range (same
  // contract as the covered stack — there is no icon strip to snap to here either).
  const MIN_DRAG_RAIL = 160
  const MAX_DRAG_RAIL = 640
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [dragging, setDragging] = useState(false)
  const railWidth = (l: TopicLevel) => widths[l.id] ?? l.width ?? FULL_RAIL
  const onResizeLevel = (level: TopicLevel, w: number) =>
    setWidths((wd) => ({ ...wd, [level.id]: Math.max(MIN_DRAG_RAIL, Math.min(w, MAX_DRAG_RAIL)) }))
  const containerRef = useRef<HTMLDivElement>(null)
  // This surface's remount-surviving memory (see `cascadeMemory`). Read FIRST, because the pointer
  // state below has to seed from it on the very first render of a remount.
  const mem = cascadeMemoryFor(rendered[0]?.id ?? "")
  // DEV-ONLY debug switches (both default off; see `debug-options`).
  const showDebugFrames = useShowDebugFrames()
  const slowAnimations = useSlowAnimations()
  // The CSS durations below stretch off the `--apt-anim-scale` variable the host app puts on
  // <html>; the JS-driven entrance/exit sets its timing imperatively, with no variable to read, so
  // it scales off the same flag by hand to stay in step with them.
  const enterMs = ENTER_MS * (slowAnimations ? SLOW_ANIM_FACTOR : 1)
  const exitMs = EXIT_MS * (slowAnimations ? SLOW_ANIM_FACTOR : 1)
  const exitStaggerMs = EXIT_STAGGER_MS * (slowAnimations ? SLOW_ANIM_FACTOR : 1)
  // The staggered exits are the one thing here that outlives its own render: `exitBranch` schedules
  // the deeper menus on timers, and an unmount mid-collapse (the host routed away) must not leave them
  // to fire against detached nodes.
  const exitTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(
    () => () => {
      exitTimers.current.forEach(clearTimeout)
      exitTimers.current = []
    },
    [],
  )

  // COVERING — CoveredStack's intent rules (see there for the rationale of each layer), with two
  // cascade differences: the indent is the tighter CASCADE_INDENT, and the pressure/off-screen
  // budgets contain only the LISTS — the detail sits beside the root UNDER the deeper lists (see
  // `detailLeft`), so it no longer competes with them for width. The frontier stays uncovered
  // while it has no selection (must-not-hide-frontier-choosing-list).
  const coverableCount = firstUnselected === -1 ? rendered.length : frontier

  // COVER LAYER 1 — intent: the user's pin (`«`), else auto-hide's default for every list above
  // the frontier.
  const pinnedOrAutoHidden = (i: number): boolean => {
    if (i >= coverableCount) return false
    return pins[rendered[i]!.id] ?? (autoHide && i < frontier)
  }

  // The leaf detail sits BESIDE the frontier list; reserve its minimum so width pressure covers
  // enough ancestors to keep the frontier list AND the detail on-screen.
  const detailMin = minDetailPx(minDetailWidth)

  // A DISCLOSED list advances x by its full width LESS the indent (Mike): its child must land OVER
  // its parent's right edge — overlapping it by exactly the indent the child peeks by when covered —
  // NOT butted up against it. So disclosing a list changes only how much of it the child leaves
  // showing (everything but the last CASCADE_INDENT, vs. only CASCADE_INDENT when covered); the
  // child always overlaps. Never let the advance invert on a hand-dragged-narrow rail.
  const disclosedAdvance = (l: TopicLevel) => Math.max(CASCADE_INDENT, railWidth(l) - CASCADE_INDENT)

  // Hold the covering under the pointer, exactly as `mayMoveGround` holds the ground (see `heldCover`):
  // while the pointer is in the menus we REUSE the covering last seen with the stack settled, so a
  // select that publishes a new level can't re-cover the root and slide the cascade left mid-gesture.
  // Null (→ fresh compute) whenever the pointer is out or nothing settled has been recorded yet.
  const heldCover = mem.pointerInMenus ? mem.heldCover : null

  // COVER LAYER 2 — width pressure: cover MORE lists, leftmost-first, until the disclosed cascade
  // plus the detail minimum fits the container. Only ever ADDS a cover — never discloses one the
  // user pinned shut. Frozen at the settled count (clamped to what is coverable now — the frontier may
  // have moved) while the pointer is in the menus.
  let pressure = 0
  if (heldCover) {
    pressure = Math.min(heldCover.pressure, coverableCount)
  } else if (containerW > 0) {
    const listsWidth = (n: number) =>
      rendered.reduce(
        (w, l, i) =>
          i === rendered.length - 1
            ? w + railWidth(l)
            : w + (pinnedOrAutoHidden(i) || i < n ? CASCADE_INDENT : disclosedAdvance(l)),
        0,
      )
    while (pressure < coverableCount && listsWidth(pressure) + detailMin > containerW) pressure++
  }
  const isCovered = (i: number) => pinnedOrAutoHidden(i) || i < pressure
  // A COVERED list advances x by only the tight CASCADE_INDENT peek (its child slides left over it,
  // overdrawing it in the back-to-front z-order). Covering vs disclosing IS this horizontal
  // difference — the very thing the `«`/`»` toggle, auto-hide and the hover reveal act on.
  const widthOf = (i: number) => (isCovered(i) ? CASCADE_INDENT : disclosedAdvance(rendered[i]!))

  // PHASE 2 — OFF-SCREEN: every list at its indent STILL doesn't fit — slide the leftmost lists
  // off the left edge, whole lists at a time (see CoveredStack).
  let hidden = 0
  let offshift = 0
  if (heldCover) {
    // Frozen alongside `pressure` (an unheld off-screen phase would slide the leftmost lists off the
    // left edge — the same move under the pointer, by a different lever). Recompute `offshift` from the
    // current widths so a rail resize while held stays consistent.
    hidden = Math.min(heldCover.hidden, coverableCount)
    for (let i = 0; i < hidden; i++) offshift += widthOf(i)
  } else if (containerW > 0) {
    // Extent, not the sum of advances: every list but the LAST contributes only its advance (its
    // child overdraws the rest); the LAST is overdrawn by nothing, so it contributes its FULL width.
    const widthFrom = (h: number) =>
      rendered.reduce(
        (w, l, i) => (i < h ? w : i === rendered.length - 1 ? w + railWidth(l) : w + widthOf(i)),
        0,
      ) + detailMin
    while (hidden < coverableCount && widthFrom(hidden) > containerW) {
      offshift += widthOf(hidden)
      hidden++
    }
  }

  // Record the covering whenever the stack is SETTLED (pointer OUT), so the hold above has a value to
  // freeze at across the remount a select triggers — the column analogue of the `groundRight` latch
  // below. Guarded on `mem.pointerInMenus` so a held frame never overwrites the settled value with the
  // frozen one it is currently replaying.
  useEffect(() => {
    if (!mem.pointerInMenus) mem.heldCover = { pressure, hidden }
  }, [mem, pressure, hidden])

  // IMMERSION — the detail strip's `«`: the detail takes the WHOLE surface, every list (root
  // included) sliding off the left edge; the strip's `»` brings the stack back. Stored under the
  // reserved DETAIL_PIN key in `pins`, so it persists per-surface exactly like the per-list pins.
  const immersed = pins[DETAIL_PIN] ?? false

  // HORIZONTAL layout pass (running x): EVERY list advances x by just its indent (round 8 #2), so
  // each child slides left over its parent. Each list keeps its FULL box (no resize, no clip; see
  // `boxWidth`) and the child, painted above it in the back-to-front z-order, simply overdraws it.
  const left: number[] = []
  let x = 0
  rendered.forEach((_l, i) => {
    left.push(x)
    x += widthOf(i)
  })

  // The detail begins at the frontier list's RIGHT edge (it sits beside the cascade). Covered
  // ancestors advance by only their peek, so the disclosed frontier + the detail stay on-screen.
  const stackRight = (left[frontier] ?? 0) + railWidth(rendered[frontier] ?? rendered[0]!)

  // VERTICAL cascade. Each non-root list's TOP is its parent's top plus the parent's HEADER
  // height — the child discloses immediately under the parent's header bar, measured (not assumed)
  // so a wrapping title stays correct. One header-height step per level, regardless of which row
  // is selected; the steps are exactly what keeps every covered ancestor's HEADER visible above
  // its child. Measuring the offset within the box (not the header's absolute position) makes the
  // measurement independent of where the box currently sits — so one pre-paint pass converges with
  // no feedback loop: moving a child never moves its parent's rows. `rowOffset[i]` is that
  // within-box header bottom for list `i` (first row top, then items-list top, as fallbacks for a
  // headerless rail).
  const [rowOffset, setRowOffset] = useState<number[]>([])
  const rowMeasureRef = useRef<() => void>(() => {})
  // Re-measure when the set of lists changes, a list gains/loses its first row, or the container
  // width changes; the ResizeObserver below also catches height changes, and the container handlers
  // catch scroll.
  const measureSig = `${rendered.map((l) => `${l.id}#${l.items.length}`).join("|")}::${containerW}`
  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    const measure = () => {
      const next: number[] = []
      for (let i = 0; i < rendered.length; i++) {
        const col = cont.querySelector(`[data-htd-col="${i}"]`)
        const header = col?.querySelector("[data-htd-header]")
        const anchor = header ?? col?.querySelector("[data-htd-row]") ?? col?.querySelector("ul")
        if (!col || !anchor) {
          next[i] = 0
          continue
        }
        const r = anchor.getBoundingClientRect()
        next[i] = (header ? r.bottom : r.top) - col.getBoundingClientRect().top
      }
      setRowOffset((prev) =>
        prev.length === next.length && prev.every((v, k) => v === next[k]) ? prev : next,
      )
    }
    rowMeasureRef.current = measure
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [measureSig])

  // Prefix-sum the within-box offsets into each list's absolute TOP: the root is full height (top 0);
  // a child's top is its parent's top plus the parent's first-row offset.
  const topOf: number[] = []
  rendered.forEach((_l, i) => {
    topOf.push(i === 0 ? 0 : (topOf[i - 1] ?? 0) + (rowOffset[i - 1] ?? 0))
  })

  // THE REVEAL GROUP — CoveredStack's hover branch reveal, ported verbatim (see there for the full
  // story: enter-vs-covering-click rooting, the z-lift that lingers through the wipe-shut, the
  // group-scoped close rules). Hovering a COVERED submenu opens its branch: the members disclose at
  // their FULL widths chained horizontally from the group start (fanning right so they become
  // readable — each still landing OVER its parent's right edge by the indent, per `disclosedAdvance`),
  // while their TOPS stay the cascade's — revealing is horizontal. This IS the auto-expand; leaving
  // auto-collapses the branch back to its covered peeks.
  const hoverRoot = hoverId === null ? -1 : rendered.findIndex((l) => l.id === hoverId)
  const groupFrom = (root: number) => (hoverAll ? hidden : root)
  const hoverIndex =
    hoverRoot >= 0 && rendered.some((_, i) => i >= groupFrom(hoverRoot) && isCovered(i))
      ? hoverRoot
      : -1
  const effectiveHoverId = hoverIndex >= 0 ? hoverId : null
  const groupStart = hoverIndex >= 0 ? groupFrom(hoverIndex) : -1
  const inGroup = (i: number) => hoverIndex >= 0 && i >= groupStart

  const [zLiftId, setZLiftId] = useState<string | null>(effectiveHoverId)
  useEffect(() => {
    if (effectiveHoverId !== null) {
      setZLiftId(effectiveHoverId)
      return
    }
    const t = setTimeout(() => setZLiftId(null), 300)
    return () => clearTimeout(t)
  }, [effectiveHoverId])
  const zRoot = zLiftId === null ? -1 : rendered.findIndex((l) => l.id === zLiftId)
  const [zStart, setZStart] = useState<number>(groupStart)
  useEffect(() => {
    if (groupStart >= 0) setZStart(groupStart)
  }, [groupStart])
  const zFrom = zRoot === -1 ? -1 : zStart >= 0 ? zStart : zRoot
  const revealLeft: number[] = []
  if (hoverIndex >= 0) {
    let rx = left[groupStart] ?? 0
    for (let i = groupStart; i < rendered.length; i++) {
      revealLeft[i] = rx
      rx += disclosedAdvance(rendered[i]!)
    }
  }
  // Immersed, every list parks fully past the left edge (right edge ≤ 0): shift the whole resting
  // layout left by the rightmost box edge. Boxes stay full width — nothing pokes back into view.
  const immersedShift = immersed
    ? Math.max(0, ...rendered.map((l, i) => (left[i] ?? 0) + railWidth(l)))
    : 0
  const leftOf = (i: number) =>
    immersed ? left[i]! - immersedShift : (inGroup(i) ? revealLeft[i]! : left[i]!) - offshift
  // Covering never resizes a box — the child overdrawing it IS the covered drawing (so a reveal
  // only SLIDES members right; nothing wipes open). The one exception: an OFF-SCREEN list narrows
  // to its indent so it parks fully past the left edge (`leftOf` shifts it by only the indents,
  // so a full-width box would poke back into view below the survivors' hugged bottoms).
  // THE ONE AUTHORITY — "is the pointer in the menus?" — read fresh from the DOM (see
  // `usePointerInMenus`). It governs the ground latch below AND whether the reveal is held (further
  // down), which used to be two separate, both-stale computations; unifying them onto one fresh
  // measurement is the layer whose absence let choosing a row collapse the cascade. `regionRect` is
  // for the debug overlay only.
  const regionSig = `${rendered.length}:${hoverIndex}:${groupStart}:${offshift}:${immersed}:${containerW}:${left.join(",")}:${topOf.join(",")}`
  const { pointerInMenus, regionRect } = usePointerInMenus(containerRef, mem, regionSig)

  // THE GROUND'S RIGHT EDGE — where the root list ends and the detail begins. It tracks the resting
  // stack (`stackRight`), but it is HELD while the pointer is in the menus, because moving it moves
  // EVERYTHING: the root's width and the detail's position both hang off it, so any change
  // mid-interaction shoves the UI around under the pointer. `mayMoveGround` owns the rule; this is
  // only the plumbing. The held width lives in `cascadeMemory` so a route-param REMOUNT cannot reset
  // it mid-interaction (the pointer half lives there too — see the hook). `mem` is read at the top.
  const groundFree = mayMoveGround({ pointerInMenus, latched: mem.groundRight !== null })
  const groundRight = groundFree ? stackRight : (mem.groundRight ?? stackRight)
  useEffect(() => {
    if (groundFree) mem.groundRight = stackRight
  }, [groundFree, stackRight, mem])

  // (#1, Mike) THE ROOT LIST IS AS WIDE AS THE WHOLE MENU STACK — it spans x=0 to the ground's right
  // edge, exactly where the detail begins. The root is the GROUND the cascade sits on, so it must
  // paint every pixel under the stack. At its own rail width it stopped at 240 while the stack ran to
  // `stackRight` (240 + each covered ancestor's indent), leaving that difference as an unpainted
  // BLACK VERTICAL BAR between the root and the detail. Widening only the enclosing box would NOT
  // fix it: `bg-apt-nav` is 96% opaque, so box-alone reads visibly darker than box+rail — the strip
  // would still show as a bar. The RAIL itself has to be this wide (see the rail's `width` below).
  //
  // EXACTLY `groundRight` — never `max(railWidth(root), groundRight)`. The detail begins at
  // `groundRight`, and the root paints ABOVE it (z 1 vs 0), so any excess would silently overpaint
  // the detail's left edge instead of widening anything. A root rail wider than the ground just gets
  // clipped by the box, which is right: at >1 level the root is covered and only its peek shows.
  const rootWidth = groundRight

  const boxWidth = (i: number) =>
    i < hidden ? widthOf(i) : i === 0 ? rootWidth : railWidth(rendered[i]!)

  // THE DETAIL SITS BESIDE THE MENU STACK — pinned at the ground's right edge, never pushed by the
  // cascade; a hover branch reveal fans lists rightward OVER it (they float at REVEAL_Z), like menus
  // dropping over content. Immersed, it takes the whole surface.
  const detailLeft = immersed ? 0 : rendered.length > 0 ? groundRight : 0
  const detailWidth = containerW > 0 ? Math.max(0, containerW - detailLeft) : 0

  // AUTO-COLLAPSE — the ONE closer of the reveal, and the whole point of this refactor. A reveal is
  // held open while `pointerInMenus`; the instant that authority reports the pointer OUTSIDE the menu
  // region, the reveal closes (`reduceReveal`'s `pointerLeftMenus`, the only auto-close there is). No
  // click, remount, width change or selection reaches here — choosing a row RE-ROOTS the reveal, it
  // never closes it, so a click can no longer collapse the menus. If the pointer never moves after a
  // click, `pointerInMenus` stays true and nothing collapses, which is exactly "clicking does nothing
  // wrt auto-collapse". This also subsumes the covered stack's old blind-root document watcher: a
  // reveal that revealed nothing is still an open `hoverId`, and it too clears the moment the pointer
  // is proven outside.
  useEffect(() => {
    if (hoverId !== null && !pointerInMenus) setHoverId(null)
  }, [pointerInMenus, hoverId, setHoverId])

  // AUTO-DISCLOSE via a TRIGGER RECTANGLE (Mike): at rest (nothing disclosed), moving the pointer into
  // the area to the LEFT of the topmost (frontier) menu — below the breadcrumbs (the container's top)
  // down to the BOTTOM OF THE TALLEST MENU — discloses the whole cascade. Only armed when there IS a
  // covered ancestor to disclose (a fully-disclosed or single-level cascade has nothing to open).
  //
  // The height is the UNION of every menu (Mike), not the frontier's own: the frontier is whichever
  // menu opened last, so keying off it made the trigger as short as THAT card — a deep-but-short menu
  // (an "Areas" of four rows) left the tall list beside it outside the region, and sweeping the
  // pointer in alongside it did nothing. The menus are one stack; the region that opens them is one
  // rect over all of them. Only the RIGHT edge is still the frontier's — the trigger is the approach
  // lane BESIDE the cascade, so it must stop where the topmost menu starts.
  //
  // Measured whenever the frontier is measurable, armed only when there is something to disclose.
  // Measuring and arming are separate questions (must-draw-every-detection-frame): the rect exists so
  // the debug overlay can always show where the region is, while `triggerArmed` decides whether
  // entering it opens anything. `anyCovered` is exactly why that matters: with nothing covered the
  // region is correctly DEAD, and drawing it dashed is the only way that answer is ever visible.
  const anyCovered = rendered.some((_, i) => isCovered(i))
  const triggerArmed = triggerRectArmed({ revealOpen: hoverIndex >= 0, immersed, anyCovered })
  const [triggerRect, setTriggerRect] = useState<MenuRect | null>(null)
  const triggerSig = `${hoverIndex}:${anyCovered}:${frontier}:${offshift}:${immersed}:${containerW}:${left.join(",")}:${topOf.join(",")}`
  useEffect(() => {
    const cont = containerRef.current
    if (!cont) {
      setTriggerRect(null)
      return
    }
    const measure = () => {
      const cr = cont.getBoundingClientRect()
      const topEl = cont.querySelector<HTMLElement>(`[data-htd-col="${frontier}"]`)
      if (!topEl) {
        setTriggerRect(null)
        return
      }
      const tr = topEl.getBoundingClientRect()
      // Falling back to the frontier's own bottom keeps the trigger armed for the one case the union
      // can't measure (every menu mid-entrance at zero size); the settle re-measure below corrects it.
      const u = menuUnion(cont)
      setTriggerRect({ left: cr.left, top: cr.top, right: tr.left, bottom: u?.bottom ?? tr.bottom })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    const settle = setTimeout(measure, 320)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [triggerSig])
  // Open the cascade the moment the pointer enters the trigger rectangle.
  useEffect(() => {
    if (!triggerArmed || !triggerRect) return
    const onMove = (e: PointerEvent) => {
      if (pointInRegion(triggerRect, e.clientX, e.clientY))
        setHoverId(rendered[frontier]?.id ?? null, true)
    }
    document.addEventListener("pointermove", onMove)
    return () => document.removeEventListener("pointermove", onMove)
  }, [triggerArmed, triggerRect])

  // The `«`/`»` toggle — ported verbatim, including dropping any open reveal on the click so the
  // stack settles immediately (must-apply-disclosure-toggles-immediately).
  const setCover = (parentIndex: number, e: ReactMouseEvent) => {
    const target = !isCovered(parentIndex)
    setHoverId(null)
    if (e.metaKey || e.ctrlKey) {
      setPins(Object.fromEntries(rendered.map((l) => [l.id, target])))
      return
    }
    setPins((prev) => ({ ...prev, [rendered[parentIndex]!.id]: target }))
  }
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

  // The DETAIL strip's control: `«` immerses the detail (every list slides off the left edge and
  // the detail takes the full width); `»` brings the lists back. This replaces the covered stack's
  // frontier cover toggle on the strip — with the detail pinned beside the root, room is reclaimed
  // by immersing, not by covering the deepest list.
  const immersionLabel = immersed ? "Show the topic lists" : "Hide the topic lists"
  const immersionControl = (
    <button
      type="button"
      onClick={() => {
        setHoverId(null)
        setPins((prev) => ({ ...prev, [DETAIL_PIN]: !immersed }))
      }}
      aria-label={immersionLabel}
      title={immersionLabel}
      className="rounded px-1 font-mono text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
    >
      {immersed ? (
        <ChevronsRight size={16} aria-hidden className="shrink-0" />
      ) : (
        <ChevronsLeft size={16} aria-hidden className="shrink-0" />
      )}
    </button>
  )

  // Selection connectors (shared): the gold elbow from each selected parent row to its selected child
  // row, reinforcing the cascade. The signature is everything that moves a selected row — the
  // per-level selection, the column left edges, the vertical tops, the off-screen shift, the
  // reveal group and immersion.
  const connectorSig = `${rendered.map((l) => l.selectedId ?? "").join("|")}::${left.join(",")}::${topOf.join(",")}::${offshift}::${containerW}::${hoverIndex}::${immersed}`
  const connectorsPossible = rendered.length >= 2 && rendered.some((l) => l.selectedId != null)
  // THE CONNECTOR RETRACTS WITH THE MENU IT POINTS AT (Mike). The hook re-measures on a rAF loop for a
  // window after `sig` changes, so the entrance was always tracked — a structural change starts it. An
  // EXIT is driven imperatively, though, changing no signature: the loop was long stopped, so the line
  // hung at FULL LENGTH across the whole close and only blinked out at the very end, when the level
  // finally cleared. Bumping this on every exit restarts the loop, and because the paths are measured
  // from `getBoundingClientRect` — which reports the animating `scale` — each line now shortens into
  // the row its menu is shrinking into, and drops when the box reaches zero. That is the entrance run
  // backwards, which is what the rest of the close already is; a fade would only have hidden the line
  // instead of moving it.
  const [exitTick, setExitTick] = useState(0)
  const { connectors, onScroll } = useSelectionConnectors(
    containerRef,
    rendered.length,
    `${connectorSig}:${exitTick}`,
    connectorsPossible,
    // The cascade connects to a still-unchosen submenu as a whole — see the loop in the hook.
    true,
    // Cover whichever runs longer: an entrance, or the staggered collapse (whose last menu starts at
    // (n-1) × stagger and then runs EXIT_MS).
    Math.max(400, enterMs, exitMs + rendered.length * exitStaggerMs) + 120,
  )
  // A scroll (or pointer/focus movement that re-flows a row) re-measures BOTH the cascade tops and the
  // connector paths.
  const reMeasure = () => {
    rowMeasureRef.current()
    onScroll()
  }

  // Choosing a topic lands the new list IN PLACE (its `top` is never transitioned — a re-measure is
  // pre-paint, so a corrected top never visibly slides); only the horizontal `left`/`width` (a resize)
  // animates, and never mid-drag.
  const inPlace = useInPlaceOnStructureChange(structureSignature(rendered))
  const animate = !dragging && !inPlace

  // NEW SUBMENU ENTRANCE (Mike) — a list disclosed by choosing a row GROWS OUT OF THAT ROW: it
  // starts as a point at the chosen row's centre and expands + travels into its cascade position,
  // BOUNCING into rest (+10, −10, +5, +−5, 0 percentage points — see `cascade-rules`). ONE `scale`
  // track does the translation, the size AND both bounces: park the transform-origin on the row's
  // centre expressed in the NEW box's own coordinates (it legitimately lands outside the box — CSS
  // allows a transform-origin beyond the border box), and `scale(0)` collapses the box onto exactly
  // that point. Every step away from `scale(1)` is then a step both bigger and further from the row,
  // which is why one number is enough and why the size bounce and the travel bounce share figures.
  //
  // A Web Animations keyframe list rather than a transition: the bounce reverses FOUR times and a
  // cubic-bezier can only overshoot once (see EXIT_EASE's note on what the old single-curve version
  // could and couldn't say). WAAPI also removes the `offsetWidth` flush this needed as a transition —
  // keyframes carry their own start state, so there is no batched-away first frame to force.
  //
  // `transform`/`transform-origin` are in no style prop here, so React never clobbers them, and the
  // animation reverts to the element's own (untransformed) style when it finishes. `inPlace` is true
  // on this same render, so the box's `left`/`width` are not transitioning and cannot fight it.
  // A menu's identity here is NOT its level id: ids are REUSED. Choosing a different workspace
  // re-fills the existing "workspace" level rather than adding one, and that is a disclosure too, so
  // keying on the id alone silently skips the animation for exactly that case. Key on the SELECTION
  // PATH above the menu plus its id — that changes on precisely the occasions this menu is showing a
  // newly-disclosed list, at any depth (a root click re-discloses the whole branch under it, so
  // every menu below re-enters, each growing out of its own parent's chosen row).
  const enterKey = (i: number) =>
    `${rendered
      .slice(0, i)
      .map((l) => l.selectedId ?? "")
      .join(">")}>${rendered[i]!.id}`
  const enterSig = rendered.map((_l, i) => enterKey(i)).join("|")
  useLayoutEffect(() => {
    const cont = containerRef.current
    const prev = mem.seenKeys
    mem.seenKeys = new Set(rendered.map((_l, i) => enterKey(i)))
    // Never primed: a genuine first load, where every list is "new" but nothing was OPENED —
    // animating here would play an unasked-for intro. A REMOUNT is not this case: `mem` survives it,
    // so the menus that were already on screen are still known and only the re-disclosed ones fire.
    if (!cont || prev === null) return
    rendered.forEach((level, i) => {
      if (i === 0 || prev.has(enterKey(i))) return
      const col = cont.querySelector<HTMLElement>(`[data-htd-col="${i}"]`)
      const row = cont.querySelector<HTMLElement>(
        `[data-htd-col="${i - 1}"] [data-htd-row][aria-current="true"]`,
      )
      if (!col || !row) return
      const cr = col.getBoundingClientRect()
      const rr = row.getBoundingClientRect()
      if (cr.width === 0 || cr.height === 0) return
      // No WAAPI (jsdom under test, or a browser too old): land in place. The entrance is decoration
      // — never make the menu's ARRIVAL depend on being able to animate it.
      if (typeof col.animate !== "function") return
      col.style.transformOrigin = `${rr.left + rr.width / 2 - cr.left}px ${
        rr.top + rr.height / 2 - cr.top
      }px`
      // `fill: backwards` applies the scale(0) start frame immediately, so the box cannot paint at
      // full size in the frame before the animation's first tick.
      const anim = col.animate(enterKeyframes(), { duration: enterMs, fill: "backwards" })
      // Hand the origin back once it rests (on cancel too — a re-disclosure mid-flight starts its
      // own animation and must not inherit a stale origin).
      const clean = () => {
        col.style.transformOrigin = ""
      }
      anim.addEventListener("finish", clean)
      anim.addEventListener("cancel", clean)
    })
  }, [enterSig])

  // CLOSING RUNS THE ENTRANCE BACKWARDS (Mike) — the submenu shrinks back into the row that opened
  // it. Same origin, same duration, mirrored curve; only then is the level actually cleared. The
  // order matters and is why this is imperative rather than an "exiting" render state: React unmounts
  // the column the instant its level goes away, so the node has to be animated BEFORE `onClear` runs,
  // while it is still mounted and the parent's row is still `aria-current` (that row IS the origin).
  const exitCol = (i: number, done: () => void) => {
    const cont = containerRef.current
    const col = cont?.querySelector<HTMLElement>(`[data-htd-col="${i}"]`)
    const row = cont?.querySelector<HTMLElement>(
      `[data-htd-col="${i - 1}"] [data-htd-row][aria-current="true"]`,
    )
    const cr = col?.getBoundingClientRect()
    if (!col || !row || !cr || cr.width === 0 || cr.height === 0 || typeof col.animate !== "function") {
      done() // nothing measurable to animate (or no WAAPI) — never hold the close hostage to it
      return
    }
    const rr = row.getBoundingClientRect()
    col.style.transformOrigin = `${rr.left + rr.width / 2 - cr.left}px ${
      rr.top + rr.height / 2 - cr.top
    }px`
    // `fill: forwards` HOLDS the box at scale(0) after the animation ends, so the menu stays gone
    // for the frames between "shrunk away" and React actually unmounting it. Without the fill it
    // would snap back to full size at the end of its own exit — the very flash this is avoiding.
    const anim = col.animate(exitKeyframes(), { duration: exitMs, fill: "forwards" })
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done()
      // Hand the node back ONLY if the clear truly did not take it away — the fail-visible branch for
      // a host `onClear` that no-ops, so we never strand an invisible menu.
      //
      // It has to WAIT for the unmount rather than assume it. `onClear` is routinely a ROUTE change
      // (the hub's rails clear by navigating), which unmounts this column an unknown number of frames
      // later — so restoring on the next frame, as this first did, caught the node still mounted and
      // put the menu BACK ON SCREEN AT FULL SIZE for a beat until the route settled (Mike). Nothing
      // here can distinguish "clear still in flight" from "clear did nothing", so give the unmount far
      // longer than any plausible navigation before concluding the latter: a late restore costs an
      // invisible menu for a moment, an early one is the flash.
      const deadline = performance.now() + EXIT_RESTORE_GIVEUP_MS
      const waitForUnmount = () => {
        if (!col.isConnected) return // the normal path: React took it away, nothing to hand back
        if (performance.now() < deadline) {
          requestAnimationFrame(waitForUnmount)
          return
        }
        anim.cancel() // release the `forwards` fill holding it at scale(0)
        col.style.transformOrigin = ""
      }
      requestAnimationFrame(waitForUnmount)
    }
    anim.addEventListener("finish", finish)
    // An unmount mid-exit CANCELS the animation, so `finish` would never fire and `done` — the real
    // clear — would never run. The timer is that backstop, not a workaround for a flaky event.
    const timer = setTimeout(finish, exitMs + 80)
    exitTimers.current.push(timer)
  }

  // Clearing level `j`'s selection takes columns `j+1`…frontier away TOGETHER, so the whole sub-branch
  // has to reverse — animating only its topmost menu would leave the deeper ones parked on screen
  // until they popped out from under it. Each shrinks into ITS OWN parent's chosen row, which is the
  // exact mirror of the entrance (where re-disclosing a branch grows every menu below out of its own
  // parent's row). `done` — the real clear — fires once, after the last one settles.
  //
  // THE STACK COLLAPSES INWARD (Mike): the menus go in ORDER, deepest first, each starting a beat
  // after the one it opened — so the cascade telescopes back toward the root instead of every menu
  // vanishing at once. Deepest-first is what "inward" means here: a menu retracts into its parent only
  // after its own child is gone, so no menu is ever left floating with its opener already gone.
  const exitBranch = (from: number, done: () => void) => {
    const cols = rendered
      .map((_l, i) => i)
      .filter((i) => i >= from)
      .reverse()
    if (cols.length === 0) {
      done()
      return
    }
    setExitTick((n) => n + 1) // restart the connector's measure loop so the lines retract WITH the menus
    let pending = cols.length
    const oneDone = () => {
      if (--pending === 0) done()
    }
    // `done` (the real clear) waits for the LAST menu, so the whole stack is gone before the levels
    // change and React unmounts the columns out from under the animation.
    cols.forEach((i, k) => {
      if (k === 0) {
        exitCol(i, oneDone)
        return
      }
      const t = setTimeout(() => exitCol(i, oneDone), k * exitStaggerMs)
      exitTimers.current.push(t)
    })
  }

  return (
    <div
      ref={containerRef}
      onScrollCapture={reMeasure}
      onPointerOver={reMeasure}
      onPointerOut={reMeasure}
      onFocus={reMeasure}
      onBlur={reMeasure}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      {rendered.map((level, i) => {
        const isRootList = i === 0
        const offscreen = immersed || i < hidden
        const revealed = inGroup(i) && !offscreen
        const zLifted = !offscreen && zFrom >= 0 && i >= zFrom
        const groupTrailing = revealed && i === rendered.length - 1
        return (
          <div
            key={level.id}
            data-htd-col={i}
            // Hover open/close is NOT per-column here: the auto-DISCLOSE trigger rect (left of the
            // topmost menu, below the breadcrumbs) opens the cascade, and the tracking rect governs
            // the auto-collapse — both measured on the container above. So the columns carry no
            // pointer-enter/leave of their own.
            aria-hidden={offscreen || undefined}
            inert={offscreen || undefined}
            style={{
              left: leftOf(i),
              top: topOf[i],
              width: boxWidth(i),
              // The root fills the full height; a child hugs its rows, capped at the container's
              // bottom (its inner list then scrolls). `min-h-0` down the chain lets it shrink to
              // the cap so the list scrolls rather than overflowing.
              ...(isRootList
                ? { bottom: 0 }
                : { maxHeight: `calc(100% - ${topOf[i]}px)` }),
              zIndex: zLifted ? REVEAL_Z + i : i + 1,
              // The floating card's edges: every non-root list floats — over its covered parent
              // and/or the detail — so it always casts the layered-card left edge.
              boxShadow:
                [groupTrailing && SHADOW_RIGHT, i > 0 && SHADOW_LEFT].filter(Boolean).join(", ") ||
                undefined,
            }}
            className={cn(
              // `top` is deliberately NOT transitioned (see `animate`): only the horizontal
              // geometry eases, so a cover/reveal slides the lists sideways while a selection
              // drops the new list in. `overflow-hidden` clips the off-screen peek and the
              // `maxHeight` cap.
              "absolute flex flex-col overflow-hidden",
              // (#2) The ROOT's enclosing box takes the root menu's OWN surface (`bg-apt-nav`) so the
              // rail — 96% opaque — reads as a solid fill of its container, with no page background
              // bleeding through at the edges. Every OTHER box stays `bg-apt-bg` (opaque): a child
              // OVERDRAWS its covered ancestors at rest, and a lifted member floats over the detail —
              // both need a fully opaque backing (the rail's own bg is only 96%).
              isRootList ? "bg-apt-nav" : "bg-apt-bg",
              // Every child menu carries a full, defined border so the overlapping cards read as
              // distinct sheets, not just a soft shadow. The root is borderless (it is the ground
              // the cascade sits on).
              !isRootList && "border border-apt-border",
              offscreen && "pointer-events-none",
              !isRootList && animate && "transition-[left,width,box-shadow] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
              // THE ROOT'S WIDTH ALWAYS EASES (Mike) — it is the ground under the whole stack, and it
              // only ever moves when the stack has settled (see `groundRight`), so it is never the
              // list that must "land in place": `inPlace` would make the ground SNAP instead. Gated on
              // `dragging` alone so a rail drag still tracks the pointer with no lag. Its `left` is
              // always 0, so there is nothing else here worth transitioning.
              isRootList && !dragging && "transition-[width,box-shadow] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
            )}
          >
            {/* A SUBMENU WITH NOTHING CHOSEN YET wears the same gold rail a selected root row wears
                (Mike), running its full height down its left edge — and the parent's connector lands
                on that rail's midpoint. Together they say "this whole list is the current step", with
                no row singled out. It goes the moment an item is chosen, at which point the connector
                re-points at that row and the rail's job is done. Never the root: it is the ground, not
                a disclosed submenu. `z-10` clears the rail's own surface.

                It is the SAME LINE as the connector that lands on it, so it takes the connector's
                exact width and colour from `CHAIN_STROKE_PX` / `apt-gold` — see that constant. */}
            {!isRootList && level.selectedId == null && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 bg-apt-gold"
                style={{ width: CHAIN_STROKE_PX }}
              />
            )}
            {/* The rail keeps its FULL width regardless of the wrapper's (only an off-screen
                wrapper narrows — the covered stack's clip technique — so rows never reflow during
                the slide-off). The inner div is also the flex hug/scroll chain: the wrapper hugs
                it, `maxHeight` caps it, `min-h-0` lets the rail's list scroll under the cap.
                THE ROOT is `rootWidth` — the whole stack's width — so its solid surface paints
                right up to the detail with no darker 96%-only strip left over (see `rootWidth`), and
                it eases in step with its enclosing box so the two edges never separate mid-flight. */}
            <div
              style={{ width: isRootList ? rootWidth : railWidth(level) }}
              className={cn(
                "flex min-h-0 flex-col",
                isRootList && "flex-1",
                isRootList && !dragging && "transition-[width] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
                // DIM RULE (Mike) — it keys off THIS MENU'S SELECTION, nothing else. A menu with a
                // selection dims every row except the chosen one, so the chosen path reads straight
                // down the cascade; a menu with NOTHING selected dims nothing, because there is no
                // choice yet to contrast against (that is the frontier — the list you are picking
                // from). Cover/reveal/root state deliberately does NOT enter into it. `:hover`
                // un-dims a row for as long as the pointer is on it, so a dimmed row stays readable
                // on approach.
                level.selectedId != null &&
                  "[&_[data-htd-row]:not([aria-current=true]):not(:hover)]:opacity-40",
              )}
            >
              <TopicRail
                title={level.title}
                // Rows are ALWAYS full — a covered list is simply overdrawn by its child.
                covered={false}
                isRoot={isRootList}
                selectionStyle="marker"
                items={level.items}
                selectedId={level.selectedId}
                // A select from a list at rest roots a branch reveal here, exactly as in
                // CoveredStack (must-root-reveal-on-covering-select): the select that covers this
                // list must not snap it shut under the pointer.
                //
                // ALWAYS re-root at the list being selected IN, even when it is already part of an
                // open reveal. `hoverId` is rooted at the FRONTIER, and a selection here REBUILDS
                // everything below this list — so the frontier it points at is usually the level the
                // selection is about to destroy. Leaving it there strands `hoverId` on a level that
                // no longer exists, the reveal silently dies, and with it the `groundRight` latch:
                // the root's width would snap and shove the whole UI sideways mid-interaction. The
                // list clicked in always survives, so it is the one safe anchor.
                // UN-selecting reverses the entrance (Mike): re-clicking this list's selected row
                // clears it, which takes the menus BELOW (`i+1`…) away — so they shrink back into the
                // rows that opened them before the clear lands. Without this the ✕ was the only
                // animated close and a re-click just made the menu vanish.
                onSelect={(id) => {
                  setHoverId(level.id, hoverAll && inGroup(i))
                  railOnSelect(level, attemptExit, (clear) => exitBranch(i + 1, clear))(id)
                }}
                emptyLabel={level.emptyLabel ?? "Nothing here yet."}
                onNew={level.onNew}
                newLabel={level.newLabel}
                newActive={level.newActive}
                titleActions={level.titleActions}
                railSlot={level.railSlot}
                headerSlot={level.headerSlot}
                // (#1) Tighten the bottom padding so a short, hugging menu doesn't trail dead space
                // under its last row.
                denseBottom
                // No hover bar in the menus (Mike): hovering a row is already conveyed by it
                // UN-DIMMING (see the dim rule above), so the left white bar was a second, competing
                // read of the same state. Every other rail keeps it.
                hoverBar={false}
                // (#4) ONLY the TOPMOST (frontier) menu gets a right-justified close (✕) in its
                // header — not every child. It dismisses that menu and clears the selection in the
                // PARENT list that opened it (the root, with no parent, never qualifies); the clear
                // routes through the exit guard like every other de-selection.
                //
                // CLOSING MUST NOT AUTO-COLLAPSE THE MENUS LEFT OPEN (Mike). Two things would snap
                // a fully-disclosed stack shut, so the reveal has to be carried across the close:
                // dropping `hoverId` outright, and — since the disclose trigger roots `hoverId` at
                // the FRONTIER, the very list this ✕ removes — leaving it dangling on a level that
                // no longer exists. So re-root the reveal at the list that BECOMES the frontier,
                // keeping its `hoverAll` scope. Only when no reveal is open do we clear (matching
                // the old behaviour, where it was a no-op). The tracking rect still collapses the
                // stack once the pointer actually leaves it — that is the one thing that should.
                onClose={
                  i === frontier && !isRootList
                    ? () => {
                        const parent = rendered[i - 1]!
                        setHoverId(hoverIndex >= 0 ? parent.id : null, hoverAll)
                        // Re-rooting the reveal above cannot move anything (`hoverAll` groups from
                        // `hidden` either way), so the box the exit measures is the box on screen.
                        // This ✕ is only ever on the frontier, so the branch here is this one menu.
                        attemptExit(() => exitBranch(i, () => parent.onClear()))
                      }
                    : undefined
                }
                closeLabel={`Close ${level.title ?? "menu"}`}
                // Never the icon strip (that is the minimized style's drawing of "hidden"); the
                // trailing-border handle still resizes the rail — EXCEPT on the root.
                collapsed={false}
                onToggle={() => {}}
                // THE ROOT IS NOT RESIZABLE. Its width is DERIVED — it is the ground, sized to span
                // the whole stack (`rootWidth`) — so there is no user-owned width to drag, and a drag
                // actively corrupts the layout: `onResize` reports the RAW POINTER X, which lands in
                // `widths[root.id]`, feeds `railWidth(root)` → `disclosedAdvance` → `left[]` →
                // `stackRight` → back into `rootWidth`. Worse, the handle is `right-0` of the rail and
                // `h-full`, so widening the root to the ground put a 6px invisible full-height
                // col-resize strip exactly ON the root/detail seam — the spot you cross to reach the
                // menus. One stray click-drag there and the root jumps to whatever x the pointer was
                // at (Mike caught it at 335px, overpainting the detail). Passing no `onResize` renders
                // no handle at all, and `widths[root.id]` can then never be set.
                onResize={isRootList ? undefined : (w) => onResizeLevel(level, w)}
                onResizeStart={isRootList ? undefined : () => setDragging(true)}
                onResizeEnd={isRootList ? undefined : () => setDragging(false)}
                showToggle={false}
                // The header's leading control slot, exactly as in CoveredStack: the stack-wide
                // auto-hide toggle on the ROOT; on every other list the `«`/`»` that covers/
                // uncovers THIS list's PARENT (the list to its left).
                leftControl={
                  isRootList ? (
                    <AutoHideToggle autoHide={autoHide} onToggle={toggleAutoHide} />
                  ) : (
                    coverControl(i - 1)
                  )
                }
                // The layered-card left shadow rides the wrapper (a rail's own shadow would be
                // clipped by the wrapper's overflow).
                coveredShadow={false}
                // (#2) The ROOT rail FILLS its full-height column with its OWN (solid) nav surface, so
                // the area below its rows reads as filled — not the single 96%-opaque enclosing box
                // layer, which showed darker/empty under the rows. Child menus keep hugging their rows
                // (no fill), so the cascade still steps.
                className={isRootList ? "flex-1" : undefined}
              />
            </div>
          </div>
        )
      })}
      {/* Selection connectors: gold elbows linking each selected parent row to its selected child —
          lifted above an open branch exactly as in CoveredStack. */}
      <SelectionConnectorOverlay
        paths={connectors}
        zIndex={zFrom >= 0 ? REVEAL_Z + rendered.length : undefined}
      />
      {/* DEBUG — the mouse-detection frames, off unless the Debug panel's "Show Mouse Detection
          Frames" is on. They are the ONLY way to see these regions: both are invisible by
          construction, and a rect that is one frame STALE looks identical to a correct one. Drawn in
          viewport coords (they are measured that way), `position: fixed`, inert, above everything.
            BLUE   = the MENU REGION — the ONE authority. While the pointer is inside it the ground is
                     latched AND any open reveal is held; the moment it leaves, both release. This is
                     the single rect that used to be two (a separate "collapse" and "ground held"),
                     which is exactly the unification this refactor is.
            GREEN  = the DISCLOSE/trigger rect — entering it opens the cascade.
          Both are drawn whether or not ARMED (must-draw-every-detection-frame) — dashed and "(off)"
          when inert rather than omitted. Omitting them is how the switch came to look broken: with
          `autoHideTopics={false}` nothing is covered, so the trigger has nothing to disclose; a
          dashed frame says that out loud, an empty screen doesn't. */}
      {showDebugFrames && (
        <>
          {regionRect && (
            <DebugFrame rect={regionRect} color="#3b82f6" label="menus held" armed={pointerInMenus} />
          )}
          {triggerRect && (
            <DebugFrame rect={triggerRect} color="#22c55e" label="disclose" armed={triggerArmed} />
          )}
        </>
      )}
      {/* The detail (leaf) pane — pinned BESIDE THE ROOT LIST at full height, UNDER the deeper
          lists (z 0 vs their i+1): the cascade discloses over it like menus over content, and it
          never moves with the cascade. Its top-left carries the immersion toggle (`«` slides every
          list off-screen and the detail to the left edge; `»` restores). The strip sits above the
          first child's top (one header height), so it stays reachable. */}
      <section
        key={DETAIL_PIN}
        style={{ left: detailLeft, width: detailWidth, zIndex: 0 }}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col overflow-auto bg-apt-surface",
          // The detail TRANSLATES WITH THE ROOT'S TRAILING BORDER (Mike) — same duration and easing
          // as the root's width above, and driven by the same `groundRight`, so the two edges travel
          // as one seam instead of one chasing the other. Gated on `dragging` alone for the same
          // reason as the root: `inPlace` is about a NEW list landing, and the detail is never new.
          //
          // `left` ONLY — NEVER `width`. This pane holds the entire detail view, so transitioning its
          // width re-lays-out all of that content on every frame for 300ms: the whole page visibly
          // churns, which reads as a flash across the window (Mike: "the contents inside this should
          // not be animated on disclosure"). Animating `left` alone moves the box without touching
          // its content's layout — a TRANSLATION, which is what was asked for. `width` lands
          // immediately, so the content reflows once, off-frame, instead of sixty times.
          !dragging && "transition-[left] duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
        )}
      >
        {rendered.length > 0 &&
          (detailTitle !== undefined ? (
            <div className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border bg-apt-nav pr-2">
              <div className="flex w-8 shrink-0 items-center justify-center">{immersionControl}</div>
              <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
                {detailTitle}
              </span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center border-b border-apt-border bg-apt-nav px-1.5 py-1.5">
              {immersionControl}
            </div>
          ))}
        <DetailContent token={structureSignature(rendered)} minWidth={minDetailWidth} mem={mem}>
          {children}
        </DetailContent>
      </section>
    </div>
  )
}

/**
 * The NARROW layout — the stack as an iOS `UINavigationController`.
 *
 * When only a detail can fit (a phone, or a window narrowed past one list + `minDetailWidth`), the
 * side-by-side model has nothing left to trade: peeks, cover toggles and the hover reveal are all
 * pointer affordances on room that no longer exists. So the view stops being a row of columns and
 * becomes a NAVIGATION STACK — exactly one FULL-WIDTH pane at a time:
 *
 *   [ Regions ]  →  [ Ecosystems ]  →  [ Topics ]  →  [ detail ]
 *
 * The visible pane is the deepest one the selection reaches: the FRONTIER list while it is still
 * being chosen from, and the detail once every level is selected. Selecting **pushes** the next pane
 * in from the right; **Back** (top-left of every pane but the root) pops it back out, clearing exactly
 * the deepest selected level — the same `onClear` the breadcrumb and the wide layout's Back use, so
 * the unsaved-work guard applies identically. The pane behind the top one parallaxes a little (as iOS
 * does) and is `inert` + `aria-hidden`, so only the visible pane is reachable.
 *
 * Panes are rendered for EVERY level (not just the ones in the current path), so a pane exists to
 * slide in from the right before it becomes the top — and a popped pane slides back OUT instead of
 * vanishing. `anim` lags `top` by one frame for the same reason: a pane that mounts already at its
 * final position cannot transition, so we paint it off-screen once, then move it.
 */
function NarrowStack({
  levels,
  firstUnselected,
  frontier,
  deepestSelected,
  detailTitle,
  attemptExit,
  narrowTop,
  setNarrowTop,
  children,
}: StackProps & { levels: TopicLevel[] }) {
  // The top of the navigation stack: the detail (index `levels.length`) once every level is selected,
  // else the frontier list — the one with nothing chosen in it yet.
  const top = firstUnselected === -1 ? levels.length : frontier
  // The position the panes are RENDERED at. It catches up to `top` one frame later, so the pane being
  // pushed is painted off-screen FIRST and its move to centre is a transition rather than a jump — an
  // element that mounts at its final transform has nothing to animate from.
  //
  // It seeds from the pane the stack was last painted at, which is why this lives in the surface store
  // (see `SurfaceState.narrowTop`) rather than in this component: pushing a pane means selecting a row
  // means a route change means a REMOUNT, so a fresh `useState(top)` would start every push already
  // finished. On a genuinely fresh load there is no previous pane and nothing to slide from, so the
  // first paint simply lands.
  const [anim, setAnim] = useState(narrowTop ?? top)
  useLayoutEffect(() => {
    if (anim === top) {
      setNarrowTop(top) // settled: this is what the next push/pop animates FROM
      return
    }
    const id = requestAnimationFrame(() => setAnim(top))
    return () => cancelAnimationFrame(id)
  }, [anim, top, setNarrowTop])

  // Back pops one pane: clear the deepest SELECTED level (exit-guarded, like every other clear).
  const onBack = () => attemptExit(() => levels[deepestSelected]?.onClear())
  const backButton = deepestSelected >= 0 && (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      title="Back"
      className="flex shrink-0 items-center rounded p-0.5 text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
    >
      <ChevronLeft size={18} aria-hidden />
    </button>
  )

  // A pane's place in the animation: the top one fills the view; the ones behind it parallax left (an
  // iOS push reveals the pane underneath moving at a fraction of the speed); the ones ahead of it wait
  // off the right edge. Deeper panes stack ABOVE shallower ones, so the incoming pane covers its parent.
  const paneStyle = (i: number): CSSProperties => ({
    transform:
      i === anim ? "translateX(0)" : i < anim ? "translateX(-30%)" : "translateX(100%)",
    zIndex: i + 1,
  })
  // Every pane — the topic lists AND the detail — slides on the same transition: EASE-IN-OUT, so the
  // push and the pop both accelerate out of rest and settle back into it rather than snapping to a
  // stop. Deliberately NOT gated on `motion-reduce` — see the note on the entrance constants.
  const paneClass = (i: number) =>
    cn(
      "absolute inset-0 flex flex-col",
      "transition-transform duration-[calc(300ms*var(--apt-anim-scale,1))] ease-in-out",
      i !== anim && "pointer-events-none",
    )

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {levels.map((level, i) => (
        <div
          key={level.id}
          data-htd-col={i}
          style={paneStyle(i)}
          className={paneClass(i)}
          aria-hidden={i !== anim || undefined}
          inert={i !== anim || undefined}
        >
          <TopicRail
            title={level.title}
            isRoot={i === 0}
            // The pane IS the screen here, so the rail must FILL it. Left to itself the rail sizes to
            // its rows — right in the wide stack, where each list is a stretched grid cell, but in a
            // flex pane it leaves everything under the last row transparent: you see straight through
            // to the parallaxed pane behind it and then to the page. Its trailing border goes too —
            // at full width it is a hairline down the edge of the screen, separating nothing.
            className="min-h-0 flex-1 border-r-0"
            // No connector overlay in this layout (there is never a parent list on screen to connect
            // FROM), so selection falls back to the primitive's own gold bar — visible again when Back
            // pops you onto the parent list.
            selectionStyle="bar"
            // Every row here — the topic lists AND (implicitly, by never reaching this component) not
            // the leaf detail — pushes the NEXT pane on select; a trailing chevron is the only hint of
            // that a full-width pane can give (there's no peeking sibling column left to imply it).
            rowDisclosure
            items={level.items}
            selectedId={level.selectedId}
            onSelect={railOnSelect(level, attemptExit)}
            emptyLabel={level.emptyLabel ?? "Nothing here yet."}
            onNew={level.onNew}
            newLabel={level.newLabel}
            newActive={level.newActive}
            titleActions={level.titleActions}
            railSlot={level.railSlot}
            headerSlot={level.headerSlot}
            // Nothing to disclose, cover or resize: the pane IS the whole view.
            collapsed={false}
            onToggle={() => {}}
            showToggle={false}
            backSlot={i > 0 ? backButton : undefined}
          />
        </div>
      ))}
      {/* The detail — the last pane. Its Back pops the deepest selection, which lands you back on the
          list you chose from. Full width by definition, so no `minDetailWidth` and no horizontal scroll. */}
      <section
        key="__detail__"
        data-htd-col={levels.length}
        style={paneStyle(levels.length)}
        className={cn(paneClass(levels.length), "overflow-auto bg-apt-surface")}
        aria-hidden={levels.length !== anim || undefined}
        inert={levels.length !== anim || undefined}
      >
        {backButton && (
          <div className="flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border bg-apt-nav px-1.5">
            {backButton}
            {detailTitle !== undefined && (
              <span className="min-w-0 flex-1 truncate font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
                {detailTitle}
              </span>
            )}
          </div>
        )}
        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
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
