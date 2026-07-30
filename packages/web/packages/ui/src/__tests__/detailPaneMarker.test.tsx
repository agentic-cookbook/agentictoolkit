import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { HierarchicalTopicDetail, type TopicLevel } from "../blocks/hierarchical-topic-detail"
import { HierarchicalMenuDetail } from "../blocks/hierarchical-menu-detail"
import { DETAIL_PANE_ATTR, LIVE_DETAIL_PANE } from "../lib/detail-pane"

/**
 * `data-detail-pane` — which pane is the one the user is actually looking at.
 *
 * HTDV's crossfade puts a `cloneNode(true)` copy of the outgoing detail pane in the DOM for the
 * length of the fade. The copy is hidden from the accessibility tree (`aria-hidden` + `inert` on
 * its overlay), so `getByRole` and screen readers never see it — but it is ordinary DOM, so
 * `getByLabel`, `getByText`, `querySelectorAll` and friends see two of everything the pane holds.
 * That cost a pair of e2e specs when the platform switched these boards from HMDV (no clone) to
 * HTDV; the marker is what lets a caller say "the live one" without knowing a crossfade exists.
 *
 * The subtle half — and the only reason this file exists — is that the clone is DEEP and includes
 * the pane element itself, so it arrives wearing whatever marker the live pane wore. Marking the
 * live pane is therefore not enough on its own: the copy has to be re-stamped on the way out.
 *
 * jsdom gates both halves of the clone path, so `installCrossfadeHarness` lifts them: no layout
 * (`offsetWidth`/`offsetHeight` are 0, and a zero-sized pane is deliberately not snapshotted) and
 * no WAAPI (`animate` is absent, and the component treats that as "land instantly, no fade").
 */

/** A fade that never finishes, so the ghost stays put for the assertions — the mid-fade instant is
 *  exactly the state under test. `cancel`/`addEventListener` are all the component touches. */
const pendingAnimation = () =>
  ({ cancel: () => {}, addEventListener: () => {} }) as unknown as Animation

function installCrossfadeHarness(): () => void {
  const sized = { configurable: true, get: () => 800 }
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", sized)
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", sized)
  const proto = HTMLElement.prototype as unknown as { animate?: unknown }
  proto.animate = pendingAnimation
  return () => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight
    delete proto.animate
  }
}

/** The component reads the wall clock to tell a swap from the settle cascade of one gesture (a
 *  sub-300ms token change does NOT fade). Owning the clock keeps that out of the test's hands. */
let now = 0
const tick = (ms: number) => {
  now += ms
}

let uninstall: () => void
beforeEach(() => {
  uninstall = installCrossfadeHarness()
  now = 1_000_000
  vi.spyOn(Date, "now").mockImplementation(() => now)
})
afterEach(() => {
  uninstall()
  vi.restoreAllMocks()
})

/** Fresh per test: the swap memory is module-scoped, keyed by the stack's root level id. */
let seq = 0
const freshId = () => `sites-${++seq}`

const level = (id: string, selectedId: string | null): TopicLevel => ({
  id,
  title: "Sites",
  items: [
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
  ],
  selectedId,
  onSelect: () => {},
  onClear: () => {},
})

const livePanes = () => document.querySelectorAll(LIVE_DETAIL_PANE)
const ghostPanes = () => document.querySelectorAll(`[${DETAIL_PANE_ATTR}="ghost"]`)

describe("the live detail pane is nameable while a crossfade runs", () => {
  it("keeps ONE live pane across a swap, and the duplicate content is all in the ghost", () => {
    const id = freshId()
    const Board = ({ selectedId }: { selectedId: string }) => (
      <HierarchicalTopicDetail levels={[level(id, selectedId)]}>
        <div>Peer label field</div>
      </HierarchicalTopicDetail>
    )

    const { rerender } = render(<Board selectedId="alpha" />)
    expect(livePanes()).toHaveLength(1)
    expect(ghostPanes()).toHaveLength(0)

    tick(5_000) // past the settle debounce, so this reads as a swap and actually fades
    rerender(<Board selectedId="beta" />)

    // The clone is really there — this is the ambiguity the e2e specs hit, reproduced.
    expect(screen.getAllByText("Peer label field")).toHaveLength(2)
    // ...and it is entirely accounted for by the ghost, leaving one unambiguous live pane.
    expect(livePanes()).toHaveLength(1)
    expect(ghostPanes()).toHaveLength(1)
    expect(within(livePanes()[0] as HTMLElement).getAllByText("Peer label field")).toHaveLength(1)
  })

  it("marks HMDV's pane the same way, so a locator need not know which stack is mounted", () => {
    render(
      <HierarchicalMenuDetail levels={[level(freshId(), "alpha")]} disclosureStyle="cascading">
        <div>Peer label field</div>
      </HierarchicalMenuDetail>,
    )
    // HMDV fades only the incoming half — it never clones — so there is nothing to re-stamp here.
    expect(livePanes()).toHaveLength(1)
    expect(ghostPanes()).toHaveLength(0)
  })
})
