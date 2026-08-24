import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CategoryRenameDialog } from "../blocks/category-rename-dialog"
import type { CategoryTreeNode } from "../blocks/category-tree"

const WORK: CategoryTreeNode = { id: "work", name: "Work", parentIds: [] }
const PLANNING: CategoryTreeNode = { id: "plan", name: "Planning", parentIds: [] }
const NODES: CategoryTreeNode[] = [WORK, PLANNING]

describe("CategoryRenameDialog", () => {
  it("commits the trimmed new name", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)
    render(
      <CategoryRenameDialog open node={WORK} nodes={NODES} noun="category"
        onRename={onRename} onClose={vi.fn()} />,
    )
    const field = screen.getByRole("textbox", { name: /New category name/i })
    await user.clear(field)
    await user.type(field, "  Employment  ")
    await user.click(screen.getByRole("button", { name: "Rename" }))
    expect(onRename).toHaveBeenCalledWith(WORK, "Employment")
  })

  it("refuses a name another category already has, without calling the host", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    render(
      <CategoryRenameDialog open node={WORK} nodes={NODES} noun="category"
        onRename={onRename} onClose={vi.fn()} />,
    )
    const field = screen.getByRole("textbox", { name: /New category name/i })
    await user.clear(field)
    await user.type(field, "planning")
    await user.click(screen.getByRole("button", { name: "Rename" }))
    expect(screen.getByText(/already a category called/i)).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it("closes without calling the host when the name is unchanged", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onClose = vi.fn()
    render(
      <CategoryRenameDialog open node={WORK} nodes={NODES} noun="category"
        onRename={onRename} onClose={onClose} />,
    )
    await user.click(screen.getByRole("button", { name: "Rename" }))
    expect(onRename).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("keeps the dialog open and shows the reason when the host rejects", async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockRejectedValue(new Error("Name is taken on the server."))
    render(
      <CategoryRenameDialog open node={WORK} nodes={NODES} noun="category"
        onRename={onRename} onClose={vi.fn()} />,
    )
    const field = screen.getByRole("textbox", { name: /New category name/i })
    await user.clear(field)
    await user.type(field, "Employment")
    await user.click(screen.getByRole("button", { name: "Rename" }))
    expect(await screen.findByText("Name is taken on the server.")).toBeInTheDocument()
  })
})

describe("CategoryRenameDialog closing", () => {
  it("does not re-seed the field from the category it is only holding for the exit", () => {
    // The held value is for the way OUT. Seeding from it would reopen the dialog on the
    // last rename's text with no category behind it.
    const { rerender } = render(
      <CategoryRenameDialog open node={WORK} nodes={NODES} noun="category"
        onRename={vi.fn()} onClose={vi.fn()} />,
    )
    rerender(
      <CategoryRenameDialog open={false} node={null} nodes={NODES} noun="category"
        onRename={vi.fn()} onClose={vi.fn()} />,
    )
    rerender(
      <CategoryRenameDialog open node={PLANNING} nodes={NODES} noun="category"
        onRename={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole("textbox", { name: /New category name/i })).toHaveValue("Planning")
  })

  it("renders nothing before it has ever had a category", () => {
    const { container } = render(
      <CategoryRenameDialog open={false} node={null} nodes={NODES} noun="category"
        onRename={vi.fn()} onClose={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
