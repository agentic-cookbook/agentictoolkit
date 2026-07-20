/**
 * The cascading menu view's DECISIONS, extracted from the component as pure data + pure functions.
 *
 * Why this file exists: every rule in here was reported as a bug, fixed, and then REGRESSED by a
 * later fix — because each one lived as a boolean expression tangled into a 3000-line component
 * where nothing named it and nothing could test it. A behaviour that has a rule id here cannot
 * silently regress: it fails a test (`cascadeRules.test.ts`, citing the recipe rule it implements —
 * `recipes/hierarchical-topic-detail.md`, "Cascading view — motion, ground and the selection
 * chain").
 *
 * v1.16.0 rebuilt the interaction layer around the STORED state machine below (`CascadeMode`).
 * The previous architecture re-derived the menu geometry on every render and defended the
 * derivation with six accumulated freeze mechanisms (a ground latch, a covering pressure freeze, a
 * frozen-frontier ratchet, an entry-gated trigger, a pointer-evidence clause, a covered-column
 * enter) whose release edges raced each other, the route remount and the live animations — each
 * fix regressed a neighbouring path, which is exactly the history the paragraph above describes.
 * Now the mode is a VALUE: while a gesture is engaged the base geometry is frozen data, a click is
 * not a settling event (unrepresentable, not intercepted), and the final choice is DECLARED by the
 * host rather than inferred from renders.
 *
 * Nothing in this module touches the DOM or React — it is the arithmetic and the policy only, so
 * `cascadeRules.test.ts` covers it exhaustively without a layout engine (jsdom has none, which is
 * exactly why the geometry-dependent half of the component was never testable).
 */

// ─── The selection chain: ONE line ────────────────────────────────────────────────────────────────

/**
 * The selection chain's ONE stroke weight, in CSS px (**must-draw-one-chain-line**).
 *
 * THREE things draw this line and they must be indistinguishable:
 *   1. a selected row's gold left bar — `border-l-2` in `topic-detail.tsx`;
 *   2. the gold rail down an unchosen submenu's left edge — the `<span>` in the cascade;
 *   3. the elbow connectors joining a selected parent row to its child — an SVG stroke.
 *
 * It is 2, and it is 2 BECAUSE of (1): Tailwind's `border-l-2` is the row indicator that has always
 * shipped, so the other two match IT rather than the reverse. The previous value (1.5) was chosen to
 * match the connector's stroke and made things worse — it left the row bar at 2 and disagreeing with
 * both, and a 1.5px line cannot render honestly anyway: it is anti-aliased across 2–3 device pixels
 * at partial alpha, so it reads DIMMER as well as thinner. Two whole pixels land on the grid.
 *
 * That anti-aliasing is also why `SelectionConnectorOverlay` sets `shape-rendering: crispEdges`.
 * Every connector path is axis-aligned (horizontal runs + vertical elbows), so snapping to the pixel
 * grid costs nothing and is the only way an SVG stroke can match a CSS border's crispness — same
 * token (`apt-gold`), same width, and now the same coverage, so the same colour reaches the eye.
 */
export const CHAIN_STROKE_PX = 2

// ─── Motion: the entrance bounces, the exit does not ──────────────────────────────────────────────

/**
 * The entrance's damped bounce (**must-bounce-the-entrance**).
 *
 * The box grows out of the chosen row and oscillates into place, each swing overshooting less than
 * the last: **+10, −10, +5, −5, 0** percentage points around its resting size. One `scale` track
 * carries BOTH the size bounce and the travel bounce, and that is not a shortcut — the transform
 * origin is parked on the chosen row's centre, so `scale(1.10)` puts the box 10% bigger AND 10%
 * further from that row in one number. Size and distance are the same quantity here, which is why
 * the two halves of the spec share these figures.
 *
 * A cubic-bezier CANNOT express this: a bezier's overshoot is a single excursion past the endpoint,
 * so the old `cubic-bezier(0.45, 0, 0.25, 1.28)` could bounce once and no more. Four reversals need
 * four keyframes, so the entrance is a Web Animations keyframe list.
 */
export const BOUNCE_SCALES = [0, 1.1, 0.9, 1.05, 0.95, 1] as const

/**
 * Where each {@link BOUNCE_SCALES} step lands in the entrance, as a fraction of {@link ENTER_MS}.
 * The rise takes ~40% and each swing after it is shorter than the last — the timing damps with the
 * amplitude, which is what makes it read as a bounce settling rather than a zigzag.
 */
