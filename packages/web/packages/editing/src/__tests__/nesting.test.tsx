import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EditingContainer } from "../container"
import { EditingHostProvider } from "../host"
import { section } from "../sections"
import { noteFields, noteSections, saveIn, teamFields, teamSections, testHost } from "./fixtures"
import type { Note, Team } from "./fixtures"

/**
 * A ROW EDITOR INSIDE A PANE — the shape Mike described: the row's own Save saves
 * the row, but backing out of the table still has to warn about it.
 *
 * The rule under test is that dirtiness rolls UP and the guard is published ONCE,
 * by the outermost container. Everything here is an assertion about a page the
 * outer pane did not write and cannot see: it never learns that a row exists, and
 * still cannot let the user walk away from one.
 */

const TEAM: Team = { displayName: "Participants", identifier: "adh.participants", archived: false }
const NOTE: Note = { title: "Welcome", body: "Read me first.", visibility: "team" }

function Nested({
  onOuterSave = vi.fn(),
  onInnerSave = vi.fn(),
  showRow = true,
}: {
  onOuterSave?: (values: Team) => void | Promise<void>
  onInnerSave?: (values: Note) => void | Promise<void>
  showRow?: boolean
}): React.ReactElement {
  return (
    <EditingHostProvider host={testHost}>
      <EditingContainer
        record={TEAM}
        fields={teamFields}
        sections={teamSections}
        context={{ orgSlug: "adh" }}
        onSave={onOuterSave}
      >
        {showRow && (
          <EditingContainer
            record={NOTE}
            fields={noteFields}
            sections={noteSections}
            onSave={onInnerSave}
          />
        )}
      </EditingContainer>
    </EditingHostProvider>
  )
}

function containers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-editing-container]"))
}

/** The outer pane, and the row inside it. */
function outer(): HTMLElement {
  const [element] = containers()
  if (!element) throw new Error("no container rendered")
  return element
}

function inner(): HTMLElement {
  const element = containers()[1]
  if (!element) throw new Error("no nested container rendered")
  return element
}

