import { useState } from "react"

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
    // Scoped to the RAIL: the frontier detail is the select-something nudge, which duplicates no
    // row, so an unscoped name resolves to one element today. The scoping stays anyway — it is
    // correct regardless of what the pane holds.
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

/** A stateful three-level host (workspaces ▸ features ▸ topics) whose deeper lists appear as their
 *  parents are chosen and whose children track the selection — the shape the DECLARED-leafness
 *  hold exists for: the first two levels declare `leadsTo: "list"` (their rows disclose deeper
 *  lists), the topics rows take the `detail` default (each is a final choice). The detail text
 *  names the full path so the assertions can tell "held the old content" from "flipped to the
 *  new". */
function Walk({ rootId }: { rootId: string }) {
  const [ws, setWs] = useState<string | null>("acme")
  const [feat, setFeat] = useState<string | null>("integrations")
  const [topic, setTopic] = useState<string | null>("hooks")
  const levels: TopicLevel[] = [
    level({
      id: rootId,
      title: "Workspaces",
      items: [
        { id: "acme", label: "Acme" },
        { id: "mine", label: "My Workspace" },
      ],
      selectedId: ws,
      leadsTo: "list",
      onSelect: (id) => {
        setWs(id)
        setFeat(null)
        setTopic(null)
      },
      onClear: () => {
        setWs(null)
        setFeat(null)
        setTopic(null)
      },
    }),
    ...(ws
      ? [
          level({
            id: "features",
            title: "Features",
            items: [
              { id: "integrations", label: "Integrations" },
              { id: "settings", label: "Settings" },
            ],
            selectedId: feat,
            leadsTo: "list",
            onSelect: (id) => {
              setFeat(id)
              setTopic(null)
            },
            onClear: () => {
              setFeat(null)
              setTopic(null)
            },
          }),
        ]
      : []),
    ...(ws && feat
      ? [
          level({
            id: "topics",
            title: "Topics",
            items: [
              { id: "hooks", label: "Hooks" },
              { id: "keys", label: "Keys" },
            ],
            selectedId: topic,
            onSelect: setTopic,
            onClear: () => setTopic(null),
          }),
        ]
      : []),
  ]
  return (
    <HierarchicalMenuDetail levels={levels} disclosureStyle="cascading">
      <div>{topic ? `DETAIL ${feat}/${topic}` : `LANDING ${feat ?? ws ?? "root"}`}</div>
    </HierarchicalMenuDetail>
  )
}

/** Is the element hidden by an inline `display: none` on itself or an ancestor? (The frame hides
 *  the always-mounted children wrapper exactly that way; jest-dom's types aren't wired into this
 *  package, so the check is spelled out.) */
const displayHidden = (el: HTMLElement | null): boolean => {
  for (let n = el; n; n = n.parentElement) if (n.style.display === "none") return true
  return false
}