export const BOUNCE_OFFSETS = [0, 0.42, 0.6, 0.75, 0.88, 1] as const

/** The rise out of the row: decelerating, so the box sails to its overshoot rather than arriving. */
export const BOUNCE_RISE_EASE = "cubic-bezier(0.2, 0, 0.2, 1)"
/** Every swing after the rise: symmetric, so each reversal eases out of one extreme and into the next. */
export const BOUNCE_SETTLE_EASE = "ease-in-out"

/**
 * How long the entrance runs.
 *
 * 460, not the 300 this shipped with, and the duration is part of the spec rather than taste: the
 * bounce has FIVE segments, and at 300ms the last two are ~25ms each — under two frames at 60Hz, so
 * they cannot be drawn at all. A spec that names four reversals needs a duration that can render
 * them; at 460 the shortest segment is ~55ms (3–4 frames) and every swing is visible.
 */
export const ENTER_MS = 460

/**
 * How long the exit runs. Still 300: a close should get out of the way, and with the wiggle gone
 * (see {@link EXIT_EASE}) there is no choreography left that needs room to be seen.
 */
export const EXIT_MS = 300

/**
 * The exit's curve — **NO WIGGLE ON THE WAY OUT** (**must-not-wiggle-the-exit**).
 *
 * The exit used to be the entrance's exact mirror, `cubic-bezier(0.75, -0.28, 0.55, 1)`, on the
 * reasoning that closing IS opening run backwards. The mirror of an overshoot is an UNDERSHOOT at
 * the start (y1 = −0.28), so every close began by swelling slightly before it shrank — read as a
 * wiggle, and the block's owner asked for it gone. It is the plain mirror of the entrance's curve
 * with the bounce taken out (`cubic-bezier(0.45, 0, 0.25, 1)` reversed), so the exit still moves
 * like the entrance's inverse; it just doesn't anticipate.
 *
 * Reversing `cubic-bezier(x1,y1,x2,y2)` is `cubic-bezier(1-x2, 1-y2, 1-x1, 1-y1)`. Keep both control
 * points' y within [0,1] here and the wiggle cannot come back.
 */
export const EXIT_EASE = "cubic-bezier(0.75, 0, 0.55, 1)"

/**
 * The entrance keyframes. A keyframe's `easing` governs the segment that STARTS at it, so index 0
 * carries the rise and the last frame's easing is (correctly) never used.
 */
export function enterKeyframes(): Keyframe[] {
  return BOUNCE_SCALES.map((scale, i) => ({
    offset: BOUNCE_OFFSETS[i],
    transform: `scale(${scale})`,
    easing: i === 0 ? BOUNCE_RISE_EASE : BOUNCE_SETTLE_EASE,
  }))
}

/** The exit keyframes: straight to nothing on {@link EXIT_EASE}, no overshoot at either end. */
export function exitKeyframes(): Keyframe[] {
  return [
    { offset: 0, transform: "scale(1)", easing: EXIT_EASE },
    { offset: 1, transform: "scale(0)" },
  ]
}

// ─── The cascade's MODE: ONE stored state machine per surface (v1.16.0) ───────────────────────────

/**
 * The geometry a surface was RESTING at when a gesture engaged it — captured ONCE, at the
 * transition, from the settled layout the user is looking at.
 *
 * While the gesture lasts, every column keeps painting from these values: columns left of the
 * reveal root at exactly their frozen lefts and covered flags, columns from the root rightward
 * revealed at their full widths chained from the root's frozen left. So NOTHING the gesture causes
 * — a select advancing the frontier, a new level registering a commit late, width pressure
 * recomputing, the remount a route-param change triggers — can move a menu that is already on
 * screen: the numbers it paints from cannot change, because they are data, not a derivation
 * (**must-hold-the-ground-under-the-pointer**, **must-not-move-the-menus-on-an-intermediate-
 * select**). This single frozen value replaces the ground latch (`mayMoveGround`), the covering
 * pressure/hidden freeze (`heldCover`), and the frozen-frontier ratchet
 * (`ratchetFrozenFrontier`/`coverFrontierWhileChoosing`) of v1.15.x — three interceptors whose
 * release edges raced each other on exactly the clicks they existed to survive.
 */
export type EngagedBase = {
  /** Each on-screen column's resting left edge (container px), in column order. */
  lefts: number[]
  /** Each column's resting covered flag (peeked under its child vs disclosed). */
  covered: boolean[]
  /** How many leftmost columns were slid off-screen at rest. */
  hidden: number
  /** The GROUND — the root list's right edge, which is also the detail's left edge. */
  groundRight: number
}

