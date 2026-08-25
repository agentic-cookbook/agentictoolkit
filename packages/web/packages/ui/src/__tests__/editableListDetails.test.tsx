// @vitest-environment jsdom
//
// `EditableList`'s details pane: the half of the list that is about ONE row.
//
// The three states are the whole contract — nothing selected, exactly one, more than one — and
// they are asserted here rather than in the one panel that uses the prop today, because the next
// list to want a details pane inherits this behaviour without writing a line of it.
import { describe, expect, it } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { useEditableList } from "../blocks/use-editable-list"
import { EditableList } from "../blocks/editable-list"
import type { EditableListColumn, EditableListController } from "../blocks/editable-list-types"

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: "a", name: "Ada" },
  { id: "b", name: "Bo" },
]

const columns: EditableListColumn<Row>[] = [{ key: "name", header: "Name", value: (r) => r.name }]

/** Renders the list and hands the controller back, so a test can drive the selection directly. */
function Harness({ onList }: { onList: (list: EditableListController<Row>) => void }) {
  const list = useEditableList<Row>({ rows, getRowId: (r) => r.id, columns })
  onList(list)
  return (
    <EditableList<Row>
      list={list}
      ariaLabel="People"
      describeRow={(r) => r.name}
      details={{
        label: "Profile",
        render: (r) => <span>detail for {r.name}</span>,
        emptyLabel: "Pick one.",
        manyLabel: "Pick just one.",
        actions: (r) => <button type="button">Edit {r ? r.name : "nobody"}</button>,
      }}
    />
  )
}

/** The pane's header bar — the split's horizontal separator, told apart from the table's own
 *  vertical column-resize handles. */
function paneBar(): HTMLElement {
  const bar = screen
    .getAllByRole("separator")
    .find((el) => el.getAttribute("aria-orientation") === "horizontal")
  if (!bar) throw new Error("no details pane header bar")
  return bar
}

function renderList() {
  let list!: EditableListController<Row>
  render(<Harness onList={(l) => (list = l)} />)
  const select = (...ids: string[]) => act(() => list.setSelectedIds(new Set(ids)))
  return { select }
}

describe("EditableList details", () => {
  it("asks for a row when nothing is selected, and hands the actions null", () => {
    renderList()
    expect(screen.getByText("Pick one.")).toBeTruthy()
    // The pane's bar still shows its own name, since there is no row to name it after.
    expect(paneBar().textContent).toContain("Profile")
    expect(screen.getByRole("button", { name: "Edit nobody" })).toBeTruthy()
  })

  it("shows the one selected row, and names the pane after it", () => {
    const { select } = renderList()
    select("a")
    expect(screen.getByText("detail for Ada")).toBeTruthy()
    // The pane's bar renames itself after the row, via `describeRow` — the same words the
    // checkbox uses for it. (The bar IS the split's separator, so that is what to read.)
    expect(paneBar().textContent).toContain("Ada")
    expect(screen.getByRole("button", { name: "Edit Ada" })).toBeTruthy()
  })

  it("asks for a single row when several are selected", () => {
    const { select } = renderList()
    select("a", "b")
    expect(screen.getByText("Pick just one.")).toBeTruthy()
    expect(screen.queryByText("detail for Ada")).toBeNull()
    expect(screen.getByRole("button", { name: "Edit nobody" })).toBeTruthy()
  })

  it("draws no pane at all without the prop", () => {
    function Bare() {
      const list = useEditableList<Row>({ rows, getRowId: (r) => r.id, columns })
      return <EditableList<Row> list={list} ariaLabel="People" />
    }
    render(<Bare />)
    expect(screen.queryByText("Pick one.")).toBeNull()
  })
})
