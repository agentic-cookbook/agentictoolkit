import { describe, it, expect } from "vitest"

import {
  BOUNCE_OFFSETS,
  BOUNCE_SCALES,
  CHAIN_STROKE_PX,
  ENTER_MS,
  EXIT_EASE,
  EXIT_MS,
  SETTLED,
  engageOnEnter,
  engageOnRailClick,
  enterKeyframes,
  exitKeyframes,
  itemLeadsTo,
  menuRegion,
  planLeafSettle,
  planRailHold,
  planRailSelect,
  pointInRegion,
  settleModeOn,
  triggerFires,
  triggerRectArmed,
  type CascadeMode,
  type EngagedBase,
  type MenuRect,
  type SettleReason,
} from "../blocks/cascade-rules"

/**
 * The cascading view's rules, one test per recipe rule id
 * (`recipes/hierarchical-topic-detail.md` — "Cascading view — motion, ground and the selection
 * chain"). Every rule here was reported, fixed, and then REGRESSED by a later fix, which is why the
 * decisions were pulled out of the component into `cascade-rules` and pinned here: the component's
 * geometry needs a layout engine and jsdom has none, so anything left inside it as an expression was
 * untestable by construction, and "untestable" is how each of these quietly came undone.
 *
 * Read the rule ids as the contract. If one of these fails, the fix is NOT to update the assertion —
 * it is to check the recipe, because someone has just re-broken a reported bug.
 */

describe("must-draw-one-chain-line", () => {
  it("is 2px — the width of topic-detail's `border-l-2` selected-row bar", () => {
    // The three drawings of the chain (the row's left bar, the submenu rail, the connectors) must be
    // indistinguishable. `border-l-2` is the one that has always shipped, so it is the reference —
    // NOT the connector's stroke. Changing this to match the stroke is what broke it last time.
    expect(CHAIN_STROKE_PX).toBe(2)
  })

  it("is a whole number of pixels, so the stroke cannot anti-alias dimmer than the borders", () => {
    // A fractional width spreads the gold across an extra device pixel at partial alpha: same token,
    // visibly different colour. This is the assertion that forbids "just nudge it to 1.5".
    expect(Number.isInteger(CHAIN_STROKE_PX)).toBe(true)
  })
})

describe("must-bounce-the-entrance", () => {
  it("overshoots +10, -10, +5, -5 percentage points, then rests", () => {
    expect(BOUNCE_SCALES).toEqual([0, 1.1, 0.9, 1.05, 0.95, 1])
  })

  it("damps: each swing overshoots strictly less than the one before", () => {
    // The property that makes it read as settling rather than oscillating. Amplitudes are measured
    // from rest (1), skipping the initial rise from 0.
    const swings = BOUNCE_SCALES.slice(1, -1).map((s) => Math.abs(s - 1))
    for (let i = 1; i < swings.length; i++) expect(swings[i]!).toBeLessThanOrEqual(swings[i - 1]!)
  })

  it("starts collapsed onto the chosen row and lands exactly at rest", () => {
    expect(BOUNCE_SCALES[0]).toBe(0)
    expect(BOUNCE_SCALES[BOUNCE_SCALES.length - 1]).toBe(1)
  })

  it("runs its offsets strictly forward from 0 to 1", () => {
    expect(BOUNCE_OFFSETS[0]).toBe(0)
    expect(BOUNCE_OFFSETS[BOUNCE_OFFSETS.length - 1]).toBe(1)
    for (let i = 1; i < BOUNCE_OFFSETS.length; i++)
      expect(BOUNCE_OFFSETS[i]!).toBeGreaterThan(BOUNCE_OFFSETS[i - 1]!)
  })

  it("gives every segment enough time to render at least two frames at 60Hz", () => {
    // This is why ENTER_MS is 460 and not 300. Five segments in 300ms leaves the last two at ~25ms —
    // under two frames, so the final swings CANNOT be drawn and the spec would be decorative.
    const frameMs = 1000 / 60
    for (let i = 1; i < BOUNCE_OFFSETS.length; i++) {
      const segmentMs = (BOUNCE_OFFSETS[i]! - BOUNCE_OFFSETS[i - 1]!) * ENTER_MS
      expect(segmentMs).toBeGreaterThan(frameMs * 2)
    }
  })

  it("emits one keyframe per step, easing the rise differently from the swings", () => {
    const kf = enterKeyframes()
    expect(kf).toHaveLength(BOUNCE_SCALES.length)
    expect(kf.map((k) => k.transform)).toEqual(BOUNCE_SCALES.map((s) => `scale(${s})`))
    // A keyframe's easing governs the segment STARTING at it, so index 0 carries the rise.
    expect(kf[0]!.easing).not.toBe(kf[1]!.easing)
  })
})

