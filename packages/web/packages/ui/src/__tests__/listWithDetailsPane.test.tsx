import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ListWithDetailsPane } from '../blocks/list-with-details-pane'
import type { DataTableColumn } from '../components/data-table'

interface Row { id: string; name: string }
const ROWS: Row[] = [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Babbage' }]
const COLS: DataTableColumn<Row>[] = [{ key: 'name', header: 'Name' }]

function setup(extra: Partial<React.ComponentProps<typeof ListWithDetailsPane<Row>>> = {}) {
  const onDelete = vi.fn()
  render(<ListWithDetailsPane<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id}
    renderDetail={(r) => <div>detail:{r.name}</div>} emptyDetail={<div>pick one</div>}
    onDelete={onDelete} deleteConfirm={{ title: 'Delete rows?' }} ariaLabel="Rows" {...extra} />)
  return { onDelete }
}

describe('ListWithDetailsPane', () => {
  it('shows the empty-detail hint when nothing is selected', () => {
    setup(); expect(screen.getByText('pick one')).toBeTruthy()
  })
  it('renders the detail for a single selected row', () => {
    setup()
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    expect(screen.getByText('detail:Ada')).toBeTruthy()
  })
  it('disables Delete until a row is selected, then confirms before onDelete', () => {
    const { onDelete } = setup()
    // Get the toolbar Delete button (the first one, before the dialog opens)
    const toolbarDel = screen.getByRole('button', { name: 'Delete' })
    expect(toolbarDel).toBeDisabled()

    // Select a row
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    expect(toolbarDel).not.toBeDisabled()

    // Click toolbar Delete — should NOT call onDelete yet (needs confirm)
    fireEvent.click(toolbarDel)
    expect(onDelete).not.toHaveBeenCalled()

    // The confirm dialog should now be open — find and click its Delete button
    const dialog = screen.getByRole('dialog')
    const dialogButtons = dialog.querySelectorAll('button')
    const confirmBtn = Array.from(dialogButtons).find(
      (b) => b.textContent?.trim() === 'Delete'
    )
    expect(confirmBtn).toBeTruthy()
    fireEvent.click(confirmBtn!)
    expect(onDelete).toHaveBeenCalledWith(['a'])
  })
  it('filters rows by the filter box', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'bab' } })
    expect(screen.queryByText('Ada')).toBeNull()
    expect(screen.getByText('Babbage')).toBeTruthy()
  })
  it('shows the multi-select hint when >1 selected', () => {
    setup()
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    fireEvent.click(screen.getByText('Babbage').closest('[role="row"]')!, { altKey: true })
    expect(screen.getByText(/select a single row/i)).toBeTruthy()
  })
  it('disables a requiresSelection action until a row is selected', () => {
    const onClick = vi.fn()
    setup({ actions: [{ id: 'approve', label: 'Approve', onClick, requiresSelection: true }] })
    const approve = screen.getByRole('button', { name: 'Approve' })
    expect(approve).toBeDisabled()
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    expect(approve).not.toBeDisabled()
  })
  it('prunes stale selected id when row is removed from rows out-of-band', () => {
    const onDelete = vi.fn()
    const { rerender } = render(
      <ListWithDetailsPane<Row> columns={COLS} rows={ROWS} getRowId={(r) => r.id}
        renderDetail={(r) => <div>detail:{r.name}</div>} emptyDetail={<div>pick one</div>}
        onDelete={onDelete} deleteConfirm={{ title: 'Delete rows?' }} ariaLabel="Rows" />
    )
    // Select Ada (id='a')
    fireEvent.click(screen.getByText('Ada').closest('[role="row"]')!)
    const toolbarDel = screen.getByRole('button', { name: 'Delete' })
    expect(toolbarDel).not.toBeDisabled()

    // Remove Ada from rows out-of-band — only Babbage remains
    rerender(
      <ListWithDetailsPane<Row> columns={COLS} rows={[{ id: 'b', name: 'Babbage' }]} getRowId={(r) => r.id}
        renderDetail={(r) => <div>detail:{r.name}</div>} emptyDetail={<div>pick one</div>}
        onDelete={onDelete} deleteConfirm={{ title: 'Delete rows?' }} ariaLabel="Rows" />
    )
    // Delete should be disabled — stale 'a' is pruned
    expect(toolbarDel).toBeDisabled()

    // Now select Babbage and confirm delete — only 'b' should be passed, not phantom 'a'
    fireEvent.click(screen.getByText('Babbage').closest('[role="row"]')!)
    expect(toolbarDel).not.toBeDisabled()
    fireEvent.click(toolbarDel)
    const dialog = screen.getByRole('dialog')
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    )!
    fireEvent.click(confirmBtn)
    expect(onDelete).toHaveBeenCalledWith(['b'])
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
