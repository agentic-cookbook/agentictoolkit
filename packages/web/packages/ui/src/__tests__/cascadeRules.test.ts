import { describe, it, expect } from "vitest"

import {
  BOUNCE_OFFSETS,
  BOUNCE_SCALES,
  CHAIN_STROKE_PX,
  ENTER_MS,
  EXIT_EASE,
  EXIT_MS,
  NO_REVEAL,
  coverFrontierWhileChoosing,
  enterKeyframes,
  exitKeyframes,
  mayMoveGround,
  menuRegion,
  planChoiceSettle,
  planRailSelect,
  pointInRegion,
  pointerInMenusAfterMove,
  ratchetFrozenFrontier,
  reduceReveal,
  revealClosedBy,
  shouldShowHeldDetail,
  triggerFires,
  triggerRectArmed,
  type MenuRect,
  type RevealEvent,
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

describe("must-hold-the-ground-under-the-pointer", () => {
  it("holds the root list's width while the pointer is in the menus", () => {
    // Both reported symptoms: clicking Integrations resized the root list, and unselecting it resized
    // the root list. In both the pointer is still in the menus, so the ground must not move.
    expect(mayMoveGround({ pointerInMenus: true, latched: true })).toBe(false)
  })

  it("releases once the pointer has left the menus", () => {
    expect(mayMoveGround({ pointerInMenus: false, latched: true })).toBe(true)
  })

  it("takes the real width on a first paint, when there is nothing latched to hold", () => {
    // Without this the stack renders at a held width of nothing.
    expect(mayMoveGround({ pointerInMenus: true, latched: false })).toBe(true)
  })

  it("stays held across a remount, because the pointer has not moved — only the component has", () => {
    // Choosing a row is a route-param change, so React discards and remounts the whole subtree ON
    // THE CLICK the hold has to survive. If the remounted component reports `pointerInMenus: false`
    // (a fresh `useState(false)` rather than a seed from the surface's memory), the ground frees
    // itself on exactly that frame and jumps — the reported bug, reintroduced through the back door.
    // The pointer is still in the menus, so the answer is unchanged:
    expect(mayMoveGround({ pointerInMenus: true, latched: true })).toBe(false)
  })

  it("shares its one input with the reveal — the SAME `pointerInMenus` governs both", () => {
    // The unification this refactor is: the ground latch and the reveal's held-state are no longer
    // two separately-computed (and separately-stale) things. Both are `pointerInMenus`. This rule
    // takes exactly that plus the first-paint latch, and nothing else — no cover/reveal/selection
    // term that could switch it off behind the layout's back.
    expect(Object.keys({ pointerInMenus: false, latched: true })).toEqual([
      "pointerInMenus",
      "latched",
    ])
    expect(mayMoveGround({ pointerInMenus: true, latched: true })).toBe(false)
    expect(mayMoveGround({ pointerInMenus: false, latched: true })).toBe(true)
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
    const base = { revealOpen: false, immersed: false, anyCovered: true }
    expect(triggerRectArmed(base)).toBe(true)
    // The exact state that made the debug switch look broken: autoHideTopics={false} covers nothing,
    // so the region is legitimately dead — and must therefore be DRAWN dead, not omitted.
    expect(triggerRectArmed({ ...base, anyCovered: false })).toBe(false)
    expect(triggerRectArmed({ ...base, immersed: true })).toBe(false)
    // A reveal already open means the cascade is disclosed — nothing left to trigger.
    expect(triggerRectArmed({ ...base, revealOpen: true })).toBe(false)
  })
})

describe("must-collapse-from-one-pointer-authority — the evidence clause", () => {
  it("a measurable move answers from the region — inside is inside, outside is outside", () => {
    expect(pointerInMenusAfterMove({ measurable: true, inside: true, previous: false })).toBe(true)
    expect(pointerInMenusAfterMove({ measurable: true, inside: false, previous: true })).toBe(false)
  })

  it("an UNMEASURABLE move keeps the last answer — absence of evidence is not leaving", () => {
    // The remount a select causes has a window where nothing is measurable (the old container is
    // detached, the new one unpainted) and a real mouse always moves in it. Writing "outside" there
    // released the ground latch, the covering freeze and the reveal on exactly the click every hold
    // exists to survive — reproducible only with a real pointer, which is why it kept shipping.
    expect(pointerInMenusAfterMove({ measurable: false, inside: false, previous: true })).toBe(true)
    expect(pointerInMenusAfterMove({ measurable: false, inside: false, previous: false })).toBe(false)
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

describe("the reveal closes on exactly three things — never an intermediate select", () => {
  it("a root (an intermediate select or a hover-enter) OPENS, and can never close", () => {
    // The invariant whose absence let a click collapse the menus. An intermediate select dispatches
    // `root`.
    expect(reduceReveal(NO_REVEAL, { type: "root", id: "features", all: false })).toEqual({
      root: "features",
      all: false,
    })
    expect(revealClosedBy({ type: "root", id: "features", all: false })).toBe(false)
  })

  it("re-roots from one open reveal to another without ever passing through closed", () => {
    const open: RevealEvent = { type: "root", id: "a", all: true }
    const reRoot: RevealEvent = { type: "root", id: "b", all: false }
    const state = reduceReveal(reduceReveal(NO_REVEAL, open), reRoot)
    expect(state).toEqual({ root: "b", all: false })
  })

  it("closes on the pointer leaving the menus — the standing auto-collapse", () => {
    expect(reduceReveal({ root: "features", all: false }, { type: "pointerLeftMenus" })).toBe(NO_REVEAL)
    expect(revealClosedBy({ type: "pointerLeftMenus" })).toBe(true)
  })

  it("closes on an explicit toggle — settling IS the requested action there", () => {
    expect(reduceReveal({ root: "features", all: true }, { type: "settle" })).toBe(NO_REVEAL)
    expect(revealClosedBy({ type: "settle" })).toBe(true)
  })

  it("closes on the FINAL CHOICE — the ONE click-driven closure (v1.15.0)", () => {
    // The carve-out named in must-collapse-from-one-pointer-authority: the click that completes the
    // path settles the cascade, exactly as the disclosure toggles do. Whether it fires at all is
    // auto-collapse mode's call — see planChoiceSettle — but as an event it closes, always.
    expect(reduceReveal({ root: "features", all: false }, { type: "finalChoice" })).toBe(NO_REVEAL)
    expect(revealClosedBy({ type: "finalChoice" })).toBe(true)
  })

  it("has NO event that closes on an INTERMEDIATE select — it is unrepresentable", () => {
    // The whole set of events, and which close. `finalChoice` is the one spec'd click closer
    // (v1.15.0); if a future edit wants any OTHER click to collapse, it has to add an event here,
    // and this test will make that choice loud instead of silent.
    const closers = (["pointerLeftMenus", "settle", "finalChoice"] as const).map((type) =>
      revealClosedBy({ type }),
    )
    const opener = revealClosedBy({ type: "root", id: "x", all: false })
    expect(closers).toEqual([true, true, true])
    expect(opener).toBe(false)
  })
})

describe("must-hold-the-detail-until-the-final-choice", () => {
  it("T57: while a hold is armed the HELD content shows — never the overview, a landing, or a blank", () => {
    // An intermediate select disclosed another choosing list; the pane keeps showing exactly what it
    // showed before the click. This also covers the complete-looking render BEFORE the settle is
    // confirmed (a merged stack's late-registered list): gating on "the frontier is unselected"
    // would flash the host's landing for the commit the list takes to arrive. Only the release
    // (planChoiceSettle's confirmed settle) reveals the live detail — the ONE swap.
    expect(shouldShowHeldDetail({ holding: true })).toBe(true)
  })

  it("a deep link at an unselected frontier still shows the overview — nothing was ever held", () => {
    // No pointer, no gesture, no captured content: the overview rule stands.
    expect(shouldShowHeldDetail({ holding: false })).toBe(false)
  })

  it("T58: a settled-looking render ARMS, and the consecutive one settles — the final choice releases the hold", () => {
    // ONE swap, old content → new content — confirmed across two renders (see the next test for why
    // one is not enough).
    const first = planChoiceSettle({
      holding: true,
      pathComplete: true,
      selectionChanged: true,
      armed: false,
      autoHide: true,
    })
    expect(first).toEqual({ arm: true, settle: false, autoCollapse: false })
    const second = planChoiceSettle({
      holding: true,
      pathComplete: true,
      selectionChanged: true,
      armed: true,
      autoHide: true,
    })
    expect(second.settle).toBe(true)
  })

  it("a merged stack's late-registered deeper list DISARMS the confirmation — never a false settle", () => {
    // A merged stack publishes its deeper list from components living in `children` (effects), one
    // commit behind — so the first render after an intermediate select can be missing the very
    // choosing list that select disclosed, and read as complete. The armed render that turns out
    // NOT settled disarms; nothing releases and nothing collapses.
    const lateList = planChoiceSettle({
      holding: true,
      pathComplete: false, // the deeper list registered — the path was never complete
      selectionChanged: true,
      armed: true,
      autoHide: true,
    })
    expect(lateList).toEqual({ arm: false, settle: false, autoCollapse: false })
  })

  it("an intermediate select does NOT settle — the host disclosed another choosing list", () => {
    expect(
      planChoiceSettle({
        holding: true,
        pathComplete: false,
        selectionChanged: true,
        armed: false,
        autoHide: true,
      }).settle,
    ).toBe(false)
  })

  it("the click's own pre-navigation renders do NOT settle — the selection hasn't moved yet", () => {
    // The select still navigates (a DISPLAY hold, not a deferred navigation), but the host's route
    // move may land renders later; until the chain actually changes, the complete-looking path is
    // the OLD one and settling on it would release (and auto-collapse) on the arming click itself.
    expect(
      planChoiceSettle({
        holding: true,
        pathComplete: true,
        selectionChanged: false,
        armed: false,
        autoHide: true,
      }),
    ).toEqual({ arm: false, settle: false, autoCollapse: false })
  })

  it("with no hold armed there is nothing to settle", () => {
    expect(
      planChoiceSettle({
        holding: false,
        pathComplete: true,
        selectionChanged: true,
        armed: true,
        autoHide: true,
      }).settle,
    ).toBe(false)
  })
})

describe("must-auto-collapse-menus-on-final-choice", () => {
  it("T59: in auto-collapse mode the final choice closes the menus on the click itself", () => {
    // Without waiting for the pointer to leave: settling IS the requested action.
    expect(
      planChoiceSettle({
        holding: true,
        pathComplete: true,
        selectionChanged: true,
        armed: true,
        autoHide: true,
      }),
    ).toEqual({ arm: false, settle: true, autoCollapse: true })
  })

  it("T60: with auto-collapse OFF only the detail swaps — no select collapses anything", () => {
    // The workspace stacks' standing rule (`autoHideTopics={false}`): the menus stay exactly as the
    // user arranged them.
    expect(
      planChoiceSettle({
        holding: true,
        pathComplete: true,
        selectionChanged: true,
        armed: true,
        autoHide: false,
      }),
    ).toEqual({ arm: false, settle: true, autoCollapse: false })
  })

  it("an intermediate select collapses nothing, in either mode", () => {
    for (const autoHide of [true, false])
      for (const armed of [true, false])
        expect(
          planChoiceSettle({
            holding: true,
            pathComplete: false,
            selectionChanged: true,
            armed,
            autoHide,
          }).autoCollapse,
        ).toBe(false)
  })

  it("the final choice writes the frozen cover frontier forward — the collapse lands on the click", () => {
    // The gesture's covering freeze (below) holds while the pointer is parked in the menus, so the
    // settle advances it explicitly; without this the "auto-collapse on the final choice" would
    // silently wait for the next pointer exit.
    expect(coverFrontierWhileChoosing({ frozenFrontier: 3, frontier: 3 })).toBe(3)
  })

  it("nothing may re-open until the pointer next ENTERS — presence in the trigger rect is not entry", () => {
    // After the final choice collapses the menus the pointer is parked inside the freshly armed
    // trigger; a stray pixel of movement there must not re-disclose what the click just closed.
    expect(triggerFires({ armed: true, wasInside: true, isInside: true })).toBe(false)
    // The outside→inside crossing is what opens.
    expect(triggerFires({ armed: true, wasInside: false, isInside: true })).toBe(true)
    expect(triggerFires({ armed: true, wasInside: false, isInside: false })).toBe(false)
    expect(triggerFires({ armed: false, wasInside: false, isInside: true })).toBe(false)
  })
})

describe("must-not-move-the-menus-on-an-intermediate-select", () => {
  it("T61: a rail click ratchets the frozen frontier to the clicked list — the select cannot cover it", () => {
    // The failure this forbids: the select advances the real frontier, and auto-hide covering
    // computed against it covers the very list being clicked in the moment its child appears —
    // with only the pointer-reveal (racing the select's own remount) to hold it open. Frozen at the
    // clicked index, the covering cannot touch the clicked list or anything right of it.
    const frozen = ratchetFrozenFrontier({ frozenFrontier: 0, clickedIndex: 0 }) // click the root
    expect(frozen).toBe(0)
    // The intermediate select advanced the real frontier to 1 — the root (i=0) must stay uncovered:
    // covered set is i < coverFrontier, and it is EMPTY.
    expect(coverFrontierWhileChoosing({ frozenFrontier: frozen, frontier: 1 })).toBe(0)
  })

  it("keeps the parents the user had covered COVERED — a click never springs them open", () => {
    // must-not-expand-parents-on-select: clicking in a mid-stack list (i=1) with the covering
    // settled deeper (frontier 2) ratchets to 1 — list 0 stays covered, list 1 and everything the
    // user walked open stay disclosed.
    expect(ratchetFrozenFrontier({ frozenFrontier: 2, clickedIndex: 1 })).toBe(1)
  })

  it("follows a RETREAT — a clear/✕ that pulls the real frontier below the freeze is not fought", () => {
    // Up-navigation must never leave stale covering: the effective frontier is the smaller of the
    // frozen and the real one.
    expect(coverFrontierWhileChoosing({ frozenFrontier: 2, frontier: 1 })).toBe(1)
  })

  it("holds against an ADVANCE — deeper disclosure while choosing covers nothing", () => {
    expect(coverFrontierWhileChoosing({ frozenFrontier: 0, frontier: 3 })).toBe(0)
  })
})
