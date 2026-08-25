// The control two surfaces now share — the markdown document editor (notes, research,
// discussions) and the registry signup-form builder. Those hosts have their own tests for what
// they put in the panes; what belongs HERE is the part they no longer each own: which toggle
// groups exist at which width, and what the hook says is on screen.
//
// The wide/narrow gate is `window.matchMedia`, stubbed per-describe below — the shared setup's
// stub answers `matches: false` to everything, which is the narrow case only.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SplitViewControl, useSplitView } from "../blocks/split-view-control"

afterEach(cleanup)

function stubWidth(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** A host in miniature: the control, plus the pane container the `panesId` names. */
function Host() {
  const view = useSplitView()
  return (
    <div>
      <SplitViewControl view={view} subject="Form" />
      <div id={view.panesId}>
        {view.showEditor && <div data-testid="edit-pane" />}
        {view.showPreview && <div data-testid="preview-pane" />}
      </div>
    </div>
  )
}

describe("SplitViewControl (narrow)", () => {
  const original = window.matchMedia
  afterEach(() => {
    window.matchMedia = original
  })

  it("offers the panes and no layout choice at all", () => {
    // Two half-width columns of prose on a phone are unreadable, so the layout group is absent
    // rather than present-and-disabled.
    stubWidth(false)
    render(<Host />)
    expect(screen.getByRole("group", { name: "Form pane" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Form layout" })).toBeNull()
  })

  it("names its groups after the subject, so two on one page are tellable apart", () => {
    stubWidth(false)
    render(<Host />)
    // "Form pane", not "Editor pane": the registry builder and the note editor render the same
    // control, and a screen-reader user picking one out of a rotor needs to know which.
    expect(screen.queryByRole("group", { name: "Editor pane" })).toBeNull()
  })

  it("shows one pane at a time and swaps on the tab", async () => {
    stubWidth(false)
    render(<Host />)
    expect(screen.getByTestId("edit-pane")).toBeInTheDocument()
    expect(screen.queryByTestId("preview-pane")).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(screen.getByTestId("preview-pane")).toBeInTheDocument()
    expect(screen.queryByTestId("edit-pane")).toBeNull()
  })

  it("points both tabs at the pane CONTAINER, which exists in either tab state", async () => {
    // A per-pane id would resolve for the mounted one and dangle for the other the instant the
    // author switched — a reference AT silently ignores.
    stubWidth(false)
    render(<Host />)
    const target = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("aria-controls")
    const id = target("Edit")
    expect(id).toBeTruthy()
    expect(target("Preview")).toBe(id)
    expect(document.getElementById(id as string)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(document.getElementById(id as string)).toBeInTheDocument()
  })
})

describe("SplitViewControl (wide)", () => {
  const original = window.matchMedia
  afterEach(() => {
    window.matchMedia = original
  })

  it("offers the layout choice alongside the pane tabs", () => {
    stubWidth(true)
    render(<Host />)
    expect(screen.getByRole("group", { name: "Form layout" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Form pane" })).toBeInTheDocument()
  })

  it("shows both panes in the split, and drops the now-meaningless pane tabs", async () => {
    stubWidth(true)
    render(<Host />)
    await userEvent.click(screen.getByRole("button", { name: "Side by side view" }))
    expect(screen.getByTestId("edit-pane")).toBeInTheDocument()
    expect(screen.getByTestId("preview-pane")).toBeInTheDocument()
    // Both panes are already on screen, so a pane chooser would be a control with nothing to
    // choose.
    expect(screen.queryByRole("group", { name: "Form pane" })).toBeNull()
  })
})