describe("must-not-wiggle-the-exit", () => {
  it("has no negative control point — a wiggle is an undershoot at the start", () => {
    // The old exit was the entrance's exact mirror, cubic-bezier(0.75, -0.28, 0.55, 1). Mirroring an
    // overshoot produces that -0.28, which IS the wiggle: the box swelled before it shrank.
    const nums = EXIT_EASE.match(/-?[\d.]+/g)!.map(Number)
    expect(nums).toHaveLength(4)
    for (const n of nums) expect(n).toBeGreaterThanOrEqual(0)
  })

  it("stays within [0,1] on both control points' y, so it cannot overshoot either end", () => {
    const [, y1, , y2] = EXIT_EASE.match(/-?[\d.]+/g)!.map(Number) as [number, number, number, number]
    for (const y of [y1, y2]) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })

  it("shrinks from rest to nothing, with no intermediate step to bounce through", () => {
    const kf = exitKeyframes()
    expect(kf).toHaveLength(2)
    expect(kf[0]!.transform).toBe("scale(1)")
    expect(kf[1]!.transform).toBe("scale(0)")
    expect(kf[0]!.easing).toBe(EXIT_EASE)
  })

  it("keeps the entrance's bounce — the wiggle is removed from the exit ONLY", () => {
    // The other half of the ask: don't let "no wiggle" leak into the grow.
    expect(BOUNCE_SCALES.some((s) => s > 1)).toBe(true)
    expect(EXIT_MS).toBeGreaterThan(0)
  })
})

/** A frozen base for the machine tests: three columns, the first two covered, none off-screen. */
const baseFixture = (over: Partial<EngagedBase> = {}): EngagedBase => ({
  lefts: [0, 32, 64],
  covered: [true, true, false],
  hidden: 0,
  groundRight: 240,
  ...over,
})

describe("the cascade's mode is a STORED machine — a click cannot settle or move it", () => {
  it("engaging from settled captures the resting base ONCE, rooted at the clicked list", () => {
    expect(engageOnRailClick(SETTLED, baseFixture(), 1)).toEqual({
      kind: "engaged",
      root: 1,
      base: baseFixture(),
    })
  })

  it("T61 (must-not-move-the-menus-on-an-intermediate-select): a rail click NEVER replaces an existing base", () => {
    // The failure the stored base forbids: the select advances the frontier and the covering /
    // pressure / ground all recompute, moving the very list being clicked in the moment its child
    // appears. Engaged geometry paints from the captured VALUE, and no click can touch it.
    const first = engageOnRailClick(SETTLED, baseFixture(), 2)
    const second = engageOnRailClick(first, baseFixture({ lefts: [999], groundRight: 1 }), 1)
    expect(second.kind).toBe("engaged")
    if (second.kind === "engaged") {
      expect(second.base).toEqual(baseFixture())
      expect(second.root).toBe(1)
    }
  })

  it("must-not-expand-parents-on-select: the reveal root only ever RATCHETS shallower on a click", () => {
    // Clicking deeper keeps the shallower root (everything walked open stays open); it never
    // springs covered parents open (engageOnEnter is the only all-revealer).
    const at1 = engageOnRailClick(SETTLED, baseFixture(), 1)
    const deeper = engageOnRailClick(at1, baseFixture(), 2)
    if (deeper.kind === "engaged") expect(deeper.root).toBe(1)
    // Engaged with nothing revealed (root null — a click in an uncovered stack): the next click
    // roots at its own list, protecting it from the child's arrival.
    const engagedNull: CascadeMode = { kind: "engaged", root: null, base: baseFixture() }
    const clicked = engageOnRailClick(engagedNull, baseFixture(), 2)
    if (clicked.kind === "engaged") expect(clicked.root).toBe(2)
  })

  it("entering an open zone reveals EVERYTHING on screen — rooted at the first on-screen column", () => {
    const b = baseFixture({ hidden: 1 })
    expect(engageOnEnter(SETTLED, b)).toEqual({ kind: "engaged", root: 1, base: b })
    // Idempotent while engaged: the base is KEPT (the menus cannot move, only reveal further).
    const reEntered = engageOnEnter(engageOnRailClick(SETTLED, b, 2), baseFixture({ hidden: 0 }))
    if (reEntered.kind === "engaged") {
      expect(reEntered.root).toBe(1)
      expect(reEntered.base).toEqual(b)
    }
  })

  it("must-collapse-from-one-pointer-authority: pointer-exit, toggle and the final choice are the ONLY settles", () => {
    const reasons: SettleReason[] = ["pointer-exit", "toggle", "final-choice"]
    for (const r of reasons) expect(settleModeOn(r)).toEqual({ kind: "settled" })
    // A rail click is not a settle reason — unrepresentable, and the type rejects it:
    // @ts-expect-error — a click cannot settle the cascade
    settleModeOn("rail-click")
  })

  it("must-hold-the-ground-under-the-pointer: the ground is DATA in the frozen base", () => {
    // The root's width and the detail's position hang off `groundRight`; engaged geometry reads it
    // from the base, so nothing a gesture causes (select, clear, disclose, remount) can move it —
    // it recomputes only at the settle transitions above.
    const engaged = engageOnRailClick(SETTLED, baseFixture({ groundRight: 240 }), 0)
    if (engaged.kind === "engaged") expect(engaged.base.groundRight).toBe(240)
  })
})

