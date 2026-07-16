/**
 * The cascading menu view's DECISIONS, extracted from the component as pure data + pure functions.
 *
 * Why this file exists: every rule in here was reported as a bug, fixed, and then REGRESSED by a
 * later fix — because each one lived as a boolean expression tangled into a 3000-line component
 * where nothing named it and nothing could test it. `mayMoveGround` was `hoverIndex < 0 && …`, which
 * quietly became "always true" the day `autoHideTopics` went false and no list was ever covered
 * again; that single silent change broke the ground latch AND both mouse-detection frames at once,
 * and none of it was visible at the call site.
 *
 * So the rules are HERE, named, and each one is pinned by a test that cites the recipe rule it
 * implements (`recipes/hierarchical-topic-detail.md`, "Cascading view — motion, ground and the
 * selection chain"). A behaviour that has a rule id here cannot silently regress: it fails a test.
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

// ─── The ground: the root list's width, and when it is allowed to move ────────────────────────────

/**
 * May the ground (the root list's right edge, which is also the detail's left edge) move to the
 * stack's current extent? (**must-hold-the-ground-under-the-pointer**)
 *
 * The ground is load-bearing: the root's width AND the detail's position both hang off it, so moving
 * it moves everything. Moving it WHILE THE USER IS IN THE MENUS shoves the UI around under the
 * pointer mid-gesture — which is what "clicking Integrations resized the root list" and "unselecting
 * Integrations resized the root list" both were.
 *
 * The rule is therefore about the POINTER, not about the selection: the layout may settle once the
 * user has moved out of the menus, and not before. Selecting, unselecting, opening and closing
 * submenus all leave it exactly where it is.
 *
 * `latched` distinguishes "held at a remembered width" from "never measured" — on a first paint
 * there is nothing to hold and the ground must take the real width, or the stack renders at zero.
 *
 * This USED to read `hoverIndex < 0 && (rootHasSelection || !pointerInRoot)`, i.e. "no hover reveal
 * is open". That was a proxy for "the submenus are collapsed", and it silently stopped meaning that:
 * a reveal only exists when some list is COVERED, and once `autoHideTopics` went false nothing was
 * ever covered, so `hoverIndex` was pinned at −1 and the ground was pinned at "always free to move".
 * The lesson is in the shape of the fix — this asks about the pointer, which is what the rule was
 * always about, instead of inferring it from a mechanism that can switch itself off.
 */
export function mayMoveGround({
  pointerInMenus,
  latched,
}: {
  /** Is the pointer inside the menu region (`menuRegion`) — the same authority the reveal uses? */
  pointerInMenus: boolean
  /** Has a ground width ever been recorded for this surface? */
  latched: boolean
}): boolean {
  if (!latched) return true // first paint: nothing to hold, so take the real width
  return !pointerInMenus
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
 * the pointer is "in the menus", which governs BOTH the reveal's held-state AND the ground latch.
 *
 * This exists because the two were computed separately and both fragilely: the reveal's held-state
 * was `hoverIndex >= 0` (which depends on width pressure, measured a beat after the click) tested
 * against an EFFECT-measured `revealRect` (a render behind whenever the layout was still settling),
 * and the ground had its own `stackRect`. Choosing a row remounts the whole subtree, so "a beat
 * late" and "a render behind" are the norm on exactly the interaction that must not collapse — and
 * the result was untraceable. One region, read FRESH from the DOM at pointer-event time (never from
 * React state), removes the staleness entirely: the test is always against what is painted now.
 *
 * The region spans the CONTAINER's full height on the left (`container.top/bottom`), because the root
 * list is full height — moving up or down the root column, or into the gutter beside it, must never
 * read as "left the menus". Its right/bottom hug the actual columns. Erring generous (holding open in
 * a dead corner of the box) is the safe direction: the failure it replaces was collapsing under the
 * pointer, and "clicking does nothing; only a deliberate move OUT collapses" wants the benefit of the
 * doubt to fall on staying open. Null when there are no columns to measure.
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
    left = Math.min(left, container.left)
    top = Math.min(top, container.top)
    bottom = Math.max(bottom, container.bottom)
  }
  return { left, top, right, bottom }
}

/** Is `(x, y)` inside `r`? Edges count as in. */
export function pointInRegion(r: MenuRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

// ─── The reveal: what is open, and the ONLY two things that may close it ────────────────────────────

/**
 * The open reveal: which list's branch is held open (`root`), and whether it spans EVERY on-screen
 * list (a pointer ENTER — `all: true`) or only the rooted list's own branch (a covering SELECT —
 * `all: false`, so a click never springs the user's collapsed parents open,
 * must-not-expand-parents-on-select).
 */
export type RevealState = { root: string | null; all: boolean }
export const NO_REVEAL: RevealState = { root: null, all: false }

/**
 * The COMPLETE set of things that may change the reveal — the whole point of naming them.
 *
 * A `root` is the ONLY opener, and a SELECT dispatches exactly that: choosing a row RE-ROOTS the
 * reveal at the list clicked in, it never closes it. The only two closers are the pointer leaving the
 * menus and an explicit disclosure toggle. There is deliberately no "select" or "click" event here:
 * that a click cannot close a reveal is the invariant whose absence let a click collapse the menus,
 * so it is encoded as an unrepresentable state. A future edit that wants to close on select has to
 * add a new event, and `revealClosedBy`'s test will reject it.
 */
export type RevealEvent =
  | { type: "root"; id: string; all: boolean } // hover-enter (all) OR covering-select (branch)
  | { type: "pointerLeftMenus" } // the pointer left the region — the ONE auto-collapse
  | { type: "settle" } // a «/» or immersion toggle: settle the layout NOW (an explicit action)

export function reduceReveal(_prev: RevealState, e: RevealEvent): RevealState {
  switch (e.type) {
    case "root":
      return { root: e.id, all: e.all }
    case "pointerLeftMenus":
    case "settle":
      return NO_REVEAL
  }
}

/**
 * Does this event CLOSE the reveal? True for exactly the pointer-leave and the explicit toggle;
 * false for a root. "Auto-collapse is `pointerLeftMenus` and nothing else" is this function, and a
 * click never reaches it — which is what "clicking does nothing wrt auto-collapse" means in code.
 */
export function revealClosedBy(e: RevealEvent): boolean {
  return e.type === "pointerLeftMenus" || e.type === "settle"
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
  revealOpen,
  immersed,
  anyCovered,
}: {
  /** Is a reveal already open? (Then there is nothing to trigger — the cascade is already disclosed.) */
  revealOpen: boolean
  immersed: boolean
  anyCovered: boolean
}): boolean {
  return !revealOpen && !immersed && anyCovered
}
