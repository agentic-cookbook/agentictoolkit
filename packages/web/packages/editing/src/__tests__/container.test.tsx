import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EditingContainer } from "../container"
import { EditingHostProvider } from "../host"
import { section } from "../sections"
import type { AnySection } from "../sections"
import {
  RDID_MESSAGE,
  deferred,
  expectLocked,
  teamFields,
  teamSections,
  testHost,
} from "./fixtures"
import type { Team } from "./fixtures"

const CLEAN: Team = { displayName: "Participants", identifier: "adh.participants", archived: false }
const BROKEN: Team = { displayName: "Participants", identifier: "participants", archived: false }

function Harness({
  record,
  onSave,
  onCancel,
  readOnly,
}: {
  record: Team
  onSave: (values: Team) => void | Promise<void>
  onCancel?: () => void
  readOnly?: boolean
}): React.ReactElement {
  return (
    <EditingHostProvider host={testHost}>
      <EditingContainer
        record={record}
        fields={teamFields}
        sections={teamSections}
        context={{ orgSlug: "adh" }}
        onSave={onSave}
        onCancel={onCancel}
        readOnly={readOnly}
      />
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

function guardArmed(): boolean {
  return screen.getByTestId("nav-guard").getAttribute("data-armed") === "yes"
}

function type(name: string, value: string): void {
  fireEvent.change(control(name), { target: { value } })
}

afterEach(cleanup)

describe("the Save button", () => {
  it("is inert until something actually changes", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    expect(saveButton()).toBeDisabled()
  })

  it("lights up on the first edit and goes dark again when it is undone", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    type("displayName", "Participants renamed")
    expect(saveButton()).toBeEnabled()
    type("displayName", "Participants")
    expect(saveButton()).toBeDisabled()
  })

  it("hands the whole edited record to onSave and goes quiet once it lands", async () => {
    const onSave = vi.fn(async () => {})
    render(<Harness record={CLEAN} onSave={onSave} />)
    type("displayName", "Renamed")
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({
      displayName: "Renamed",
      identifier: "adh.participants",
      archived: false,
    })
    await waitFor(() => expect(saveButton()).toBeDisabled())
    expect(guardArmed()).toBe(false)
  })

  it("stays dark while the draft is invalid, and says which field is why", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    type("identifier", "participants")
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(RDID_MESSAGE)).toBeInTheDocument()
    // A DIFFERENT valid value, not the original one back: typing the stored value
    // in again makes the pane clean, and a clean pane's Save is dark for a reason
    // that has nothing to do with validity.
    type("identifier", "adh.renamed")
    expect(saveButton()).toBeEnabled()
    expect(screen.queryByText(RDID_MESSAGE)).not.toBeInTheDocument()
  })

  it("names the empty required field rather than going dead in silence", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    type("displayName", "")
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText("Required.")).toBeInTheDocument()
  })

  it("is blocked by a cross-field rule, with the reason on the pane", () => {
    render(
      <EditingHostProvider host={testHost}>
        <EditingContainer
          record={CLEAN}
          fields={teamFields}
          sections={teamSections}
          context={{ orgSlug: "adh" }}
          validate={(values) =>
            values.archived && values.displayName !== "" ? "Archive it under its old name." : null
          }
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    fireEvent.click(control("archived"))
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText("Archive it under its old name.")).toBeInTheDocument()
  })

  it("keeps the draft and shows the reason when the write is refused", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("Identifier already taken.")
    })
    render(<Harness record={CLEAN} onSave={onSave} />)
    type("displayName", "Renamed")
    fireEvent.click(saveButton())
    expect(await screen.findByText("Identifier already taken.")).toBeInTheDocument()
    // Nothing was lost and nothing was faked: the edit is still there, Save is
    // still offered, and the guard is still armed.
    expect((control("displayName") as HTMLInputElement).value).toBe("Renamed")
    expect(saveButton()).toBeEnabled()
    expect(guardArmed()).toBe(true)
  })

  it("cannot be pressed twice while a write is in flight", async () => {
    const gate = deferred<void>()
    const onSave = vi.fn(() => gate.promise)
    render(<Harness record={CLEAN} onSave={onSave} />)
    type("displayName", "Renamed")
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toBeDisabled())
    fireEvent.click(saveButton())
    gate.resolve()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
})

