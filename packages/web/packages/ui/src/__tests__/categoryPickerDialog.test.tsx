import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CategoryPickerDialog } from "../blocks/category-picker-dialog"
import type { CategoryTreeNode } from "../blocks/category-tree"

const NODES: CategoryTreeNode[] = [
  { id: "work", name: "Work", parentIds: [] },
  { id: "plan", name: "Planning", parentIds: [] },
  { id: "q3", name: "Q3", parentIds: ["work", "plan"] },
  { id: "budget", name: "Budget", parentIds: ["q3"] },
]

function open(props: Partial<React.ComponentProps<typeof CategoryPickerDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <CategoryPickerDialog
      open
      nodes={NODES}
      title="Move category"
      confirmLabel="Move"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

describe("CategoryPickerDialog", () => {
  it("shows the root categories and reveals children when a row is expanded", async () => {
    const user = userEvent.setup()
    open()
    expect(screen.getByRole("treeitem", { name: /Work/ })).toBeInTheDocument()
    expect(screen.queryByRole("treeitem", { name: /Q3/ })).not.toBeInTheDocument()
    await user.click(screen.getByTitle("Expand Work"))
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toBeInTheDocument()
  })

  it("filters to matching categories anywhere in the tree, with their trail", async () => {
    const user = userEvent.setup()
    open()
    await user.type(screen.getByRole("searchbox", { name: /Filter categories/i }), "budg")
    expect(screen.getByRole("option", { name: /Budget/ })).toBeInTheDocument()
    expect(screen.getByText("Work / Q3")).toBeInTheDocument()
    expect(screen.queryByText("Planning")).not.toBeInTheDocument()
  })

  it("confirms with the selected category id, and is disabled until one is picked", async () => {
    const user = userEvent.setup()
    const { onConfirm } = open()
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled()
    await user.click(screen.getByRole("treeitem", { name: /Planning/ }))
    await user.click(screen.getByRole("button", { name: "Move" }))
    expect(onConfirm).toHaveBeenCalledWith("plan")
  })

  it("offers the top level as a pick when allowRoot is set, confirming with null", async () => {
    const user = userEvent.setup()
    const { onConfirm } = open({ allowRoot: true, rootLabel: "Top level" })
    await user.click(screen.getByRole("treeitem", { name: "Top level" }))
    await user.click(screen.getByRole("button", { name: "Move" }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it("cannot select a category the host forbade", async () => {
    // The name of this test is the requirement: the row must REFUSE the click. Asserting only
    // that the confirm button greys out was compatible with the row taking the selection, the
    // full selected highlight and `aria-selected="true"` — announced as selected and disabled
    // at once — while silently discarding whatever valid pick the user already had.
    const user = userEvent.setup()
    const { onConfirm } = open({ disabledIds: ["plan"] })
    await user.click(screen.getByRole("treeitem", { name: /Work/ }))
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-selected", "true")

    await user.click(screen.getByRole("treeitem", { name: /Planning/ }))
    expect(screen.getByRole("treeitem", { name: /Planning/ })).toHaveAttribute(
      "aria-selected",
      "false",
    )
    // The valid pick survives the misclick, and the confirm still means it.
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Move" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Move" }))
    expect(onConfirm).toHaveBeenCalledWith("work")
  })

  it("refuses a forbidden row in the filter results too", async () => {
    const user = userEvent.setup()
    const { onConfirm } = open({ disabledIds: ["plan"] })
    await user.type(screen.getByRole("searchbox", { name: /Filter categories/i }), "planning")
    const option = screen.getByRole("option", { name: /Planning/ })
    await user.click(option)
    expect(option).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("reports each row's depth, which otherwise exists only as left padding", async () => {
    // The one fact this dialog exists to convey. Without `aria-level` a screen reader
    // announces a three-deep row exactly like a root — "Budget, tree item" — and the user
    // cannot tell where the move is about to land.
    const user = userEvent.setup()
    open()
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-level", "1")
    await user.click(screen.getByTitle("Expand Work"))
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toHaveAttribute("aria-level", "2")
    await user.click(screen.getByTitle("Expand Q3"))
    expect(screen.getByRole("treeitem", { name: /Budget/ })).toHaveAttribute("aria-level", "3")
  })

  it("keeps ONE tab stop in the filter results, and moves it with ArrowDown/ArrowUp", async () => {
    // The filter half is a `listbox`, and the listbox pattern makes the same two promises the
    // tree pattern does. Without them, narrowing to 38 matches turns one tab stop into 38 and
    // kills the arrow key the user just learned in the tree above.
    const user = userEvent.setup()
    open()
    await user.type(screen.getByRole("searchbox", { name: /Filter categories/i }), "g")
    const options = screen.getAllByRole("option")
    expect(options.map((o) => o.textContent)).toHaveLength(2)
    expect(options.filter((o) => o.getAttribute("tabindex") === "0")).toHaveLength(1)

    options[0]!.focus()
    await user.keyboard("{ArrowDown}")
    expect(options[1]!).toHaveFocus()
    expect(options[1]!).toHaveAttribute("tabindex", "0")
    expect(options[0]!).toHaveAttribute("tabindex", "-1")
    await user.keyboard("{ArrowUp}")
    expect(options[0]!).toHaveFocus()
  })

  it("keeps the twisty out of the accessibility tree it cannot be reached from", async () => {
    // A `tree` owns treeitems; a button among them is a control the tree pattern gives the
    // keyboard no route to. It stays a pointer affordance, and the row carries the state.
    const user = userEvent.setup()
    open()
    expect(screen.queryByRole("button", { name: "Expand Work" })).not.toBeInTheDocument()
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    await user.click(screen.getByTitle("Expand Work"))
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("selects ONE drawing of a category filed under two parents", async () => {
    // Q3 is filed under both Work and Planning, so the tree draws it twice from one id.
    // Marking both rows selected reads to a screen reader as two selections in a
    // single-select tree, and shows the user two highlights for one pick.
    const user = userEvent.setup()
    open()
    await user.click(screen.getByTitle("Expand Work"))
    await user.click(screen.getByTitle("Expand Planning"))
    const rows = screen.getAllByRole("treeitem", { name: /Q3/ })
    expect(rows).toHaveLength(2)
    await user.click(rows[1]!)
    expect(rows.map((r) => r.getAttribute("aria-selected"))).toEqual(["false", "true"])
  })

  it("reports each row's position among its siblings", async () => {
    // Depth alone is not a place. Without posinset/setsize a reader announces "Q3, level 2"
    // with no way to say whether it is the first of one or the fourth of nine.
    const user = userEvent.setup()
    open()
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-posinset", "1")
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-setsize", "2")
    await user.click(screen.getByTitle("Expand Work"))
    const q3 = screen.getByRole("treeitem", { name: /Q3/ })
    expect(q3).toHaveAttribute("aria-posinset", "1")
    expect(q3).toHaveAttribute("aria-setsize", "1")
  })

  it("counts the top-level row as one of the first level's rows", async () => {
    open({ allowRoot: true })
    const top = screen.getByRole("treeitem", { name: /Top level/ })
    expect(top).toHaveAttribute("aria-posinset", "1")
    expect(top).toHaveAttribute("aria-setsize", "3")
    expect(screen.getByRole("treeitem", { name: /^Work/ })).toHaveAttribute("aria-posinset", "2")
  })

  it("keeps the empty-state message out of the widget's own child list", async () => {
    // A `tree`/`listbox` owns rows; a paragraph among them is either dropped or counted.
    const user = userEvent.setup()
    open()
    await user.type(screen.getByRole("searchbox", { name: /Filter categories/i }), "zzz")
    expect(screen.getByText(/No categories match/)).toBeInTheDocument()
    expect(screen.getByRole("listbox", { name: "Categories" })).not.toContainElement(
      screen.getByText(/No categories match/),
    )
  })

  it("will not confirm the top level while a filter hides its row", async () => {
    // `selected === null` means "Top level", and under a filter that row is not on screen:
    // Confirm sat enabled over a list with no highlight anywhere, and committed a move to
    // the root for a user who thought they were confirming the one row they could see.
    const user = userEvent.setup()
    const { onConfirm } = open({ allowRoot: true })
    expect(screen.getByRole("button", { name: "Move" })).toBeEnabled()
    await user.type(screen.getByRole("searchbox", { name: /Filter categories/i }), "budg")
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled()
    await user.click(screen.getByRole("option", { name: /Budget/ }))
    await user.click(screen.getByRole("button", { name: "Move" }))
    expect(onConfirm).toHaveBeenCalledWith("budget")
  })

  it("cancels without confirming", async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = open()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("keeps exactly one row tabbable at a time, the roving tab stop", () => {
    open()
    const rows = screen.getAllByRole("treeitem")
    const tabbable = rows.filter((r) => r.getAttribute("tabindex") === "0")
    expect(tabbable).toHaveLength(1)
    expect(rows.filter((r) => r.getAttribute("tabindex") === "-1")).toHaveLength(rows.length - 1)
  })

  it("moves the roving tab stop with ArrowDown and ArrowUp, skipping collapsed children", async () => {
    const user = userEvent.setup()
    open()
    screen.getByRole("treeitem", { name: /Work/ }).focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("treeitem", { name: /Planning/ })).toHaveFocus()
    expect(screen.getByRole("treeitem", { name: /Planning/ })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("tabindex", "-1")
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveFocus()
  })

  it("expands a collapsed node with ArrowRight, then moves into its first child", async () => {
    const user = userEvent.setup()
    open()
    const work = screen.getByRole("treeitem", { name: /Work/ })
    work.focus()
    expect(work).toHaveAttribute("aria-expanded", "false")
    await user.keyboard("{ArrowRight}")
    expect(work).toHaveAttribute("aria-expanded", "true")
    expect(work).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toHaveFocus()
  })

  it("collapses an expanded node with ArrowLeft, then a second ArrowLeft moves to its parent", async () => {
    const user = userEvent.setup()
    open()
    const work = screen.getByRole("treeitem", { name: /Work/ })
    work.focus()
    await user.keyboard("{ArrowRight}") // expand Work
    const q3 = screen.getByRole("treeitem", { name: /Q3/ })
    q3.focus()
    await user.keyboard("{ArrowRight}") // expand Q3 (it has a Budget child)
    expect(q3).toHaveAttribute("aria-expanded", "true")
    await user.keyboard("{ArrowLeft}") // collapses Q3, focus stays put
    expect(q3).toHaveAttribute("aria-expanded", "false")
    expect(q3).toHaveFocus()
    await user.keyboard("{ArrowLeft}") // already collapsed: moves up to its parent
    expect(work).toHaveFocus()
  })

  it("moves to the first and last visible rows with Home and End", async () => {
    const user = userEvent.setup()
    open()
    screen.getByRole("treeitem", { name: /Planning/ }).focus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveFocus()
    await user.keyboard("{End}")
    expect(screen.getByRole("treeitem", { name: /Planning/ })).toHaveFocus()
  })

  it("keeps the open dialog's state when initialSelectedId changes underneath it", async () => {
    // The reset belongs to the OPEN transition. Guarded only on `open` while also DEPENDING on
    // `initialSelectedId`, it fired mid-interaction whenever that prop moved — a background
    // refetch reshaping the caller's state — and wiped the typed filter, the expansion, and the
    // row the user had already picked, with the dialog still on screen.
    const user = userEvent.setup()
    const view = render(
      <CategoryPickerDialog
        open
        nodes={NODES}
        title="Move category"
        confirmLabel="Move"
        initialSelectedId="work"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    await user.click(screen.getByTitle("Expand Work"))
    await user.click(screen.getByRole("treeitem", { name: /Q3/ }))
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toHaveAttribute("aria-selected", "true")

    view.rerender(
      <CategoryPickerDialog
        open
        nodes={NODES}
        title="Move category"
        confirmLabel="Move"
        initialSelectedId="plan"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toHaveAttribute("aria-selected", "true")
  })

  it("resets to the initial selection when it is reopened", async () => {
    // The other half of the same rule: a reopen IS a fresh question, so the previous visit's
    // selection must not survive it.
    const user = userEvent.setup()
    const props = {
      nodes: NODES,
      title: "Move category",
      confirmLabel: "Move",
      initialSelectedId: "work",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }
    const view = render(<CategoryPickerDialog open {...props} />)
    await user.click(screen.getByTitle("Expand Work"))
    await user.click(screen.getByRole("treeitem", { name: /Q3/ }))
    expect(screen.getByRole("treeitem", { name: /Q3/ })).toHaveAttribute("aria-selected", "true")

    view.rerender(<CategoryPickerDialog open={false} {...props} />)
    view.rerender(<CategoryPickerDialog open {...props} />)
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("treeitem", { name: /Q3/ })).not.toBeInTheDocument()
  })
})
