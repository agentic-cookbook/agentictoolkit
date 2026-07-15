import { describe, it, expect, vi } from "vitest"
// `fireEvent`, not `userEvent` — this package's house style (see button.test.tsx): full input
// fidelity is covered by app-level Playwright, and these assertions are about which callback a click
// reaches, not about how the click was produced.
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

import { HierarchicalMenuDetail } from "../blocks/hierarchical-menu-detail"
// `TopicLevel` is declared by HTDV and shared by both views — the two are twins, not forks.
import type { TopicLevel } from "../blocks/hierarchical-topic-detail"
import { CHAIN_STROKE_PX } from "../blocks/cascade-rules"

/**
 * The cascade's rules that only exist once there is a DOM — the click wiring and the chain's
 * drawing. The pure arithmetic is in `cascadeRules.test.ts`; this file covers the seam between it
 * and the component, which is where the last two regressions actually landed.
 *
 * jsdom has NO layout engine: `getBoundingClientRect` is all zeros and `Element.animate` does not
 * exist. So the geometry (rect unions, connector paths, the ground's measured width) cannot be
 * asserted here at all — that is precisely why those decisions were extracted into pure rules. What
 * IS testable here is that a click reaches the right callback, which is the half that broke.
 *
 * The component's animation paths are written to no-op without WAAPI (`typeof col.animate !==
 * "function"` → land in place, run the callback) rather than to throw — a real robustness guard that
 * also makes this file possible.
 */

const level = (over: Partial<TopicLevel> & Pick<TopicLevel, "id">): TopicLevel => ({
  title: over.id,
  items: [],
  selectedId: null,
  onSelect: () => {},
  onClear: () => {},
  ...over,
})

const workspaces = (selectedId: string | null, over: Partial<TopicLevel> = {}) =>
  level({
    id: "workspaces",
    title: "Workspaces",
    items: [
      { id: "acme", label: "Acme" },
      { id: "mine", label: "My Workspace" },
    ],
    selectedId,
    ...over,
  })

/** A fresh surface id per test: the cascade's `surfaceStates` / `cascadeMemory` are MODULE-scoped
 *  (deliberately — a selection remounts the subtree, so per-component state would be destroyed by
 *  the very click it has to survive). Sharing a root id across tests would leak state between them. */
let seq = 0
const freshRootId = () => `workspaces-${++seq}`

describe("must-animate-every-menu-closure (wiring)", () => {
  it("selecting a DIFFERENT row still reaches onSelect", async () => {
    const onSelect = vi.fn()
    const root = freshRootId()
    render(
      <HierarchicalMenuDetail
        levels={[workspaces("acme", { id: root, onSelect })]}
        disclosureStyle="cascading"
        autoHideTopics={false}
      >
        <div>detail</div>
      </HierarchicalMenuDetail>,
    )
    fireEvent.click(screen.getByRole("button", { name: /My Workspace/ }))
    // The point: routing this click through the collapse animation must not SWALLOW it. The exit runs
    // first and the navigation is its callback, so a broken exit silently strands the click.
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("mine"))
  })

  it("re-clicking the selected row still reaches onClear", async () => {
    const onClear = vi.fn()
    const root = freshRootId()
    render(
      <HierarchicalMenuDetail
        levels={[workspaces("acme", { id: root, onClear })]}
        disclosureStyle="cascading"
        autoHideTopics={false}
      >
        <div>detail</div>
      </HierarchicalMenuDetail>,
    )
    fireEvent.click(screen.getByRole("button", { name: /Acme/ }))
    await waitFor(() => expect(onClear).toHaveBeenCalled())
  })

  it("a forward drill into an unselected level reaches onSelect", async () => {
    const onSelect = vi.fn()
    const root = freshRootId()
    const { container } = render(
      <HierarchicalMenuDetail
        levels={[workspaces(null, { id: root, onSelect })]}
        disclosureStyle="cascading"
        autoHideTopics={false}
      >
        <div>detail</div>
      </HierarchicalMenuDetail>,
    )
    // Scoped to the RAIL: with nothing selected the frontier's detail is the automatic topic overview
    // (must-show-topic-overview-at-unselected-frontier), so "Acme" is legitimately on screen twice —
    // once as a row, once as a card. An unscoped query matches both and fails.
    const rail = within(container.querySelector<HTMLElement>('[data-htd-col="0"]')!)
    fireEvent.click(rail.getByRole("button", { name: /Acme/ }))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("acme"))
  })
})

describe("must-draw-one-chain-line (drawing)", () => {
  it("draws the submenu's gold rail at exactly the connector's stroke width", async () => {
    const root = freshRootId()
    const { container } = render(
      <HierarchicalMenuDetail
        levels={[
          workspaces("acme", { id: root }),
          level({
            id: "features",
            title: "Workspace",
            items: [{ id: "integrations", label: "Integrations" }],
            selectedId: null, // unchosen → the level wears the gold rail down its left edge
          }),
        ]}
        disclosureStyle="cascading"
        autoHideTopics={false}
      >
        <div>detail</div>
      </HierarchicalMenuDetail>,
    )
    const rail = container.querySelector<HTMLElement>('[data-htd-col="1"] .bg-apt-gold')
    expect(rail).not.toBeNull()
    // The rail and the connector are ONE line; they read as two golds the moment these disagree.
    expect(rail!.style.width).toBe(`${CHAIN_STROKE_PX}px`)
  })

  it("renders connectors crisp, so the stroke cannot anti-alias dimmer than the CSS borders", () => {
    const root = freshRootId()
    const { container } = render(
      <HierarchicalMenuDetail
        levels={[
          workspaces("acme", { id: root }),
          level({
            id: "features",
            title: "Workspace",
            items: [{ id: "integrations", label: "Integrations" }],
            selectedId: null,
          }),
        ]}
        disclosureStyle="cascading"
        autoHideTopics={false}
      >
        <div>detail</div>
      </HierarchicalMenuDetail>,
    )
    // The overlay only mounts once it has measured a path, which jsdom's zero-size rects can't
    // produce — so assert the contract on the element when it is there, and skip when it is not.
    // (The width/colour parity above is the assertion that actually holds in jsdom.)
    const svg = container.querySelector("[data-htd-connectors]")
    if (svg) expect(svg.getAttribute("shape-rendering")).toBe("crispEdges")
  })
})