describe("Cancel", () => {
  it("throws the draft away and tells the pane it is done", () => {
    const onCancel = vi.fn()
    render(<Harness record={CLEAN} onSave={vi.fn()} onCancel={onCancel} />)
    type("displayName", "Renamed")
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }))
    expect((control("displayName") as HTMLInputElement).value).toBe("Participants")
    expect(saveButton()).toBeDisabled()
    expect(guardArmed()).toBe(false)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe("the navigation guard", () => {
  it("is armed exactly while there is unsaved work", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    expect(guardArmed()).toBe(false)
    type("displayName", "Renamed")
    expect(guardArmed()).toBe(true)
    type("displayName", "Participants")
    expect(guardArmed()).toBe(false)
  })

  it("needs no wiring at the call site", () => {
    // The Harness passes record/fields/sections/onSave and nothing else. This is
    // the whole point: the pane cannot forget to publish its dirtiness, because
    // publishing it was never the pane's job.
    render(<Harness record={CLEAN} onSave={vi.fn()} />)
    expect(screen.getByTestId("nav-guard")).toBeInTheDocument()
  })
})

describe("a read-only container", () => {
  it("offers no Save bar, arms no guard, and repairs nothing", () => {
    const onSave = vi.fn()
    render(<Harness record={BROKEN} onSave={onSave} readOnly />)
    expect(screen.queryByRole("button", { name: /^Sav/ })).not.toBeInTheDocument()
    // The guard is still mounted (a read-only pane can enclose an editable row —
    // see nesting.test.tsx) but has nothing to protect, so it stays disarmed.
    expect(guardArmed()).toBe(false)
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("locks every control", () => {
    render(<Harness record={CLEAN} onSave={vi.fn()} readOnly />)
    expectLocked(control("displayName"))
    expectLocked(control("identifier"))
    expectLocked(control("archived"))
  })

  it("does not let a click through the lock", () => {
    // The checkbox is a `<span role="checkbox">`, so the CSS that greys out a
    // disabled input does not apply to it. Attributes alone would not prove the
    // user cannot still toggle it.
    render(<Harness record={CLEAN} onSave={vi.fn()} readOnly />)
    fireEvent.click(control("archived"))
    expect(control("archived")).toHaveAttribute("data-unchecked")
  })
})

describe("a record that arrives while the pane is open", () => {
  it("is adopted while the draft is clean", () => {
    const { rerender } = render(<Harness record={CLEAN} onSave={vi.fn()} />)
    rerender(<Harness record={{ ...CLEAN, displayName: "From the server" }} onSave={vi.fn()} />)
    expect((control("displayName") as HTMLInputElement).value).toBe("From the server")
    expect(saveButton()).toBeDisabled()
  })

  it("does not overwrite what the user has typed", () => {
    const { rerender } = render(<Harness record={CLEAN} onSave={vi.fn()} />)
    type("displayName", "Mine")
    rerender(<Harness record={{ ...CLEAN, displayName: "From the server" }} onSave={vi.fn()} />)
    expect((control("displayName") as HTMLInputElement).value).toBe("Mine")
    expect(saveButton()).toBeEnabled()
  })

  it("is not adopted AFTER the save that superseded it", async () => {
    // The nastiest shape of this. A refetch lands mid-edit and is declined, the
    // user saves, and the pane goes clean — at which point a naive re-seed sees a
    // record identity it has not adopted yet and adopts it, silently replacing
    // what the user just wrote with the row the server held a moment BEFORE the
    // write. Nothing errors and the values look plausible; the edit is simply gone.
    const onSave = vi.fn(async () => {})
    const stale = { ...CLEAN, displayName: "From the server" }
    const { rerender } = render(<Harness record={CLEAN} onSave={onSave} />)

    type("displayName", "Mine")
    rerender(<Harness record={stale} onSave={onSave} />)
    fireEvent.click(saveButton())

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...CLEAN, displayName: "Mine" }))
    // The parent re-renders with the row it still holds; the pane is clean now.
    rerender(<Harness record={stale} onSave={onSave} />)
    expect((control("displayName") as HTMLInputElement).value).toBe("Mine")
    expect(saveButton()).toBeDisabled()
  })

  it("is picked up by Cancel, which is when it stops being a threat", () => {
    // Cancel means "give me what the server has". A declined refetch IS that, and
    // it is newer than the baseline — so throwing the draft away has to land on
    // the declined row, not on the row the pane was seeded with.
    const { rerender } = render(<Harness record={CLEAN} onSave={vi.fn()} />)
    type("displayName", "Mine")
    rerender(<Harness record={{ ...CLEAN, displayName: "From the server" }} onSave={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Cancel/ }))
    expect((control("displayName") as HTMLInputElement).value).toBe("From the server")
    expect(saveButton()).toBeDisabled()
    expect(guardArmed()).toBe(false)
  })
})