describe("must-animate-every-menu-closure", () => {
  it("collapses the sub-branch when a DIFFERENT row is chosen (the workspace switch)", () => {
    // The reported bug: clicking "My Workspace" from another workspace made every menu vanish in one
    // frame. It tears the same menus down as a re-click, so it animates the same way.
    expect(planRailSelect("acme", "my-workspace")).toEqual({
      action: "select",
      guarded: true,
      collapse: true,
    })
  })

  it("collapses the sub-branch when the selected row is re-clicked (a clear)", () => {
    expect(planRailSelect("acme", "acme")).toEqual({ action: "clear", guarded: true, collapse: true })
  })

  it("does NOT collapse a forward drill into a level with nothing selected", () => {
    // Nothing is open below it, so there is nothing to collapse and nothing to guard.
    expect(planRailSelect(null, "acme")).toEqual({
      action: "select",
      guarded: false,
      collapse: false,
    })
  })
})

describe("must-own-unselection", () => {
  it("clears on the already-selected row and selects on any other", () => {
    expect(planRailSelect("a", "a").action).toBe("clear")
    expect(planRailSelect("a", "b").action).toBe("select")
    expect(planRailSelect(null, "a").action).toBe("select")
  })
})

describe("must-guard-unsaved-on-exit", () => {
  it("guards exactly the clicks that replace or clear an open detail", () => {
    // Equivalently: guard whenever the level already has a selection.
    expect(planRailSelect("a", "a").guarded).toBe(true) // clear
    expect(planRailSelect("a", "b").guarded).toBe(true) // sibling swap
    expect(planRailSelect(null, "a").guarded).toBe(false) // forward drill — nothing to lose
  })
})

describe("must-draw-every-detection-frame", () => {
  it("arms the disclose region only when something is covered to disclose", () => {
    const state = { engaged: false, immersed: false, anyCovered: true }
    expect(triggerRectArmed(state)).toBe(true)
    // The exact state that made the debug switch look broken: autoHideTopics={false} covers nothing,
    // so the region is legitimately dead — and must therefore be DRAWN dead, not omitted.
    expect(triggerRectArmed({ ...state, anyCovered: false })).toBe(false)
    expect(triggerRectArmed({ ...state, immersed: true })).toBe(false)
    // Already engaged means the cascade is disclosed — nothing left to trigger.
    expect(triggerRectArmed({ ...state, engaged: true })).toBe(false)
  })
})

describe("menu region — the ONE authority for pointer-in-menus", () => {
  const rect = (left: number, top: number, right: number, bottom: number): MenuRect => ({
    left,
    top,
    right,
    bottom,
  })

  it("hugs the menus' content — it does NOT run the container's full height", () => {
    // The bug the debug frame exposed: the region ran the container's full height (the root column is
    // full height) and swallowed the detail below the menus. The caller clamps the root to its rows'
    // bottom (here 235), and `menuRegion` takes only the container's TOP-LEFT (the approach lane) —
    // never its bottom or right. So the region ends where the menus end, not at the page footer.
    const container = rect(0, 0, 900, 2000) // the full-height shell
    const cols = [rect(0, 0, 200, 235), rect(200, 40, 420, 300)] // root clamped to rows + a submenu
    const region = menuRegion(cols, container)
    expect(region).toEqual({ left: 0, top: 0, right: 420, bottom: 300 })
  })

  it("counts a point BELOW the menus as OUT, so moving to the detail collapses them", () => {
    const region = menuRegion([rect(0, 0, 200, 235), rect(200, 40, 420, 300)], rect(0, 0, 900, 2000))!
    expect(pointInRegion(region, 100, 200)).toBe(true) // on a root row — in the menus
    expect(pointInRegion(region, 300, 250)).toBe(true) // within the submenu's height band — in
    expect(pointInRegion(region, 300, 500)).toBe(false) // below the menus — the detail form area, OUT
    expect(pointInRegion(region, 600, 100)).toBe(false) // right of the menus — the detail, OUT
  })

  it("is null when there are no columns to measure", () => {
    expect(menuRegion([], rect(0, 0, 900, 600))).toBeNull()
  })
})

