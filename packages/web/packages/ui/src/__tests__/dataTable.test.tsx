import * as React from 'react'
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

// OPENING a row, which is a different act from selecting it. Without `onRowActivate` a table has
// to choose: multi-select, or open on click. These pin that both work at once.
describe('DataTable row activation', () => {
  const row = (name: string): HTMLElement =>
    screen.getByText(name).closest('[role="row"]') as HTMLElement

  it('double-click activates the row; a single click only selects', () => {
    const onSel = vi.fn()
    const onActivate = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={onSel} onRowActivate={onActivate} ariaLabel="People" />)

    fireEvent.click(row('Babbage'))
    expect(onActivate).not.toHaveBeenCalled()
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('b')

    fireEvent.doubleClick(row('Babbage'))
    expect(onActivate).toHaveBeenCalledWith('b')
  })

  it('Enter activates the focused row', () => {
    const onActivate = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} onRowActivate={onActivate} ariaLabel="People" />)

    fireEvent.click(row('Curie'))
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith('c')
  })

  it('leaves Enter alone when no consumer asked for activation', () => {
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} ariaLabel="People" />)
    fireEvent.click(row('Curie'))
    // Uncancelled ⇒ the key reaches whatever encloses the grid (a form's submit, a dialog).
    expect(fireEvent.keyDown(screen.getByRole('grid'), { key: 'Enter' })).toBe(true)
  })

  it('does not activate on a double-click that belongs to an in-cell control', () => {
    const onActivate = vi.fn()
    const cols: DataTableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: (r) => <input aria-label={`edit ${r.name}`} defaultValue={r.name} /> },
    ]
    render(<DataTable<Row> columns={cols} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set()} onSelectionChange={vi.fn()} onRowActivate={onActivate} ariaLabel="People" />)

    // Double-clicking a word inside an inline editor selects that word — it must not open the row.
    fireEvent.doubleClick(screen.getByLabelText('edit Ada'))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('activates on double-click even in action-list mode (no selection)', () => {
    const onActivate = vi.fn()
    render(<DataTable<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id} onRowActivate={onActivate} ariaLabel="People" />)

    fireEvent.doubleClick(row('Dirac'))
    expect(onActivate).toHaveBeenCalledWith('d')
    // …and the rows say so: an openable row is a pointer target even with nothing to select.
    expect(row('Dirac').className).toContain('cursor-pointer')
  })
})

// Dragging rows into a new ORDER. Where the row lands is dnd-kit's job and jsdom cannot measure
// it (every rect is 0×0 here), so these pin the part that is ours: who gets the handle.
describe('DataTable reorder', () => {
  // The table does NOT render the grip. A consumer that reorders already has a column for
  // moving a row — a pair of arrow buttons, say — and a grip in its own cell would be two
  // widgets for one act sitting in two adjacent boxes. So the handle props go to the CELL
  // RENDERER and the consumer puts them where the row's other move controls already live.
  const GRIP_COLS: DataTableColumn<Row>[] = [
    { key: 'name', header: 'Name' },
    {
      key: 'move',
      header: '',
      render: (r, ctx) => (
        <span {...ctx.dragHandleProps} data-testid={`grip-${r.id}`} data-dragging={ctx.dragging}>
          ⠿
        </span>
      ),
    },
  ]

  it('hands the cell renderer a live handle when the row may be dragged', () => {
    render(<DataTable<Row> columns={GRIP_COLS} rows={ROWS} getRowId={(r) => r.id} ariaLabel="People" reorder={{ onDrop: vi.fn(), describeRow: (id) => id }} />)
    // dnd-kit's `attributes` carry the role, and their presence is how a keyboard user reaches
    // the drag at all — so this asserts the handle is REAL, not an empty object spread.
    expect(screen.getByTestId('grip-a')).toHaveAttribute('role', 'button')
    expect(screen.getByTestId('grip-a')).toHaveAttribute('data-dragging', 'false')
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1) // + the header row
  })

  it('hands an inert handle to a row `canDrag` refuses', () => {
    render(<DataTable<Row> columns={GRIP_COLS} rows={ROWS} getRowId={(r) => r.id} ariaLabel="People" reorder={{ onDrop: vi.fn(), canDrag: (id) => id !== 'b' }} />)
    expect(screen.getByTestId('grip-a')).toHaveAttribute('role', 'button')
    expect(screen.getByTestId('grip-b')).not.toHaveAttribute('role')
  })

  it('renders the same rows with no reorder prop, and no handle', () => {
    render(<DataTable<Row> columns={GRIP_COLS} rows={ROWS} getRowId={(r) => r.id} ariaLabel="People" />)
    expect(screen.getByTestId('grip-a')).not.toHaveAttribute('role')
    expect(screen.getByText('Curie')).toBeInTheDocument()
  })

  it('leaves a grid keystroke to the grid, and a handle keystroke to the handle', () => {
    // The handle is a `role="button"` INSIDE the grid. While it holds focus every Space and
    // Arrow belongs to the drag, so the grid's own key handling has to stand down — which is
    // what the `[role='button']` clause in `fromCellControl` is for.
    const onSel = vi.fn()
    render(<DataTable<Row> columns={GRIP_COLS} rows={ROWS} getRowId={(r) => r.id} selectedIds={new Set(['a'])} onSelectionChange={onSel} ariaLabel="People" reorder={{ onDrop: vi.fn() }} />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(screen.getByTestId('grip-a'), { key: 'ArrowDown' })
    expect(onSel).not.toHaveBeenCalled()
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(ids(onSel.mock.calls.at(-1)![0])).toBe('b')
  })
})

