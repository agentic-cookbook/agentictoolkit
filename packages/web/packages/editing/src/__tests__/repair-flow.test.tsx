import "@testing-library/jest-dom/vitest"
import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EditingContainer } from "../container"
import { rdid, text } from "../descriptors"
import { EditingHostProvider } from "../host"
import { section } from "../sections"
import { deferred, teamFields, teamSections, testHost } from "./fixtures"
import type { Team } from "./fixtures"

/**
 * THE REPORTED BUG, end to end.
 *
 * A team was stored with `identifier: "participants"`, which the pane's own
 * reverse-domain rule rejects. The pane re-ran that rule on every render, so
 * `valid` was false from mount and Save could never light up no matter what else
 * was edited — and nothing on screen said why.
 *
 * The container's answer: data that fails a rule the UI enforces gets repaired,
 * with the user's acknowledgement, before the pane is editable. After that the
 * only thing that can hold Save down is something the user did.
 */

const BROKEN: Team = { displayName: "Participants", identifier: "participants", archived: false }

function Harness({
  record,
  onSave,
}: {
  record: Team
  onSave: (values: Team) => void | Promise<void>
}): React.ReactElement {
  return (
    <EditingHostProvider host={testHost}>
      <EditingContainer
        record={record}
        fields={teamFields}
        sections={teamSections}
        context={{ orgSlug: "adh" }}
        onSave={onSave}
      />
    </EditingHostProvider>
  )
}

function control(name: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`[data-editing-field="${name}"]`)
  if (!element) throw new Error(`no control rendered for field "${name}"`)
  return element
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Sav/ }) as HTMLButtonElement
}

function alertTitle(): string {
  return screen.getByTestId("alert-title").textContent ?? ""
}

function acknowledge(): void {
  fireEvent.click(screen.getByRole("button", { name: "OK" }))
}

afterEach(cleanup)

describe("loading data that fails the pane's own rules", () => {
  it("asks first, repairs, confirms, and leaves a pane that works", async () => {
    const onSave = vi.fn(async () => {})
    render(<Harness record={BROKEN} onSave={onSave} />)

    expect(alertTitle()).toBe("Repair required")
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "This data needs some repair and will be saved.",
    )
    expect(onSave).not.toHaveBeenCalled()

    acknowledge()

    await waitFor(() => expect(alertTitle()).toBe("Repair succeeded"))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ ...BROKEN, identifier: "adh.participants" })

    acknowledge()
    await waitFor(() => expect(screen.queryByTestId("alert")).not.toBeInTheDocument())

    expect(control("identifier").value).toBe("adh.participants")
    // The repaired values are the new baseline, so the pane is clean.
    expect(saveButton()).toBeDisabled()
  })

  it("no longer holds Save down for a field the user never touched", async () => {
    // The regression. Before the container, editing Display name on this record
    // left Save grey forever, because the STORED identifier was still failing.
    render(<Harness record={BROKEN} onSave={vi.fn(async () => {})} />)
    acknowledge()
    await waitFor(() => expect(alertTitle()).toBe("Repair succeeded"))
    acknowledge()

    fireEvent.change(control("displayName"), { target: { value: "Participants renamed" } })
    expect(saveButton()).toBeEnabled()
  })

  it("prompts once, not once per render", async () => {
    const onSave = vi.fn(async () => {})
    const { rerender } = render(<Harness record={BROKEN} onSave={onSave} />)
    acknowledge()
    await waitFor(() => expect(alertTitle()).toBe("Repair succeeded"))
    acknowledge()
    rerender(<Harness record={BROKEN} onSave={onSave} />)
    await waitFor(() => expect(screen.queryByTestId("alert")).not.toBeInTheDocument())
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("cannot be acknowledged twice while the repairing write is running", async () => {
    const gate = deferred<void>()
    const onSave = vi.fn(() => gate.promise)
    render(<Harness record={BROKEN} onSave={onSave} />)
    acknowledge()
    await waitFor(() => expect(screen.getByTestId("alert")).toHaveAttribute("data-busy", "yes"))
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled()
    gate.resolve()
    await waitFor(() => expect(alertTitle()).toBe("Repair succeeded"))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("keeps the repaired values in the draft when the write is refused", async () => {
    const onSave = vi
      .fn<(values: Team) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Backend said no."))
      .mockResolvedValue(undefined)
    render(<Harness record={BROKEN} onSave={onSave} />)
    acknowledge()

    await waitFor(() => expect(alertTitle()).toBe("Repair failed"))
    expect(screen.getByTestId("alert-description")).toHaveTextContent("Backend said no.")
    acknowledge()

    // The fix survives the failed write: the pane opens dirty with the repaired
    // value in the box, so retrying is one click and nothing has to be redone.
    expect(control("identifier").value).toBe("adh.participants")
    expect(saveButton()).toBeEnabled()

    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave).toHaveBeenLastCalledWith({ ...BROKEN, identifier: "adh.participants" })
  })

  it("refuses to save a repair that produced another invalid value", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const fields = {
      name: text({ label: "Name" }),
      identifier: rdid({
        label: "Identifier",
        validate: (value) => (value.includes(".") ? null : "needs a dot"),
        // Broken on purpose: the output still fails the rule above.
        repair: (value) => `${value}!`,
      }),
    }
    const onSave = vi.fn(async () => {})
    render(
      <EditingHostProvider host={testHost}>
        <EditingContainer
          record={{ name: "Team", identifier: "participants" }}
          fields={fields}
          sections={[section("Team", ["name", "identifier"])]}
          onSave={onSave}
        />
      </EditingHostProvider>,
    )

    await waitFor(() => expect(alertTitle()).toBe("Repair failed"))
    // Writing the output of a broken repair would put a second bad row over the
    // first, so nothing is written at all.
    expect(onSave).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("says nothing at all about a record that already passes", () => {
    render(<Harness record={{ ...BROKEN, identifier: "adh.participants" }} onSave={vi.fn()} />)
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument()
  })
})