/**
 * The cascade's TWO states, stored per surface (they must survive the remount a selection causes —
 * **must-keep-view-state-across-a-selection**):
 *
 *   - `settled` — the resting layout: covering, width pressure, off-screen drilling and the ground
 *     all compute LIVE. This is the only state in which base geometry may move.
 *   - `engaged` — a gesture is in progress: geometry is frozen at `base`, and columns from `root`
 *     rightward are revealed at their full widths. `root: null` is engaged-with-nothing-revealed —
 *     the frozen-ground-only state (a stack with nothing covered has nothing to reveal, but its
 *     ground still must not move under the gesture).
 *
 * A CLICK IS NOT A SETTLING EVENT (**must-collapse-from-one-pointer-authority**): the only
 * transitions back to `settled` are the three `SettleReason`s — the pointer provably leaving the
 * menus, an explicit `«/»`/auto-hide/immersion toggle, and (auto-collapse mode only) the FINAL
 * CHOICE. A rail click can only `engageOnRailClick`, which never changes `base` and never returns
 * `settled` — a click that moves the menus is unrepresentable, not intercepted.
 */
export type CascadeMode =
  | { kind: "settled" }
  | { kind: "engaged"; root: number | null; base: EngagedBase }

export const SETTLED: CascadeMode = { kind: "settled" }

/**
 * The pointer ENTERS an open zone — the disclose trigger's approach lane, or a covered peek
 * (**must-auto-collapse-menus-on-final-choice**'s re-open clause: entering IS how a settled
 * cascade re-opens). Engage and reveal EVERYTHING on screen: the reveal roots at the first
 * on-screen column (`hidden`). Idempotent while already engaged — re-entering keeps the existing
 * base (the menus cannot move, only reveal further leftward).
 */
export function engageOnEnter(prev: CascadeMode, base: EngagedBase): CascadeMode {
  if (prev.kind === "engaged") return { ...prev, root: prev.base.hidden }
  return { kind: "engaged", root: base.hidden, base }
}

/**
 * A RAIL CLICK — select, clear or ✕ — anywhere in the menus (**must-not-move-the-menus-on-an-
 * intermediate-select**, T61): engage if not already engaged (capturing the resting layout the
 * click landed on), and root the reveal no deeper than the clicked list. The clicked list and
 * everything the user already walked open stay exactly where they are; parents the user had
 * covered stay covered (**must-not-expand-parents-on-select** — the root only ever RATCHETS
 * shallower, it never springs a covered parent open on a click). An existing base is NEVER
 * replaced and the mode NEVER settles here.
 */
export function engageOnRailClick(
  prev: CascadeMode,
  base: EngagedBase,
  clickedIndex: number,
): CascadeMode {
  if (prev.kind === "engaged")
    return { ...prev, root: prev.root == null ? clickedIndex : Math.min(prev.root, clickedIndex) }
  return { kind: "engaged", root: clickedIndex, base }
}

/**
 * The COMPLETE set of reasons the cascade may settle — the whole point of naming them
 * (**must-collapse-from-one-pointer-authority**). `pointer-exit` is the standing auto-collapse
 * (the pointer provably left the menu region); `toggle` is an explicit `«/»` / auto-hide /
 * immersion click (settling IS the requested action, must-apply-disclosure-toggles-immediately);
 * `final-choice` is the ONE click-driven closure (v1.15.0, auto-collapse mode only). There is
 * deliberately no "rail-click" member: an intermediate select cannot close the menus, and a future
 * edit that wants one has to add it HERE, where the test will make that choice loud.
 */
export type SettleReason = "pointer-exit" | "toggle" | "final-choice"

export function settleModeOn(_reason: SettleReason): CascadeMode {
  return SETTLED
}

// ─── Choosing a row ───────────────────────────────────────────────────────────────────────────────

/** What a click on a rail row does. */
export type RailSelectPlan = {
  /** Select the clicked row, or clear the level (a click on the already-selected row). */
  action: "select" | "clear"
  /** Route through the unsaved-work guard first? */
  guarded: boolean
  /** Play the staggered inward collapse of the levels below this one BEFORE `action` runs? */
  collapse: boolean
}