describe('DataTable selection checkboxes', () => {
  const rows = [
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Cleo' },
  ]
  const columns = [{ key: 'name', header: 'Name' }]

  function Harness({ showSelectionCheckboxes = true }: { showSelectionCheckboxes?: boolean }) {
    const [selected, setSelected] = React.useState<Set<string>>(new Set())
    return (
      <DataTable
        ariaLabel="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectedIds={selected}
        onSelectionChange={setSelected}
        showSelectionCheckboxes={showSelectionCheckboxes}
      />
    )
  }

  it('renders no checkbox column unless asked', () => {
    render(<Harness showSelectionCheckboxes={false} />)
    expect(screen.queryByRole('checkbox', { name: 'Select Alice' })).toBeNull()
  })

  it('renders one checkbox per row plus a select-all', () => {
    render(<Harness />)
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  })

  it('ticking a row checkbox ADDS to the selection rather than replacing it', () => {
    // The trap this test exists for: the checkbox's clickable surface sits inside the row, so
    // without stopPropagation the row's own click handler still fires and would call
    // selectOne() — turning a three-row tick into a one-row selection. Batch select would be
    // unusable and look like a rendering bug.
    render(<Harness />)
    fireEvent.click(screen.getAllByRole('checkbox')[1]!)
    fireEvent.click(screen.getAllByRole('checkbox')[2]!)
    expect((screen.getAllByRole('checkbox')[1] as HTMLInputElement).getAttribute('data-checked')).not.toBeNull()
    expect((screen.getAllByRole('checkbox')[2] as HTMLInputElement).getAttribute('data-checked')).not.toBeNull()
  })

  it('unticking removes just that row', () => {
    render(<Harness />)
    const boxes = () => screen.getAllByRole('checkbox')
    fireEvent.click(boxes()[1]!)
    fireEvent.click(boxes()[2]!)
    fireEvent.click(boxes()[1]!)
    expect(boxes()[1]!.getAttribute('data-checked')).toBeNull()
    expect(boxes()[2]!.getAttribute('data-checked')).not.toBeNull()
  })

  it('select-all ticks every row, and again clears them', () => {
    render(<Harness />)
    const all = () => screen.getByRole('checkbox', { name: 'Select all' })
    fireEvent.click(all())
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box.getAttribute('data-checked')).not.toBeNull()
    }
    fireEvent.click(all())
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box.getAttribute('data-checked')).toBeNull()
    }
  })

  it('select-all leaves ids the table is NOT showing alone', () => {
    // "All" means the rows on screen. A list that paginates or filters above the table hands
    // `rows` a slice, and `new Set(ids)` / `new Set()` would have made the header checkbox a
    // silent editor of a selection made elsewhere: ticking it DROPPED the off-screen ids while
    // claiming to add, and unticking cleared rows the user could not see.
    const onSel = vi.fn()
    render(
      <DataTable
        ariaLabel="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectedIds={new Set(['off-page'])}
        onSelectionChange={onSel}
        showSelectionCheckboxes
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect([...(onSel.mock.calls[0]![0] as Set<string>)].sort()).toEqual(['a', 'b', 'c', 'off-page'])
  })

  it('unticking select-all removes only the shown rows', () => {
    const onSel = vi.fn()
    render(
      <DataTable
        ariaLabel="People"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectedIds={new Set(['a', 'b', 'c', 'off-page'])}
        onSelectionChange={onSel}
        showSelectionCheckboxes
      />,
    )
    // Every shown row is selected, so the header reads checked and this click is the "clear" one.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect([...(onSel.mock.calls[0]![0] as Set<string>)]).toEqual(['off-page'])
  })

  it('the checkbox column is not resizable', () => {
    render(<Harness />)
    expect(screen.queryByRole('separator', { name: 'Resize column __select' })).toBeNull()
  })

  it('names each checkbox from the row when the id IS the descriptive field', () => {
    // The guess skips any field equal to the id, so a table keyed by its own name column falls
    // through to whatever comes next — here a category every row shares, which would give all
    // three rows the checkbox name "Select fruit" and make them indistinguishable to a screen
    // reader. `describeRow` is the caller saying what the row is called.
    const catalogue = [
      { resource: 'apple', kind: 'fruit' },
      { resource: 'pear', kind: 'fruit' },
    ]
    render(
      <DataTable
        ariaLabel="Catalogue"
        columns={[{ key: 'resource', header: 'Resource' }]}
        rows={catalogue}
        getRowId={(r) => r.resource}
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        showSelectionCheckboxes
        describeRow={(r) => r.resource}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Select apple' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Select pear' })).toBeTruthy()
  })

  it('without describeRow, a table keyed by its own name column collides on the next field', () => {
    // Documents the fallback this prop exists for, so the guess cannot quietly get "better" and
    // leave the pages that pass `describeRow` looking like they did it for no reason.
    render(
      <DataTable
        ariaLabel="Catalogue"
        columns={[{ key: 'resource', header: 'Resource' }]}
        rows={[
          { resource: 'apple', kind: 'fruit' },
          { resource: 'pear', kind: 'fruit' },
        ]}
        getRowId={(r) => r.resource}
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        showSelectionCheckboxes
      />,
    )
    expect(screen.getAllByRole('checkbox', { name: 'Select fruit' })).toHaveLength(2)
  })
})
