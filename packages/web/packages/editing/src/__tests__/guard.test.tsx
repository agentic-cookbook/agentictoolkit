import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { confirmNavigation } from "@agentic-toolkit/ui/lib/navigation-guard"

import { EditingContainer } from "../container"
import { EditingHostProvider, createEditingHost, defaultEditingHost } from "../host"
import { teamFields, teamSections } from "./fixtures"
import type { Team } from "./fixtures"

/**
 * THE REAL HOST against the platform's own navigation registry — no fake in
 * sight. `container.test.tsx` proves the container publishes `when`; this proves
 * that publishing it is enough to actually stop a navigation, which is the claim
 * a user's unsaved work depends on.
 */

const CLEAN: Team = { displayName: "Participants", identifier: "adh.participants", archived: false }

function Harness({
  onSave = vi.fn(async () => {}),
  onNavigate,
}: {
  onSave?: (values: Team) => void | Promise<void>
  onNavigate?: (href: string) => void
}): React.ReactElement {
  // An app supplies its router; without one the platform host falls back to a
  // full page load, which jsdom cannot perform — so the link tests pass one.
  const host = React.useMemo(
    () => (onNavigate ? createEditingHost({ onNavigate }) : defaultEditingHost),
    [onNavigate],
  )
  return (
    <EditingHostProvider host={host}>
      <EditingContainer
        record={CLEAN}
        fields={teamFields}
        sections={teamSections}
        context={{ orgSlug: "adh" }}
        onSave={onSave}
      />
      <a href="/somewhere-else">Somewhere else</a>
    </EditingHostProvider>
  )
}

function control(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-editing-field="${name}"]`)
  if (!element) throw new Error(`no control rendered for field "${name}"`)
  return element
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Sav/ }) as HTMLButtonElement
}

function type(name: string, value: string): void {
  fireEvent.change(control(name), { target: { value } })
}

/** Ask the registry the way the platform's chrome does, without awaiting the
 *  answer — the prompt has to render before anyone can answer it. */
function askToNavigate(): { answer: () => boolean | undefined } {
  let answer: boolean | undefined
  act(() => {
    void confirmNavigation().then((ok) => {
      answer = ok
    })
  })
  return { answer: () => answer }
}

/**
 * Resolve once the pane has FINISHED saving. Waiting on a disabled Save button
 * would not do it: Save is disabled during the write as well as after it, so the
 * wait can return while the guard is still legitimately armed. The container's
 * `data-editing-dirty` marker is the same signal the guard itself reads, and it
 * clears only when the write has landed and the baseline has moved.
 */
async function saved(): Promise<void> {
  await waitFor(() =>
    expect(document.querySelector("[data-editing-container]")).not.toHaveAttribute(
      "data-editing-dirty",
    ),
  )
}

function fireBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

afterEach(cleanup)

describe("a clean container", () => {
  it("registers nothing, so navigation is never even asked about", async () => {
    render(<Harness />)
    await expect(confirmNavigation()).resolves.toBe(true)
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument()
  })

  it("does not interfere with closing the page", () => {
    render(<Harness />)
    expect(fireBeforeUnload().defaultPrevented).toBe(false)
  })
})

describe("a dirty container", () => {
  it("raises the platform's one unsaved-changes prompt", async () => {
    render(<Harness />)
    type("displayName", "Renamed")
    askToNavigate()
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument()
    expect(screen.getByText("Your unsaved changes will be lost.")).toBeInTheDocument()
  })

  it("lets the navigation through when the user discards", async () => {
    render(<Harness />)
    type("displayName", "Renamed")
    const asked = askToNavigate()
    await screen.findByText("Discard unsaved changes?")
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    await waitFor(() => expect(asked.answer()).toBe(true))
  })

  it("blocks the navigation when the user stays", async () => {
    render(<Harness />)
    type("displayName", "Renamed")
    const asked = askToNavigate()
    await screen.findByText("Discard unsaved changes?")
    fireEvent.click(screen.getByRole("button", { name: "Stay" }))
    await waitFor(() => expect(asked.answer()).toBe(false))
    // Staying keeps the work: the draft is untouched and Save is still offered.
    expect((control("displayName") as HTMLInputElement).value).toBe("Renamed")
    expect(saveButton()).toBeEnabled()
  })

  it("stops the page being closed", () => {
    render(<Harness />)
    type("displayName", "Renamed")
    expect(fireBeforeUnload().defaultPrevented).toBe(true)
  })

  it("intercepts an in-app link rather than letting the router take it", async () => {
    const onNavigate = vi.fn()
    render(<Harness onNavigate={onNavigate} />)
    type("displayName", "Renamed")

    const link = screen.getByRole("link", { name: "Somewhere else" })
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => {
      link.dispatchEvent(click)
    })
    expect(click.defaultPrevented).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()

    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/somewhere-else"))
  })

  it("leaves an in-app link alone once the work is saved", async () => {
    const onNavigate = vi.fn()
    render(<Harness onNavigate={onNavigate} />)
    type("displayName", "Renamed")
    fireEvent.click(saveButton())
    await saved()

    const link = screen.getByRole("link", { name: "Somewhere else" })
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    act(() => {
      link.dispatchEvent(click)
    })
    expect(click.defaultPrevented).toBe(false)
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument()
  })
})

describe("the registry after the pane is done with it", () => {
  it("is clear once the work is saved", async () => {
    render(<Harness />)
    type("displayName", "Renamed")
    fireEvent.click(saveButton())
    await saved()
    await expect(confirmNavigation()).resolves.toBe(true)
  })

  it("is clear once the edit is cancelled", async () => {
    render(<Harness />)
    type("displayName", "Renamed")
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }))
    await expect(confirmNavigation()).resolves.toBe(true)
  })

  it("is clear once the pane unmounts mid-edit", async () => {
    const view = render(<Harness />)
    type("displayName", "Renamed")
    // A guard left registered by an unmounted pane would block every navigation
    // on the site afterwards, with no way for the user to satisfy it.
    view.unmount()
    await expect(confirmNavigation()).resolves.toBe(true)
    expect(fireBeforeUnload().defaultPrevented).toBe(false)
  })
})