/**
 * A layout the type system does not reject — because the caller lost the literal
 * inference the check depends on. `sections` arrives here as a widened
 * `AnySection[]`, which is what happens the moment a real pane builds its layout in
 * a loop, behind a `let`, or through a helper. The runtime check is the whole
 * reason that is survivable, so these are the tests of the safety net, not of the
 * type.
 */
function DynamicLayout({ sections }: { sections: readonly AnySection[] }): React.ReactElement {
  return (
    <EditingHostProvider host={testHost}>
      <EditingContainer
        record={CLEAN}
        fields={teamFields}
        sections={sections as never}
        context={{ orgSlug: "adh" }}
        onSave={vi.fn()}
      />
    </EditingHostProvider>
  )
}

/**
 * Render a layout fault with console.error silenced, and hand back what it said.
 * The spy is restored in the same call: un-restored, it outlives the file (there is
 * no `restoreMocks` in vitest.config.ts) and swallows every later suite's React
 * warnings — the ones that say a test is rendering something broken.
 */
function renderFaulty(sections: readonly AnySection[]): void {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    render(<DynamicLayout sections={sections} />)
    expect(spy).toHaveBeenCalled()
  } finally {
    spy.mockRestore()
  }
}

describe("a layout fault the type system cannot catch", () => {
  it("reports a field laid out twice", () => {
    // The one direction the type genuinely cannot see even with literals: a union
    // of section keys cannot tell one occurrence of a key from two, and a field
    // laid out twice edits one value from two controls.
    renderFaulty([
      section("Team", ["displayName", "identifier"]),
      section("Again", ["identifier", "archived"]),
    ])
    expect(
      screen.getByText("These fields are laid out in more than one section: identifier."),
    ).toBeInTheDocument()
  })

  it("reports a field no section lays out", () => {
    // The silent one. An unlaid field is INVISIBLE and still validated, so it can
    // hold Save grey with nothing on screen to fix — the exact failure this package
    // exists to remove.
    renderFaulty([section("Team", ["displayName", "identifier"])])
    expect(
      screen.getByText("These fields are declared but no section lays them out: archived."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/laid out in more than one section/)).not.toBeInTheDocument()
  })

  it("reports a section naming a field that does not exist", () => {
    renderFaulty([
      section("Team", ["displayName", "identifier", "nickname"]),
      section("Danger", ["archived"]),
    ])
    expect(
      screen.getByText('Section "Team" lays out unknown field "nickname".'),
    ).toBeInTheDocument()
  })

  it("says nothing about a layout that covers every field exactly once", () => {
    // The control. Without it a check that always complains would pass the three
    // tests above.
    render(<DynamicLayout sections={teamSections} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
