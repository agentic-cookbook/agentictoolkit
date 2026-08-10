/** Unit tests for CategoryField — the shared category row. The autocomplete/browse pair
 *  underneath is combobox/entityChooser's; what is asserted here is the two things this block
 *  adds and that its two consumers (a note's category, a research document's) both rely on: the
 *  value reads as a PATH through the tree, and a crumb is the way that node gets renamed. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategoryField, categoryTrail, type CategoryTreeNode } from '../blocks/category-field'

const ARCHIVE: CategoryTreeNode = { id: 'a', name: 'archive', parentId: null }
const DESIGN: CategoryTreeNode = { id: 'd', name: 'design', parentId: 'a' }
const NOTES: CategoryTreeNode = { id: 'n', name: 'notes', parentId: 'd' }
const LOOSE: CategoryTreeNode = { id: 'x', name: 'loose', parentId: null }
const NODES: CategoryTreeNode[] = [ARCHIVE, DESIGN, NOTES, LOOSE]
const OPTIONS = NODES.map((n) => n.name)

function renderField(
  overrides: Partial<React.ComponentProps<typeof CategoryField>> = {},
): { onChange: ReturnType<typeof vi.fn>; onRename: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn()
  const onRename = vi.fn()
  render(
    <CategoryField
      label="Category"
      noun="category"
      options={OPTIONS}
      nodes={NODES}
      value="notes"
      onChange={onChange}
      onRename={onRename}
      {...overrides}
    />,
  )
  return { onChange, onRename }
}

describe('categoryTrail', () => {
  it('walks to the root, outermost first', () => {
    expect(categoryTrail(NODES, NOTES).map((n) => n.name)).toEqual(['archive', 'design', 'notes'])
  })

  it('stops at a parent that is not in the set', () => {
    const orphan: CategoryTreeNode = { id: 'o', name: 'orphan', parentId: 'gone' }
    expect(categoryTrail([orphan], orphan).map((n) => n.name)).toEqual(['orphan'])
  })

  // `parentId` has no FK behind it, so a cycle is possible and must not hang the render.
  it('cuts a cycle instead of looping forever', () => {
    const one: CategoryTreeNode = { id: '1', name: 'one', parentId: '2' }
    const two: CategoryTreeNode = { id: '2', name: 'two', parentId: '1' }
    expect(categoryTrail([one, two], one).map((n) => n.name)).toEqual(['two', 'one'])
  })
})

describe('CategoryField — the breadcrumb', () => {
  it('shows the chosen category as its path through the tree', () => {
    renderField()
    const crumbs = screen.getByRole('navigation', { name: 'Category path' })
    expect(crumbs).toHaveTextContent('archive')
    expect(crumbs).toHaveTextContent('design')
    expect(crumbs).toHaveTextContent('notes')
  })

  it('shows no path when nothing is chosen', () => {
    renderField({ value: '' })
    expect(screen.queryByRole('navigation', { name: 'Category path' })).toBeNull()
  })

  // A name typed into the autocomplete that the tree has never heard of has no place in it yet.
  it('shows no path for a name that is not in the tree', () => {
    renderField({ value: 'brand new' })
    expect(screen.queryByRole('navigation', { name: 'Category path' })).toBeNull()
  })

  it('leaves the crumbs unclickable when the host passes no rename handler', () => {
    renderField({ onRename: undefined })
    expect(screen.queryByRole('button', { name: /^Rename category/ })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Category path' })).toHaveTextContent('design')
  })
})

describe('CategoryField — renaming from a crumb', () => {
  it('commits on Enter and moves the field with it when the renamed node is the chosen one', async () => {
    const { onChange, onRename } = renderField()
    fireEvent.click(screen.getByRole('button', { name: 'Rename category notes' }))
    const input = screen.getByLabelText('New category name')
    fireEvent.change(input, { target: { value: 'daily notes' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onRename).toHaveBeenCalledWith(NODES[2], 'daily notes'))
    expect(onChange).toHaveBeenCalledWith('daily notes')
  })

  it('does not move the field when some OTHER node in the path is renamed', async () => {
    const { onChange, onRename } = renderField()
    fireEvent.click(screen.getByRole('button', { name: 'Rename category archive' }))
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'attic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(onRename).toHaveBeenCalledWith(NODES[0], 'attic'))
    expect(onChange).not.toHaveBeenCalled()
  })

  // The generic CRUD update takes no uniqueness lock, so a duplicate name would break every read
  // that keys on the name. The refusal has to happen before the request, not after.
  it('refuses a rename onto a name that already exists', async () => {
    const { onRename } = renderField()
    fireEvent.click(screen.getByRole('button', { name: 'Rename category notes' }))
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'design' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(await screen.findByText(/already a category called/)).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('refuses an empty name', async () => {
    const { onRename } = renderField()
    fireEvent.click(screen.getByRole('button', { name: 'Rename category notes' }))
    const input = screen.getByLabelText('New category name')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText(/needs a name/)).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('closes without calling the handler when the rename is cancelled', async () => {
    const { onRename } = renderField()
    fireEvent.click(screen.getByRole('button', { name: 'Rename category notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByLabelText('New category name')).toBeNull())
    expect(onRename).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and shows why when the handler rejects', async () => {
    const onRename = vi.fn().mockRejectedValue(new Error('server said no'))
    renderField({ onRename })
    fireEvent.click(screen.getByRole('button', { name: 'Rename category notes' }))
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'journal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(await screen.findByText('server said no')).toBeInTheDocument()
    expect(screen.getByLabelText('New category name')).toBeInTheDocument()
  })
})
