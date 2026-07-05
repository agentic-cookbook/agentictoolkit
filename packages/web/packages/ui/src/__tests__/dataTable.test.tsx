import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DataTable, type DataTableColumn, type DataTableProps } from '../components/data-table'

interface Row { id: string; name: string }
const ROWS: Row[] = [
  { id: 'a', name: 'Ada' }, { id: 'b', name: 'Babbage' },
  { id: 'c', name: 'Curie' }, { id: 'd', name: 'Dirac' },
]
const COLS: DataTableColumn<Row>[] = [{ key: 'name', header: 'Name', sortable: true }]

function renderTable(
  selected: Set<string>,
  onSel = vi.fn(),
  onSort?: DataTableProps<Row>["onSortChange"],
) {
  render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={selected} onSelectionChange={onSel} onSortChange={onSort} ariaLabel="People" />)
  return { onSel }
}
const ids = (s: Set<string>) => [...s].sort().join(',')

describe('DataTable selection', () => {
  it('click selects a single row', () => {
    const { onSel } = renderTable(new Set())
    fireEvent.click(screen.getByText('Babbage').closest('[role="row"]')!)
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('b')
  })
  it('shift-click selects a range from the anchor', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)           // set anchor=a
    fireEvent.click(screen.getByText('Curie').closest('[role="row"]')!, { shiftKey: true })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('a,b,c')
  })
  it('alt-click adds a row to the existing selection', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.click(screen.getByText('Curie').closest('[role="row"]')!, { altKey: true })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('a,c')
  })
  it('alt-click on an already-selected row keeps it selected (no-op remove)', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a', 'c'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.click(screen.getByText('Curie').closest('[role="row"]')!, { altKey: true })
    // onSelectionChange should NOT be called (already selected → no-op)
    expect(onSel).not.toHaveBeenCalled()
  })
  it('meta-click (cmd) behaves like a plain click — single select, no multi-select', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.click(screen.getByText('Curie').closest('[role="row"]')!, { metaKey: true })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('c')
  })
  it('ctrl-click behaves like a plain click — single select, no multi-select', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.click(screen.getByText('Curie').closest('[role="row"]')!, { ctrlKey: true })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('c')
  })
  it('ArrowDown moves the single selection', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('b')
  })
  it('fires onSortChange when a sortable header is clicked', () => {
    const onSort = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} onSortChange={onSort} ariaLabel="People" />)
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(onSort).toHaveBeenCalledWith({ key: 'name', dir: 'asc' })
  })
  it('renders the empty label', () => {
    render(<DataTable<Row> columns={COLS} rows={[]} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} emptyLabel="No people." ariaLabel="People" />)
    expect(screen.getByText('No people.')).toBeTruthy()
  })

  // § 7 spec additions

  it('Shift+ArrowDown extends the range from the anchor', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    // click 'a' to set anchor
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('a,b')
  })

  it('Space toggles the focused row', () => {
    const onSel = vi.fn()
    // Start with 'a' already selected and as anchor
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    // click 'a' to set anchor/focus
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    // onSel was called with {a} from the click — clear call count so we check next
    onSel.mockClear()
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: ' ' })
    // 'a' was selected in the prop; Space should toggle it out (the component sees selectedIds={new Set(['a'])})
    expect(onSel).toHaveBeenCalledOnce()
    expect(ids(onSel.mock.calls.at(0)![0])).toBe('')
  })

  it('selection is preserved across a rows reorder (by id)', () => {
    const onSel = vi.fn()
    const { rerender } = render(
      <DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['b'])} onSelectionChange={onSel} ariaLabel="People" />
    )
    // Reorder: reverse rows
    const reversed = [...ROWS].reverse()
    rerender(
      <DataTable<Row> columns={COLS} rows={reversed} getRowId={(r) => r.id} selectedIds={new Set(['b'])} onSelectionChange={onSel} ariaLabel="People" />
    )
    // 'b' row still has aria-selected
    const babbage = screen.getByText('Babbage').closest('[role="row"]')!
    expect(babbage.getAttribute('aria-selected')).toBe('true')
  })

  it('loading prop shows a loading indicator instead of rows', () => {
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} loading ariaLabel="People" />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('Ada')).toBeNull()
  })

  it('ArrowDown updates aria-activedescendant to the focused row id', () => {
    const onSel = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" />)
    // set anchor/focus to 'a' via click
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    const activedescendant = grid.getAttribute('aria-activedescendant')
    expect(activedescendant).toBeTruthy()
    // The pointed-to element should exist and be the 'b' row
    const target = document.getElementById(activedescendant as string)
    expect(target).not.toBeNull()
    expect(target?.getAttribute('role')).toBe('row')
    expect(target?.querySelector('[role="gridcell"]')?.textContent).toBe('Babbage')
  })
})

describe('DataTable without selection (action-list mode)', () => {
  const columns: DataTableColumn<{ id: string; name: string }>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'actions',
      header: '',
      align: 'end',
      render: (r) => <button type="button">Delete {r.name}</button>,
    },
  ]
  const rows = [
    { id: '1', name: 'Ada' },
    { id: '2', name: 'Alan' },
  ]

  it('renders rows without aria-selected and without row-click selection', () => {
    render(
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} ariaLabel="Users" />,
    )
    const dataRows = screen.getAllByRole('row').slice(1) // drop header row
    for (const row of dataRows) {
      expect(row).not.toHaveAttribute('aria-selected')
      expect(row.className).not.toContain('cursor-pointer')
    }
    // Clicking a row is inert; in-cell actions own the interaction.
    fireEvent.click(screen.getByText('Ada'))
    expect(dataRows[0]).not.toHaveAttribute('data-selected')
    expect(screen.getByRole('button', { name: 'Delete Ada' })).toBeInTheDocument()
  })

  it('does not render the selection grid keyboard machinery', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} ariaLabel="Users" />)
    // A plain table, not a keyboard grid — no role=grid, no tabIndex, no activedescendant.
    expect(screen.queryByRole('grid')).toBeNull()
    const table = screen.getByRole('table')
    expect(table).not.toHaveAttribute('tabindex')
    expect(table).not.toHaveAttribute('aria-activedescendant')
  })

  it('does not preventDefault Space/Arrow keydowns bubbling from in-cell controls', () => {
    const cols: DataTableColumn<{ id: string; name: string }>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (r) => <input aria-label={`edit ${r.name}`} defaultValue={r.name} />,
      },
    ]
    render(<DataTable columns={cols} rows={rows} getRowId={(r) => r.id} ariaLabel="Users" />)
    const input = screen.getByLabelText('edit Ada')
    input.focus()
    // fireEvent returns false when the event was cancelled (preventDefault). In
    // action-list mode the container must NOT cancel these, so typing a space and
    // arrowing in the in-cell input keeps its native behavior.
    expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'ArrowUp' })).toBe(true)
  })
})