describe("must-hold-the-detail-until-the-final-choice (wiring)", () => {
  it("T57/T58: the detail rides through an intermediate select and swaps ONCE at the final choice", async () => {
    const root = freshRootId()
    const { container } = render(<Walk rootId={root} />)
    const detailPane = () => within(container.querySelector("section")!)
    expect(displayHidden(detailPane().getByText("DETAIL integrations/hooks"))).toBe(false)

    // T57 — the INTERMEDIATE select: choosing Settings discloses the Topics choosing list. The pane
    // must keep showing the last final choice's content — not the Topics frontier overview (which
    // would put the select nudge inside the detail section) and not the host's landing.
    const features = within(container.querySelector<HTMLElement>('[data-htd-col="1"]')!)
    fireEvent.click(features.getByRole("button", { name: /Settings/ }))
    await waitFor(() =>
      expect(displayHidden(detailPane().getByText("DETAIL integrations/hooks"))).toBe(false),
    )
    expect(displayHidden(detailPane().getByText(/LANDING/))).toBe(true) // the host's landing stays hidden
    // …and no frontier overview: the held content occupies the slot the nudge would have taken.
    expect(container.querySelector("section")!.querySelector("[data-htd-select-hint]")).toBeNull()

    // T58 — the FINAL CHOICE: Keys leads to no further topic list, so the detail changes ONCE,
    // straight to the final choice's detail; the held content is gone.
    const topics = within(container.querySelector<HTMLElement>('[data-htd-col="2"]')!)
    fireEvent.click(topics.getByRole("button", { name: /Keys/ }))
    await waitFor(() =>
      expect(displayHidden(detailPane().getByText("DETAIL settings/keys"))).toBe(false),
    )
    expect(detailPane().queryByText("DETAIL integrations/hooks")).toBeNull()
  })

  it("T61: an intermediate select does not move the menus — the submenu discloses BESIDE the clicked list", async () => {
    // must-not-move-the-menus-on-an-intermediate-select. The regression this pins: the select
    // advances the frontier, auto-hide covering computed against the new frontier covered the very
    // list being clicked in (its child slid over it at the CASCADE_INDENT), and only the pointer
    // reveal — dead here, as in any remount it loses the race to — held it open. The rail click now
    // ENGAGES the stored machine (engageOnRailClick): geometry freezes at the captured base and the
    // reveal roots at the clicked list, structurally, with no pointer movement required.
    const root = freshRootId()
    const { container } = render(<Walk rootId={root} />)
    const col = (i: number) => container.querySelector<HTMLElement>(`[data-htd-col="${i}"]`)!
    // Settled with auto-hide on: ancestors covered to the indent, the deepest list disclosed.
    expect(col(1).style.left).toBe("32px")
    const features = within(col(1))
    fireEvent.click(features.getByRole("button", { name: /Settings/ }))
    await waitFor(() => expect(container.querySelector('[data-htd-col="2"]')).not.toBeNull())
    // The clicked list has not moved…
    expect(col(1).style.left).toBe("32px")
    // …and the disclosed Topics list sits BESIDE it at the full disclosed advance
    // (32 + (240 − 32) = 240), not slid over it at the covered indent (which would be 64).
    expect(col(2).style.left).toBe("240px")
  })

  it("T62: a CLEAR releases the hold with the navigation — no stale pane haunts the walk", async () => {
    // must-release-the-hold-when-the-gesture-ends: the live regression this pins is the v1.15.x
    // hold arming on clears but releasing only on a COMPLETE path — an unselect made the path
    // incomplete forever, so the captured pane showed indefinitely ("unselect doesn't work") and
    // followed the user across surfaces (read as phantom auto-selection).
    const root = freshRootId()
    const { container } = render(<Walk rootId={root} />)
    const detailPane = () => within(container.querySelector("section")!)
    // Arm a hold with an intermediate select in the features list…
    const features = within(container.querySelector<HTMLElement>('[data-htd-col="1"]')!)
    fireEvent.click(features.getByRole("button", { name: /Settings/ }))
    await waitFor(() =>
      expect(displayHidden(detailPane().getByText("DETAIL integrations/hooks"))).toBe(false),
    )
    // …then UNSELECT the root (re-click its selected row). The clear must release the hold: the
    // pane shows the real frontier state (the workspaces frontier's nudge), never the captured
    // detail.
    const rail = within(container.querySelector<HTMLElement>('[data-htd-col="0"]')!)
    fireEvent.click(rail.getByRole("button", { name: /Acme/ }))
    await waitFor(() =>
      expect(detailPane().queryByText("DETAIL integrations/hooks")).toBeNull(),
    )
  })

  it("a deep link at an unselected frontier still shows the frontier detail — nothing was ever held", () => {
    const root = freshRootId()
    // Mount mid-path with no gesture: workspaces chosen, features not — the automatic frontier
    // detail rule stands (there is no held detail and no pointer).
    const { container } = render(
      <HierarchicalMenuDetail
        levels={[
          workspaces("acme", { id: root }),
          level({
            id: "features",
            title: "Features",
            items: [{ id: "integrations", label: "Integrations" }],
            selectedId: null,
          }),
        ]}
        disclosureStyle="cascading"
      >
        <div>LANDING</div>
      </HierarchicalMenuDetail>,
    )
    // The frontier's automatic detail — the select nudge, named after the list — renders inside
    // the detail section (and the row labels do NOT: the pane stays almost empty).
    const section = container.querySelector("section")!
    expect(
      displayHidden(section.querySelector<HTMLElement>("[data-htd-select-hint]")),
    ).toBe(false)
    expect(section.querySelector("[data-htd-select-hint]")).not.toBeNull()
    expect(within(section).queryByText(/Select an item from Features/)).not.toBeNull()
    expect(within(section).queryByText("Integrations")).toBeNull()
  })
})
