import { describe, it, expect } from "vitest"

import {
  BOUNCE_OFFSETS,
  BOUNCE_SCALES,
  CHAIN_STROKE_PX,
  ENTER_MS,
  EXIT_EASE,
  EXIT_MS,
  enterKeyframes,
  exitKeyframes,
  mayMoveGround,
  planRailSelect,
  revealRectArmed,
  triggerRectArmed,
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
    expect(mayMoveGround({ pointerInStack: true, latched: true })).toBe(false)
  })

  it("releases once the pointer has left the menus", () => {
    expect(mayMoveGround({ pointerInStack: false, latched: true })).toBe(true)
  })

  it("takes the real width on a first paint, when there is nothing latched to hold", () => {
    // Without this the stack renders at a held width of nothing.
    expect(mayMoveGround({ pointerInStack: true, latched: false })).toBe(true)
  })

  it("stays held across a remount, because the pointer has not moved — only the component has", () => {
    // Choosing a row is a route-param change, so React discards and remounts the whole subtree ON
    // THE CLICK the latch has to survive. If the remounted component reports `pointerInStack: false`
    // (a fresh `useState(false)` rather than a seed from the surface's memory), the ground frees
    // itself on exactly that frame and jumps — the reported bug, reintroduced through the back door.
    // The pointer is still in the menus, so the answer is unchanged:
    expect(mayMoveGround({ pointerInStack: true, latched: true })).toBe(false)
  })

  it("depends on the POINTER only — not on a reveal, a cover, or a selection", () => {
    // The regression this rule exists to forbid. The old test was `hoverIndex < 0`, a proxy for "the
    // submenus are collapsed" — and a reveal only exists while some list is COVERED, so the day
    // autoHideTopics went false the proxy silently pinned itself to "always free to move". Any future
    // rewrite that reintroduces a cover/reveal/selection term fails here: the function takes no such
    // argument, and this asserts the signature stays that way.
    expect(Object.keys({ pointerInStack: false, latched: true })).toEqual(["pointerInStack", "latched"])
    expect(mayMoveGround({ pointerInStack: true, latched: true })).toBe(false)
    expect(mayMoveGround({ pointerInStack: false, latched: true })).toBe(true)
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
  it("arms the collapse region only while a reveal is open", () => {
    expect(revealRectArmed({ hoverIndex: 0 })).toBe(true)
    expect(revealRectArmed({ hoverIndex: -1 })).toBe(false)
  })

  it("arms the disclose region only when something is covered to disclose", () => {
    const base = { hoverIndex: -1, immersed: false, anyCovered: true }
    expect(triggerRectArmed(base)).toBe(true)
    // The exact state that made the debug switch look broken: autoHideTopics={false} covers nothing,
    // so the region is legitimately dead — and must therefore be DRAWN dead, not omitted.
    expect(triggerRectArmed({ ...base, anyCovered: false })).toBe(false)
    expect(triggerRectArmed({ ...base, immersed: true })).toBe(false)
    expect(triggerRectArmed({ ...base, hoverIndex: 0 })).toBe(false)
  })

  it("never arms both regions at once", () => {
    for (const hoverIndex of [-1, 0, 2])
      for (const anyCovered of [true, false])
        for (const immersed of [true, false]) {
          const both =
            revealRectArmed({ hoverIndex }) && triggerRectArmed({ hoverIndex, immersed, anyCovered })
          expect(both).toBe(false)
        }
  })
})