/**
 * The one place a rail click is decided (**must-own-unselection**, **must-guard-unsaved-on-exit**,
 * **must-animate-every-menu-closure**).
 *
 * The third clause is the one that was wrong. Re-clicking the selected row animated the sub-branch
 * closed; clicking a DIFFERENT row — switching workspace, which tears down exactly the same menus —
 * skipped straight to `onSelect` and the whole cascade vanished in a single frame. Both replace the
 * level's selection and both destroy every menu below it, so both collapse. The only click that does
 * NOT collapse is one into a level with nothing selected yet: there is nothing below to take away.
 */
export function planRailSelect(selectedId: string | null, clickedId: string): RailSelectPlan {
  // A forward drill into an unselected level: nothing open below, nothing to lose, nothing to guard.
  if (selectedId === null) return { action: "select", guarded: false, collapse: false }
  if (clickedId === selectedId) return { action: "clear", guarded: true, collapse: true }
  return { action: "select", guarded: true, collapse: true }
}

// ─── The menu region: the ONE authority for "is the pointer in the menus?" ─────────────────────────

/** A hit-test rectangle in viewport coords. */
export type MenuRect = { left: number; top: number; right: number; bottom: number }

/**
 * The union of the on-screen menu column rects into ONE region — the single authority for whether
 * the pointer is "in the menus", which decides the `pointer-exit` settle.
 *
 * v1.16.0: the rects fed in here come from the LAYOUT MODEL — the lefts/tops the layout assigned
 * and the columns' untransformed layout sizes — NEVER from `getBoundingClientRect` of an animating
 * box. The v1.15.x authority hit-tested every pointermove against whatever was painted at that
 * instant, and that stream inference had window after window: during the remount a select causes
 * nothing is measurable (the 1.15.2 evidence clause patched that one), and during the 300–460ms
 * entrance/exit SCALE animations the painted boxes are shrunk, so a real hand's pixel of drift
 * tested "provably outside" and released every hold at once — invisible to synthetic input, which
 * never moves mid-animation. Settled model rects close the whole class: animation state cannot
 * feed the decision, and a query that cannot be answered (no container, no columns) is simply not
 * a transition.
 *
 * The region HUGS THE MENUS' CONTENT — it must NOT drop to the container's bottom. The detail pane
 * shows below and beside the menus, so a region that ran the container's full height would swallow it,
 * and moving DOWN to the detail (a real "leave the menus") would never collapse them — they would hang
 * over the form instead of getting out of the way. So the container only extends the TOP-LEFT (the
 * approach lane: the breadcrumb gutter above, the peeks / immersion strip to the left), never the
 * bottom or the right — those hug the actual columns. The caller is responsible for passing the
 * full-height ROOT column clamped to its rows' bottom, for the same reason. Null when nothing to
 * measure.
 */
