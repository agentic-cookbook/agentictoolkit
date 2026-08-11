import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EditingContainer } from "../container"
import { checkbox, rdid, select, text, textarea } from "../descriptors"
import { EditingHostProvider } from "../host"
import { section } from "../sections"
import { expectLocked, expectUnlocked } from "./fixtures"

/**
 * The bound controls, exercised through the only door that reaches them: a
 * container. There is no import that produces one on its own — that IS the
 * enforcement (see controls.tsx) — so the round trip they are tested for is the
 * one that matters: what the user does to the control comes back out of `onSave`
 * as the record's own type.
 */

function control(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-editing-field="${name}"]`)
  if (!element) throw new Error(`no control rendered for field "${name}"`)
  return element
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Sav/ }) as HTMLButtonElement
}

afterEach(cleanup)

describe("the text control", () => {
  const fields = { name: text({ label: "Display name", hint: "How it reads in lists." }) }
  const sections = [section("Details", ["name"])]

  it("captions itself, shows its hint, and carries the value through", async () => {
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ name: "Participants" }}
          fields={fields}
          sections={sections}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    expect(screen.getByText("Display name")).toBeInTheDocument()
    expect(screen.getByText("How it reads in lists.")).toBeInTheDocument()
    expect((control("name") as HTMLInputElement).value).toBe("Participants")

    fireEvent.change(control("name"), { target: { value: "Renamed" } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: "Renamed" }))
  })

  it("shows the error in place of the hint, and marks itself invalid", () => {
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ name: "Participants" }}
          fields={{ name: text({ label: "Display name", hint: "How it reads.", required: true }) }}
          sections={sections}
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    fireEvent.change(control("name"), { target: { value: "" } })
    expect(screen.getByText("Required.")).toBeInTheDocument()
    expect(screen.queryByText("How it reads.")).not.toBeInTheDocument()
    expect(control("name")).toHaveAttribute("aria-invalid", "true")
  })
})

describe("the rdid control", () => {
  it("lowercases as the user types, so the shift key is not a decision", async () => {
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ id: "adh.participants" }}
          fields={{ id: rdid({ label: "Identifier" }) }}
          sections={[section("Details", ["id"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    fireEvent.change(control("id"), { target: { value: "ADH.Participants" } })
    expect((control("id") as HTMLInputElement).value).toBe("adh.participants")
    fireEvent.change(control("id"), { target: { value: "ADH.Renamed" } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ id: "adh.renamed" }))
  })
})

describe("the textarea control", () => {
  it("renders as a textarea at the declared height and carries its value", async () => {
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ body: "Read me first." }}
          fields={{ body: textarea({ label: "Body", rows: 6 }) }}
          sections={[section("Note", ["body"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    const box = control("body") as HTMLTextAreaElement
    expect(box.tagName).toBe("TEXTAREA")
    expect(box).toHaveAttribute("rows", "6")
    fireEvent.change(box, { target: { value: "Rewritten.\nOn two lines." } })
    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ body: "Rewritten.\nOn two lines." }),
    )
  })
})

describe("the select control", () => {
  it("offers exactly the declared options and returns the chosen one", async () => {
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ visibility: "team" as "private" | "team" | "public" }}
          fields={{
            visibility: select({
              label: "Visibility",
              options: [
                { value: "private", label: "Private" },
                { value: "team", label: "Team" },
                { value: "public", label: "Public" },
              ],
            }),
          }}
          sections={[section("Note", ["visibility"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    const box = control("visibility") as HTMLSelectElement
    expect(Array.from(box.options).map((option) => option.value)).toEqual([
      "private",
      "team",
      "public",
    ])
    expect(box.value).toBe("team")
    fireEvent.change(box, { target: { value: "public" } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ visibility: "public" }))
  })

  it("gives back a number, not the DOM's string", async () => {
    // The DOM only has strings. A numeric select that saved "3" would put a
    // string into a numeric column, and nothing between here and the database
    // would notice.
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ retries: 1 as 1 | 2 | 3 }}
          fields={{
            retries: select({
              label: "Retries",
              options: [
                { value: 1, label: "Once" },
                { value: 2, label: "Twice" },
                { value: 3, label: "Three times" },
              ],
            }),
          }}
          sections={[section("Delivery", ["retries"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    fireEvent.change(control("retries"), { target: { value: "3" } })
    fireEvent.click(saveButton())
    // toHaveBeenCalledWith is type-aware here: 3 and "3" are not interchangeable.
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ retries: 3 }))
  })

  it("shows a stored value the options do not contain, instead of the first option", () => {
    // The silent overwrite. A bare <select> whose value matches no <option>
    // displays the FIRST one, so a row holding a retired choice would read as
    // "Private" — a value the row does not hold — and the next Save would write
    // it without the user ever choosing it. The value gets an option of its own
    // so the pane states the truth, and validation names it (validation.ts).
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          // The type says the union; the ROW says otherwise. That is the whole
          // case — a value written before a choice was retired arrives at a pane
          // whose types have long since forgotten it existed. (Declaring the
          // wider union here would be a compile error instead: a select whose
          // options are narrower than its field is one of the twelve rejected
          // mistakes.)
          record={{ visibility: "retired" as "private" | "team" }}
          fields={{
            visibility: select({
              label: "Visibility",
              options: [
                { value: "private", label: "Private" },
                { value: "team", label: "Team" },
              ],
            }),
          }}
          sections={[section("Note", ["visibility"])]}
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    const box = control("visibility") as HTMLSelectElement
    expect(box.value).toBe("retired")
    expect(Array.from(box.options).map((option) => option.value)).toEqual([
      "retired",
      "private",
      "team",
    ])
    // And it says so, rather than leaving the odd entry to be read as a choice.
    expect(screen.getByText('"retired" is not one of the available choices.')).toBeInTheDocument()
  })

  it("adds no such option when the stored value IS on the list", () => {
    // The control case for the one above: an extra option on every select would
    // duplicate the current choice on every pane in the fleet.
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ visibility: "team" as "private" | "team" }}
          fields={{
            visibility: select({
              label: "Visibility",
              options: [
                { value: "private", label: "Private" },
                { value: "team", label: "Team" },
              ],
            }),
          }}
          sections={[section("Note", ["visibility"])]}
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    const box = control("visibility") as HTMLSelectElement
    expect(Array.from(box.options).map((option) => option.value)).toEqual(["private", "team"])
  })
})

describe("the checkbox control", () => {
  const fields = { archived: checkbox({ label: "Archived", hint: "Hidden from lists." }) }
  const sections = [section("Danger", ["archived"])]

  it("labels itself beside the box and toggles both ways", async () => {
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ archived: false }}
          fields={fields}
          sections={sections}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    expect(screen.getByText("Archived")).toBeInTheDocument()
    expect(screen.getByText("Hidden from lists.")).toBeInTheDocument()

    fireEvent.click(control("archived"))
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ archived: true }))

    fireEvent.click(control("archived"))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith({ archived: false }))
  })

  it("reflects the stored value on the way in", () => {
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ archived: true }}
          fields={fields}
          sections={sections}
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    expect(control("archived")).toHaveAttribute("data-checked")
  })
})

describe("a field the surface has locked", () => {
  it("is disabled on its own, without locking the rest of the pane", () => {
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ id: "adh.participants", name: "Participants" }}
          fields={{
            id: rdid({ label: "Identifier", disabled: true }),
            name: text({ label: "Display name" }),
          }}
          sections={[section("Details", ["id", "name"])]}
          onSave={vi.fn()}
        />
      </EditingHostProvider>,
    )
    expect(control("id")).toBeDisabled()
    expect(control("name")).toBeEnabled()
  })
})

describe("every control", () => {
  it("is locked while a save is in flight", async () => {
    let release: (() => void) | undefined
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    render(
      <EditingHostProvider host={{ UnsavedChangesGuard: () => null, Alert: () => null }}>
        <EditingContainer
          record={{ name: "Participants", archived: false }}
          fields={{ name: text({ label: "Name" }), archived: checkbox({ label: "Archived" }) }}
          sections={[section("Details", ["name", "archived"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )
    fireEvent.change(control("name"), { target: { value: "Renamed" } })
    fireEvent.click(saveButton())
    // Typing into a field whose value is already on its way to the server would
    // be silently discarded by the commit that follows.
    await waitFor(() => expectLocked(control("name")))
    expectLocked(control("archived"))
    release?.()
    await waitFor(() => expectUnlocked(control("name")))
    expectUnlocked(control("archived"))
  })
})