function control(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-editing-field="${name}"]`)
  if (!element) throw new Error(`no control rendered for field "${name}"`)
  return element
}

function type(name: string, value: string): void {
  fireEvent.change(control(name), { target: { value } })
}

function guardArmed(): boolean {
  return screen.getByTestId("nav-guard").getAttribute("data-armed") === "yes"
}

afterEach(cleanup)

describe("a container inside a container", () => {
  it("publishes exactly one navigation guard for the page", () => {
    render(<Nested />)
    expect(containers()).toHaveLength(2)
    // Two guards would be two prompts for one decision.
    expect(screen.getAllByTestId("nav-guard")).toHaveLength(1)
  })

  it("arms the page guard from a row the outer pane knows nothing about", () => {
    render(<Nested />)
    expect(guardArmed()).toBe(false)
    type("title", "Welcome, edited")
    expect(guardArmed()).toBe(true)
  })

  it("marks the enclosing container dirty even though its own fields are untouched", () => {
    render(<Nested />)
    expect(outer()).not.toHaveAttribute("data-editing-dirty")
    type("title", "Welcome, edited")
    expect(outer()).toHaveAttribute("data-editing-dirty")
  })

  it("keeps the two Save buttons independent", () => {
    render(<Nested />)
    type("title", "Welcome, edited")
    expect(saveIn(inner())).toBeEnabled()
    // The row is dirty; the pane is not. Rolling dirtiness up must not roll
    // saveability up with it, or saving a row would demand saving the pane.
    expect(saveIn(outer())).toBeDisabled()
  })

  it("saves the row on its own and disarms the page guard", async () => {
    const onInnerSave = vi.fn(async () => {})
    const onOuterSave = vi.fn()
    render(<Nested onInnerSave={onInnerSave} onOuterSave={onOuterSave} />)
    type("body", "Rewritten.")
    fireEvent.click(saveIn(inner()))

    await waitFor(() => expect(onInnerSave).toHaveBeenCalledTimes(1))
    expect(onInnerSave).toHaveBeenCalledWith({ ...NOTE, body: "Rewritten." })
    expect(onOuterSave).not.toHaveBeenCalled()
    await waitFor(() => expect(guardArmed()).toBe(false))
  })

  it("keeps the guard armed when the row is saved but the pane is not", async () => {
    render(<Nested onInnerSave={vi.fn(async () => {})} />)
    type("displayName", "Renamed")
    type("body", "Rewritten.")
    fireEvent.click(saveIn(inner()))
    await waitFor(() => expect(saveIn(inner())).toBeDisabled())
    expect(guardArmed()).toBe(true)
  })

  it("stops speaking for a row that is dismissed mid-edit", async () => {
    const { rerender } = render(<Nested />)
    type("title", "Welcome, edited")
    expect(guardArmed()).toBe(true)

    // Closing the row throws the edit away — which is a decision, not unsaved
    // work. A report left behind here would strand the page: armed forever, with
    // nothing on screen the user could save to clear it.
    rerender(<Nested showRow={false} />)
    await waitFor(() => expect(guardArmed()).toBe(false))
  })

  it("keeps the guard armed when one of two rows is dismissed", async () => {
    function TwoRows({ showSecond }: { showSecond: boolean }): React.ReactElement {
      return (
        <EditingHostProvider host={testHost}>
          <EditingContainer
            record={TEAM}
            fields={teamFields}
            sections={teamSections}
            context={{ orgSlug: "adh" }}
            onSave={vi.fn()}
          >
            <EditingContainer
              record={NOTE}
              fields={{ title: noteFields.title }}
              sections={[section("First", ["title"])]}
              onSave={vi.fn()}
            />
            {showSecond && (
              <EditingContainer
                record={NOTE}
                fields={{ body: noteFields.body }}
                sections={[section("Second", ["body"])]}
                onSave={vi.fn()}
              />
            )}
          </EditingContainer>
        </EditingHostProvider>
      )
    }

    const { rerender } = render(<TwoRows showSecond />)
    type("title", "Edited")
    type("body", "Edited too.")
    expect(guardArmed()).toBe(true)
    rerender(<TwoRows showSecond={false} />)
    // The first row is still dirty, so the page still has work to lose.
    await waitFor(() => expect(guardArmed()).toBe(true))
  })

  it("rolls dirtiness up through more than one level", () => {
    render(
      <EditingHostProvider host={testHost}>
        <EditingContainer
          record={TEAM}
          fields={teamFields}
          sections={teamSections}
          context={{ orgSlug: "adh" }}
          onSave={vi.fn()}
        >
          <EditingContainer
            record={NOTE}
            fields={{ title: noteFields.title }}
            sections={[section("Row", ["title"])]}
            onSave={vi.fn()}
          >
            <EditingContainer
              record={NOTE}
              fields={{ body: noteFields.body }}
              sections={[section("Cell", ["body"])]}
              onSave={vi.fn()}
            />
          </EditingContainer>
        </EditingContainer>
      </EditingHostProvider>,
    )
    expect(containers()).toHaveLength(3)
    expect(screen.getAllByTestId("nav-guard")).toHaveLength(1)
    type("body", "Edited at the bottom.")
    expect(guardArmed()).toBe(true)
    expect(containers()[1]).toHaveAttribute("data-editing-dirty")
    expect(outer()).toHaveAttribute("data-editing-dirty")
  })

  it("still guards an editable row inside a read-only pane", () => {
    // The pane cannot be saved, so it publishes no dirtiness of its own — but it
    // is still the root, and the row's unsaved work is still the user's.
    render(
      <EditingHostProvider host={testHost}>
        <EditingContainer
          record={TEAM}
          fields={teamFields}
          sections={teamSections}
          context={{ orgSlug: "adh" }}
          onSave={vi.fn()}
          readOnly
        >
          <EditingContainer
            record={NOTE}
            fields={{ title: noteFields.title }}
            sections={[section("Row", ["title"])]}
            onSave={vi.fn()}
          />
        </EditingContainer>
      </EditingHostProvider>,
    )
    expect(guardArmed()).toBe(false)
    type("title", "Edited")
    expect(guardArmed()).toBe(true)
  })
})
