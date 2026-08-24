/** Unit tests for CategoryField — the shared category row. The autocomplete/browse pair
 *  underneath is combobox/entityChooser's; what is asserted here is the two things this block
 *  adds and that its two consumers (a note's category, a research document's) both rely on: the
 *  value reads as a PATH through the hierarchy — one per place the category is filed, since
 *  the hierarchy is a DAG — and a crumb is the way that node gets renamed. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategoryField, categoryTrails, type CategoryTreeNode } from '../blocks/category-field'

const ARCHIVE: CategoryTreeNode = { id: 'a', name: 'archive', parentIds: [] }
const DESIGN: CategoryTreeNode = { id: 'd', name: 'design', parentIds: ['a'] }
const NOTES: CategoryTreeNode = { id: 'n', name: 'notes', parentIds: ['d'] }
const LOOSE: CategoryTreeNode = { id: 'x', name: 'loose', parentIds: [] }
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

const names = (trails: CategoryTreeNode[][]): string[][] =>
  trails.map((trail) => trail.map((n) => n.name))

describe('categoryTrails', () => {
  it('walks to the root, outermost first', () => {
    expect(names(categoryTrails(NODES, NOTES))).toEqual([['archive', 'design', 'notes']])
  })

  it('returns ONE trail per parent, for a category filed in several places', () => {
    // The DAG's whole point, and the only place a form row can show it: the same category is
    // genuinely in both, and nothing here is entitled to pick one.
    const both: CategoryTreeNode = { id: 'b', name: 'both', parentIds: ['d', 'x'] }
    expect(names(categoryTrails([...NODES, both], both))).toEqual([
      ['archive', 'design', 'both'],
      ['loose', 'both'],
    ])
  })

  it('stops at a parent that is not in the set', () => {
    const orphan: CategoryTreeNode = { id: 'o', name: 'orphan', parentIds: ['gone'] }
    expect(names(categoryTrails([orphan], orphan))).toEqual([['orphan']])
  })

  it('walks the parent it CAN see when only one of two links is broken', () => {
    const half: CategoryTreeNode = { id: 'h', name: 'half', parentIds: ['gone', 'd'] }
    expect(names(categoryTrails([...NODES, half], half))).toEqual([['archive', 'design', 'half']])
  })

  // The backend refuses the edge that closes a loop, but a graph written before that guard is
  // still served — and a render that hangs is the worst way to find out.
  it('cuts a cycle instead of looping forever', () => {
    const one: CategoryTreeNode = { id: '1', name: 'one', parentIds: ['2'] }
    const two: CategoryTreeNode = { id: '2', name: 'two', parentIds: ['1'] }
    expect(names(categoryTrails([one, two], one))).toEqual([['two', 'one']])
  })

  it('caps the trails a wide graph can produce', () => {
    // Each level under both above it: the path count doubles per level, so a deep chain would
    // otherwise render a form row with hundreds of breadcrumbs.
    const wide: CategoryTreeNode[] = [
      { id: 'r', name: 'r', parentIds: [] },
      { id: 'l1', name: 'l1', parentIds: ['r'] },
    ]
    let leaf: CategoryTreeNode = wide[1] as CategoryTreeNode
    for (let i = 2; i < 12; i++) {
      leaf = { id: `l${i}`, name: `l${i}`, parentIds: [`l${i - 1}`, `l${i - 2}`] }
      wide.push(leaf)
    }
    const trails = categoryTrails(wide, leaf)
    expect(trails.length).toBeLessThanOrEqual(4)
    expect(trails.length).toBeGreaterThan(0)
  })
})

describe('CategoryField — the breadcrumb', () => {
  it('shows the chosen category as its path through the hierarchy', () => {
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

  // A name typed into the autocomplete that the vocabulary has never heard of has no place yet.
  it('shows no path for a name that is not in the hierarchy', () => {
    renderField({ value: 'brand new' })
    expect(screen.queryByRole('navigation', { name: 'Category path' })).toBeNull()
  })

  it('renders one breadcrumb per filing, under a plural label', () => {
    const both: CategoryTreeNode = { id: 'b', name: 'both', parentIds: ['d', 'x'] }
    const nodes = [...NODES, both]
    renderField({ nodes, options: nodes.map((n) => n.name), value: 'both' })
    const crumbs = screen.getByRole('navigation', { name: 'Category paths' })
    expect(crumbs.querySelectorAll('ol')).toHaveLength(2)
    expect(crumbs).toHaveTextContent('design')
    expect(crumbs).toHaveTextContent('loose')
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