describe("must-hold-the-detail-until-the-final-choice — DECLARED leafness (v1.16.0)", () => {
  it("resolves a row's leafness: item over level over the fail-safe `detail` default", () => {
    expect(itemLeadsTo(undefined, undefined)).toBe("detail")
    expect(itemLeadsTo("list", undefined)).toBe("list")
    expect(itemLeadsTo("list", "detail")).toBe("detail")
    expect(itemLeadsTo("detail", "list")).toBe("list")
  })

  it("T57: an intermediate select (a row declared to lead to a list) CAPTURES the pane", () => {
    // The pane keeps showing exactly what it showed before the click — never the new topic's
    // overview, a landing, or a blank — until the gesture ends.
    expect(planRailHold({ action: "select", leadsTo: "list" })).toEqual({
      capture: true,
      release: false,
      finalChoice: false,
    })
  })

  it("a CLEAR releases the hold immediately — up-navigation is not a choosing gesture", () => {
    // The release edge v1.15.x was missing: its hold armed on clears but could only release on a
    // COMPLETE path, which an unselect makes false forever — so it never released, and the stale
    // pane haunted /home and every partial path the navigation landed on.
    for (const leadsTo of ["list", "detail"] as const)
      expect(planRailHold({ action: "clear", leadsTo })).toEqual({
        capture: false,
        release: true,
        finalChoice: false,
      })
  })

  it("a FINAL CHOICE (a leaf row) arms the ONE swap — no capture, no release yet", () => {
    expect(planRailHold({ action: "select", leadsTo: "detail" })).toEqual({
      capture: false,
      release: false,
      finalChoice: true,
    })
  })

  it("T58: the swap lands when the navigation APPLIES — never on the click's own pre-navigation renders", () => {
    // The click declared itself final, so nothing is inferred and nothing is confirmed across
    // consecutive renders; the only question is when the host's navigation has landed.
    expect(planLeafSettle({ sigChanged: false, pathComplete: true, autoHide: true }).settle).toBe(
      false,
    )
    // A merged stack may still be un-registering the old branch's deeper lists for a commit.
    expect(planLeafSettle({ sigChanged: true, pathComplete: false, autoHide: true }).settle).toBe(
      false,
    )
    expect(planLeafSettle({ sigChanged: true, pathComplete: true, autoHide: true }).settle).toBe(
      true,
    )
  })
})

describe("must-auto-collapse-menus-on-final-choice", () => {
  it("T59: in auto-collapse mode the final choice's landing closes the menus on the click itself", () => {
    // Without waiting for the pointer to leave: settling IS the requested action.
    expect(planLeafSettle({ sigChanged: true, pathComplete: true, autoHide: true })).toEqual({
      settle: true,
      autoCollapse: true,
    })
  })

  it("T60: with auto-collapse OFF only the detail swaps — no select collapses anything", () => {
    // The workspace stacks' standing rule (`autoHideTopics={false}`): the menus stay exactly as the
    // user arranged them.
    expect(planLeafSettle({ sigChanged: true, pathComplete: true, autoHide: false })).toEqual({
      settle: true,
      autoCollapse: false,
    })
  })

  it("an intermediate select collapses nothing, in either mode — it never even arms a settle", () => {
    expect(planRailHold({ action: "select", leadsTo: "list" }).finalChoice).toBe(false)
    for (const autoHide of [true, false])
      expect(planLeafSettle({ sigChanged: true, pathComplete: false, autoHide }).autoCollapse).toBe(
        false,
      )
  })

  it("nothing may re-open until the pointer next ENTERS — presence in an open zone is not entry", () => {
    // After the final choice collapses the menus the pointer is parked inside the freshly armed
    // zones (the trigger lane, a covered peek); a stray pixel of movement there must not
    // re-disclose what the click just closed. The outside→inside crossing is what opens — and in
    // v1.16.0 the covered peeks route through this same gate (the browser's own `pointerenter`
    // fires when layout moves under a stationary pointer, which a final-choice collapse does).
    expect(triggerFires({ armed: true, wasInside: true, isInside: true })).toBe(false)
    expect(triggerFires({ armed: true, wasInside: false, isInside: true })).toBe(true)
    expect(triggerFires({ armed: true, wasInside: false, isInside: false })).toBe(false)
    expect(triggerFires({ armed: false, wasInside: false, isInside: true })).toBe(false)
  })
})