export function menuRegion(colRects: MenuRect[], container: MenuRect | null): MenuRect | null {
  if (colRects.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const r of colRects) {
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  if (container) {
    left = Math.min(left, container.left) // the peeks / immersion strip to the left
    top = Math.min(top, container.top) // the breadcrumb gutter above the first row
  }
  return { left, top, right, bottom }
}

/** Is `(x, y)` inside `r`? Edges count as in. */
export function pointInRegion(r: MenuRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

// ─── The final choice: DECLARED leafness, not retrospective inference (v1.16.0) ──────────────────

/** What a row leads to when chosen: another topic list, or the detail (a FINAL CHOICE). */
export type LeadsTo = "list" | "detail"

/**
 * Resolve a row's declared leafness (**must-hold-the-detail-until-the-final-choice**): the item's
 * own `leadsTo`, else its level's default, else `"detail"`.
 *
 * Whether a chosen row "leads to another topic list" is a fact of the HOST's data, so the host
 * declares it on the data. v1.15.x instead inferred it retrospectively from renders — "the path
 * looks complete, twice in a row" — which needed a two-render confirmation (merged stacks register
 * their deeper list a commit late) and had NO answer for gestures that never complete: a clear
 * made the path incomplete forever, so the hold it had armed never released and the stale pane
 * haunted every surface the navigation landed on. `"detail"` is the FAIL-SAFE default: an
 * undeclared row is a final choice, so the worst a missing declaration can produce is an early
 * pane swap — never a hold without a release edge.
 */
export function itemLeadsTo(
  levelDefault: LeadsTo | undefined,
  item: LeadsTo | undefined,
): LeadsTo {
  return item ?? levelDefault ?? "detail"
}

/** What a rail interaction does to the DETAIL HOLD — decided AT the click, from declared data. */
export type RailHoldPlan = {
  /** Capture the pane's current content (the first interaction of a choosing gesture): the chosen
   *  row discloses another choosing list, so the pane must ride through unchanged (T57). */
  capture: boolean
  /** Release the hold NOW: up-navigation (a clear / ✕ / breadcrumb) is not a choosing gesture —
   *  the pane shows the real frontier state immediately (v1.16.0; the v1.15.x hold armed on clears
   *  but could only release on a complete path, so an unselect never released it). */
  release: boolean
  /** The chosen row IS the final choice: arm the ONE swap, which lands when the click's navigation
   *  applies (`planLeafSettle`). */
  finalChoice: boolean
}

export function planRailHold({
  action,
  leadsTo,
}: {
  /** `planRailSelect`'s verdict for this click. */
  action: "select" | "clear"
  /** The clicked row's resolved leafness (`itemLeadsTo`). */
  leadsTo: LeadsTo
}): RailHoldPlan {
  if (action === "clear") return { capture: false, release: true, finalChoice: false }
  if (leadsTo === "list") return { capture: true, release: false, finalChoice: false }
  return { capture: false, release: false, finalChoice: true }
}

/**
 * When does an ARMED final choice land? (T58/T59/T60.) The click already declared itself final
 * (`planRailHold`), so there is nothing to infer and nothing to confirm across consecutive
 * renders — the only question is WHEN to swap: once the click's navigation has actually applied
 * (the selection chain changed from the one captured at the click) and the path is complete
 * (a merged stack may still be un-registering the old branch's deeper lists for a commit).
 * Pre-navigation renders keep whatever the pane is showing; the landing render swaps ONCE and, in
 * auto-collapse mode, settles the menus on that same click
 * (**must-auto-collapse-menus-on-final-choice** — with auto-collapse OFF nothing collapses, T60).
 */
export function planLeafSettle({
  sigChanged,
  pathComplete,
  autoHide,
}: {
  /** Has the selection chain changed since the final-choice click captured it? */
  sigChanged: boolean
  /** Does every rendered level have a selection? */
  pathComplete: boolean
  /** Auto-collapse mode (`autoHideTopics`) — gates the collapse, never the swap. */
  autoHide: boolean
}): { settle: boolean; autoCollapse: boolean } {
  const settle = sigChanged && pathComplete
  return { settle, autoCollapse: settle && autoHide }
}

/**
 * Does a pointer move fire an OPEN ZONE (the disclose trigger's approach lane, or a covered peek)?
 * Entry-only (**must-auto-collapse-menus-on-final-choice**'s re-open clause): after the final
 * choice closes the menus the pointer has not moved, so nothing may re-open them until it next
 * ENTERS a peek or menu — merely BEING inside a zone (which now covers where the click landed)
 * must not re-disclose the cascade on the first stray pixel of movement. Only the outside→inside
 * crossing opens (`engageOnEnter`). v1.16.0 runs the covered peeks through this same edge gate:
 * the v1.15.2 covered-column `pointerenter` relied on the browser's own boundary events, which
 * Chrome also fires when LAYOUT moves under a stationary pointer — exactly what a final-choice
 * collapse does.
 */
export function triggerFires({
  armed,
  wasInside,
  isInside,
}: {
  armed: boolean
  wasInside: boolean
  isInside: boolean
}): boolean {
  return armed && isInside && !wasInside
}

// ─── The disclose trigger frame ─────────────────────────────────────────────────────────────────────

/**
 * Is the auto-DISCLOSE (green) region live — i.e. would entering it open the cascade?
 *
 * Opening is a SEPARATE authority from the held-region above: this arms the lane, left of the
 * frontier, that a resting (collapsed) cascade opens when the pointer sweeps into it. It depends on
 * `anyCovered` — with nothing covered there is nothing to disclose, so the region is correctly dead,
 * which is precisely why the debug overlay must draw it ANYWAY, dashed. "No green rect on screen" and
 * "the green rect is disarmed because nothing is covered" look identical when the answer is to draw
 * nothing, and the second is the diagnosis.
 */
export function triggerRectArmed({
  engaged,
  immersed,
  anyCovered,
}: {
  /** Is the surface already engaged? (Then there is nothing to trigger — the cascade is disclosed.) */
  engaged: boolean
  immersed: boolean
  anyCovered: boolean
}): boolean {
  return !engaged && !immersed && anyCovered
}
