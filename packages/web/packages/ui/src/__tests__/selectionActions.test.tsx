import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SelectionActions } from '../blocks/selection-actions'

// The strip on its own — the way a table with no details pane uses it. The
// ListWithDetailsPane tests cover it in place; these cover the parts only a direct
// consumer reaches (no onDelete at all, an action that stands without a selection).

describe('SelectionActions', () => {
  it('renders no Delete at all when nothing can be deleted', () => {
    render(<SelectionActions selectedIds={['a']} actions={[]} />)
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
  })

  it('leaves an action without requiresSelection enabled on an empty selection', () => {
    const onClick = vi.fn()
    render(<SelectionActions selectedIds={[]} actions={[{ id: 'new', label: 'New…', onClick }]} />)
    const btn = screen.getByRole('button', { name: 'New…' })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledWith([])
  })

  it('hands the action the exact selected ids', () => {
    const onClick = vi.fn()
    render(
      <SelectionActions
        selectedIds={['a', 'c']}
        actions={[{ id: 'edit', label: 'Update…', onClick, requiresSelection: true }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Update…' }))
    expect(onClick).toHaveBeenCalledWith(['a', 'c'])
  })

  it('marks a dividerBefore as a real toolbar separator', () => {
    render(
      <SelectionActions
        selectedIds={['a']}
        actions={[
          { id: 'one', label: 'One', onClick: vi.fn() },
          { id: 'two', label: 'Two', onClick: vi.fn(), dividerBefore: true },
        ]}
      />,
    )
    const sep = screen.getByRole('separator')
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('confirms before deleting, and passes the ids only on confirm', () => {
    const onDelete = vi.fn()
    render(
      <SelectionActions
        selectedIds={['a', 'b']}
        onDelete={onDelete}
        deleteConfirm={{ title: 'Delete rows?', description: 'Sub-items survive.' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    expect(onDelete).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    expect(screen.getByText('Delete rows?')).toBeTruthy()
    expect(screen.getByText('Sub-items survive.')).toBeTruthy()

    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete',
    )
    fireEvent.click(confirm!)
    expect(onDelete).toHaveBeenCalledWith(['a', 'b'])
    // The modal closes with the confirmation, so a second Delete needs a second decision.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not delete when the confirmation is cancelled', () => {
    const onDelete = vi.fn()
    render(
      <SelectionActions selectedIds={['a']} onDelete={onDelete} deleteConfirm={{ title: 'Delete rows?' }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
