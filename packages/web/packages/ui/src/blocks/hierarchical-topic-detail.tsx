"use client"

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
   *      height. Each deeper list opens to the RIGHT of the row selected in its parent, its TOP
   *      aligned to the top of that selected row, and its height HUGS its own rows (capped at the
   *      container bottom, scrolling past it). Covering — auto-hide, the `«`/`»` pins, width
   *      pressure, the hover branch reveal — works exactly as in `covered`; only the vertical
   *      placement differs. */
  disclosureStyle?: "minimized" | "covered" | "cascading"
  /** Start with every list above the FRONTIER (the deepest rendered list) hidden — covered by its
   *  child to a peek (the `covered` and `cascading` styles) or an icon strip (`minimized`) — even
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

// The z-floor of a hover-revealed branch: its members lift to REVEAL_Z + i so the whole cascade
// floats over the detail. The connector overlay rides just above the highest member (see below), so
// the gold selection chain still crosses the branch it links.
const REVEAL_Z = 50

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
        // A connector joins a selected PARENT row to a selected CHILD row — nothing else. A child
        // rail that is open with NOTHING selected gets NO line into it (spec:
        // must-connect-selected-rows-only — an unselected list's landing is the topic overview,
        // and a line pointing at whatever row happens to sit at the parent's height reads as a
        // phantom selection).
        if (!p || !c) continue
        if (p.rightX < 0 || c.left > crect.width) continue // an endpoint drilled off-screen
        const boundary = c.left // the child column's current left edge (the bend)
        const startX = Math.min(p.rightX + 6, boundary - 4) // just past the parent's visible content
        // The elbow after the parent's horizontal run: to the child column's edge (the bend), down/up
        // to the child row, then in to just before its icon.
        const elbow = `L ${boundary} ${p.y} L ${boundary} ${c.y} L ${Math.max(c.iconLeft - 6, boundary + 2)} ${c.y}`
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
    >
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
                "transition-[left,width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
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

/**
 * The "cascading" disclosure style — a VERTICAL cascade (nested-menu layout).
 *
 * Only the ROOT list is full height, on the left. Every deeper list is the CHILD of the row selected
 * in its parent: it opens to the RIGHT of that parent, its TOP aligned to the top of the selected
 * parent ROW, and its height HUGS its own rows — capped at the container's bottom, scrolling past it.
 * So the stack reads as a chain of menus dropping down-and-right from each choice, instead of a row of
 * equal-height columns. The leaf detail fills the remaining width on the right at full height (it is
 * content, not a topic list, so the "align + hug" rule does not apply to it).
 *
 * ONLY the vertical placement differs from `covered`: the disclosure machinery is the covered
 * stack's, unchanged — auto-hide and the `«`/`»` pins slide a list LEFT under its child to a 40px
 * peek (its rows stay intact behind the clip; nothing is removed from the list), width pressure
 * covers leftmost-first until the detail keeps its minimum, and hovering a covered list reveals
 * the branch floating over the detail. A covered list's vertical footprint still hugs its rows at
 * its cascade position (covering is a horizontal clip, so the staircase never moves). Kept as its
 * own component so either layout can evolve or be deleted independently — the price is the
 * mirrored covering logic, annotated where it is ported verbatim.
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
  const minPx = minDetailPx(minDetailWidth)
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

  // COVERING — CoveredStack's rules, ported verbatim (see there for the full rationale of every
  // layer). The frontier stays uncovered while it has no selection, and an unselected frontier's
  // placeholder claims no minimum width (must-not-hide-frontier-choosing-list).
  const coverableCount = firstUnselected === -1 ? rendered.length : frontier
  const detailMin = firstUnselected === -1 ? minPx : 0

  // COVER LAYER 1 — intent: the user's pin (`«`), else auto-hide's default for every list above
  // the frontier.
  const pinnedOrAutoHidden = (i: number): boolean => {
    if (i >= coverableCount) return false
    return pins[rendered[i]!.id] ?? (autoHide && i < frontier)
  }

  // COVER LAYER 2 — width pressure: cover MORE lists, leftmost-first, until the detail keeps its
  // minimum. Only ever ADDS a cover — never discloses one the user pinned shut.
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

  // PHASE 2 — OFF-SCREEN: every list at its peek and the detail minimum STILL doesn't fit — slide
  // the leftmost lists off the left edge, whole lists at a time (see CoveredStack).
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

  // HORIZONTAL layout pass (running x): a covered list advances x only by its peek, so its child
  // slides left to partially cover it — exactly the covered stack's horizontal model.
  const left: number[] = []
  let x = 0
  rendered.forEach((_l, i) => {
    left.push(x)
    x += widthOf(i)
  })
  const restingDetailLeft = Math.max(0, x - offshift)

  // VERTICAL cascade. Each non-root list's TOP is its parent's top plus where the parent's SELECTED
  // row sits WITHIN the parent's own box. Measuring the offset within the box (not the row's absolute
  // position) makes the measurement independent of where the box currently sits — so one pre-paint
  // pass converges with no feedback loop: moving a child never moves its parent's rows. Covering a
  // list doesn't move its rows either (the peek is a horizontal CLIP), so the staircase is identical
  // covered or disclosed. `rowOffset[i]` is that within-box offset for list `i`'s selected row (0
  // when the list has no selection).
  const [rowOffset, setRowOffset] = useState<number[]>([])
  const rowMeasureRef = useRef<() => void>(() => {})
  // Re-measure when a selection changes, a list's row count changes, or the container width changes;
  // the ResizeObserver below also catches height changes, and the container handlers catch scroll.
  const measureSig = `${rendered.map((l) => `${l.selectedId ?? ""}#${l.items.length}`).join("|")}::${containerW}`
  useLayoutEffect(() => {
    const cont = containerRef.current
    if (!cont) return
    const measure = () => {
      const next: number[] = []
      for (let i = 0; i < rendered.length; i++) {
        const col = cont.querySelector(`[data-htd-col="${i}"]`)
        const sel = col?.querySelector('[aria-current="true"]')
        if (!col || !sel) {
          next[i] = 0
          continue
        }
        next[i] = sel.getBoundingClientRect().top - col.getBoundingClientRect().top
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
  // a child's top is its parent's top plus the parent's selected-row offset.
  const topOf: number[] = []
  rendered.forEach((_l, i) => {
    topOf.push(i === 0 ? 0 : (topOf[i - 1] ?? 0) + (rowOffset[i - 1] ?? 0))
  })

  // THE REVEAL GROUP — CoveredStack's hover branch reveal, ported verbatim (see there for the full
  // story: enter-vs-covering-click rooting, the z-lift that lingers through the wipe-shut, the
  // group-scoped close rules). The one cascade difference: members open at their full widths chained
  // horizontally from the group start, but their TOPS stay the cascade's — revealing is horizontal.
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
      rx += railWidth(rendered[i]!)
    }
  }
  const leftOf = (i: number) => (inGroup(i) ? revealLeft[i]! : left[i]!) - offshift
  const boxWidth = (i: number) => (inGroup(i) ? railWidth(rendered[i]!) : widthOf(i))

  // The reveal PUSHES THE DETAIL RIGHT instead of floating over it, as in CoveredStack.
  const lastIdx = rendered.length - 1
  const revealRight =
    hoverIndex >= 0 && lastIdx >= 0 ? revealLeft[lastIdx]! + railWidth(rendered[lastIdx]!) - offshift : -1
  const detailLeft = Math.max(restingDetailLeft, revealRight)
  const detailWidth = containerW > 0 ? Math.max(0, containerW - detailLeft) : 0

  // Group close rules — ported verbatim: a leave only closes when the pointer lands outside every
  // member, and an open branch also watches the document for a pointer that turns up elsewhere.
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
  useEffect(() => {
    if (hoverId === null) return
    const onPointerOver = (e: PointerEvent) => {
      if (columnIndexOf(e.target) < 0) setHoverId(null)
    }
    document.addEventListener("pointerover", onPointerOver)
    return () => document.removeEventListener("pointerover", onPointerOver)
  })

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

  // Selection connectors (shared): the gold elbow from each selected parent row to its selected child
  // row, reinforcing the cascade. The signature is everything that moves a selected row — the
  // per-level selection, the column left edges, the vertical tops, the off-screen shift and the
  // reveal group.
  const connectorSig = `${rendered.map((l) => l.selectedId ?? "").join("|")}::${left.join(",")}::${topOf.join(",")}::${offshift}::${containerW}::${hoverIndex}`
  const connectorsPossible = rendered.length >= 2 && rendered.some((l) => l.selectedId != null)
  const { connectors, onScroll } = useSelectionConnectors(
    containerRef,
    rendered.length,
    connectorSig,
    connectorsPossible,
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
        const covered = isCovered(i)
        const offscreen = i < hidden
        const parentCovered = i > 0 && isCovered(i - 1)
        const revealed = inGroup(i) && !offscreen
        const zLifted = !offscreen && zFrom >= 0 && i >= zFrom
        const groupTrailing = revealed && i === rendered.length - 1
        const groupLeading = revealed && i === groupStart && i > 0
        return (
          <div
            key={level.id}
            data-htd-col={i}
            // Entering a COVERED list opens the branch rooted at it (see CoveredStack).
            onPointerEnter={() => {
              if (inGroup(i)) return
              setHoverId(covered && !offscreen ? level.id : null, true)
            }}
            onPointerLeave={onGroupPointerLeave}
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
              // The floating card's edges — same composition as CoveredStack.
              boxShadow:
                [
                  groupTrailing && SHADOW_RIGHT,
                  (groupLeading || (parentCovered && !revealed)) && SHADOW_LEFT,
                ]
                  .filter(Boolean)
                  .join(", ") || undefined,
            }}
            className={cn(
              // `top` is deliberately NOT transitioned (see `animate`): only the horizontal
              // geometry eases, so a resize/cover/reveal slides the lists sideways while a
              // selection drops the new list in. `overflow-hidden` is the peek clip.
              "absolute flex flex-col overflow-hidden",
              offscreen && "pointer-events-none",
              animate &&
                "transition-[left,width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
              // A lifted member floats over the detail: give it the page background so the card is
              // opaque (the rail's own bg is 96% opaque — see CoveredStack).
              zLifted && "bg-apt-bg",
            )}
          >
            {/* A covered list renders at its FULL width inside a peek-wide clipped wrapper (the
                covered stack's technique: the wipe never reflows the rows). The fixed-width inner
                div keeps the flex hug/scroll chain intact — the wrapper hugs it, `maxHeight` caps
                it, `min-h-0` lets the rail's list scroll under the cap. */}
            <div
              style={{ width: railWidth(level) }}
              className={cn("flex min-h-0 flex-col", isRootList && "flex-1")}
            >
              <TopicRail
                title={level.title}
                // Rows are ALWAYS full — the wrapper's clip makes the peek (see CoveredStack).
                covered={false}
                isRoot={isRootList}
                selectionStyle="marker"
                items={level.items}
                selectedId={level.selectedId}
                // A select from a list at rest roots a branch reveal here, exactly as in
                // CoveredStack (must-root-reveal-on-covering-select): the select that covers this
                // list must not snap it shut under the pointer.
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
                // Never the icon strip (that is the minimized style's drawing of "hidden"); the
                // trailing-border handle still resizes the rail.
                collapsed={false}
                onToggle={() => {}}
                onResize={(w) => onResizeLevel(level, w)}
                onResizeStart={() => setDragging(true)}
                onResizeEnd={() => setDragging(false)}
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
      {/* The detail (leaf) pane — rightmost, FULL height (it is content, not a topic list, so the
          align+hug rule does not apply). Its top-left carries the frontier list's cover toggle and
          its left shadow turns on when that list is covered — as in CoveredStack. */}
      <section
        key="__detail__"
        style={{ left: detailLeft, width: detailWidth, zIndex: rendered.length + 1 }}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col overflow-auto bg-apt-surface",
          animate && "transition-[left,width] duration-300 ease-in-out motion-reduce:transition-none",
          rendered.length > 0 && isCovered(rendered.length - 1) && "shadow-[-10px_0_22px_-8px_var(--color-shadow)]",
        )}
      >
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
            the viewport. */}
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
  // stop. `motion-reduce` drops the transition entirely, so with the OS setting on the panes cut
  // straight to their new places (the layout is identical, only the travel is gone).
  const paneClass = (i: number) =>
    cn(
      "absolute inset-0 flex flex-col",
      "transition-transform duration-300 ease-in-out motion-reduce:transition-none",
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
