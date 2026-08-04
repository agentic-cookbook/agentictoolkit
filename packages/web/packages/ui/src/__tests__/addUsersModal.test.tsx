import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddUsersModal } from '../blocks/add-users-modal'

function fill(name: string, email = '', phone = '', note = '') {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  if (email) fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  if (phone) fireEvent.change(screen.getByLabelText('Phone'), { target: { value: phone } })
  if (note) fireEvent.change(screen.getByLabelText('Admin note'), { target: { value: note } })
}

describe('AddUsersModal', () => {
  it('Enter in an entry field appends a row and clears the entry', () => {
    render(<AddUsersModal open onAdd={vi.fn()} onClose={vi.fn()} />)
    fill('Ada', 'ada@x.io')
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    expect(screen.getByText('Ada')).toBeTruthy()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
  })
  it('a fully blank entry does not add a row', () => {
    render(<AddUsersModal open onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Add all users' })).toBeDisabled()
    expect(screen.getByText('No users added yet.')).toBeTruthy()
  })
  it('Enter on the entry Add button does not double-fire addRow', () => {
    render(<AddUsersModal open onAdd={vi.fn()} onClose={vi.fn()} />)
    fill('Bob')
    const addBtn = screen.getByRole('button', { name: 'Add user to list' })
    fireEvent.click(addBtn)
    fireEvent.keyDown(addBtn, { key: 'Enter' })
    expect(screen.getAllByText('Bob')).toHaveLength(1)
  })
  it('footer Add calls onAdd with the staged rows', () => {
    const onAdd = vi.fn()
    render(<AddUsersModal open onAdd={onAdd} onClose={vi.fn()} />)
    fill('Ada', 'ada@x.io'); fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Add all users' }))
    expect(onAdd).toHaveBeenCalledWith([{ name: 'Ada', email: 'ada@x.io', phone: '', note: '' }])
  })
  it('Cancel with staged rows opens a discard confirm', () => {
    const onClose = vi.fn()
    render(<AddUsersModal open onAdd={vi.fn()} onClose={onClose} />)
    fill('Ada', 'ada@x.io'); fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('the discard confirm is the platform alert: Stay aborts the cancel and keeps the rows', () => {
    const onClose = vi.fn()
    render(<AddUsersModal open onAdd={vi.fn()} onClose={onClose} />)
    fill('Ada', 'ada@x.io'); fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // "Stay", not the bespoke "Keep editing" this modal used to render — the wording now comes
    // from UnsavedChangesAlert, so this pins the shared prompt rather than a local literal.
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('ada@x.io')).toBeInTheDocument()
  })

  // The shared prompt asks about "unsaved changes", which names nothing a user staged here.
  // This modal knows what is at risk — the list — so it overrides the description sentence only.
  it('names the staged user list rather than generic unsaved changes', () => {
    render(<AddUsersModal open onAdd={vi.fn()} onClose={vi.fn()} />)
    fill('Ada', 'ada@x.io'); fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('The users you have added will be lost.')).toBeInTheDocument()
    expect(screen.queryByText('Your unsaved changes will be lost.')).toBeNull()
    // Title and buttons stay the platform's, not this modal's.
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
  })

  // The alert must be mounted INSIDE <DialogContent>, not as a sibling of the outer <Dialog>,
  // because the outer dialog is still open while the alert asks whether to close it — two
  // stacked base-ui modal Dialogs, one of which must be registered as the other's NESTED dialog
  // or base-ui's inerting can trap the user in a dialog they can neither dismiss nor confirm.
  //
  // In jsdom, `discard.closest('[aria-hidden="true"]')`/`closest('[inert]')` are NOT
  // discriminating: base-ui always keeps the most-recently-opened Dialog.Root interactive and
  // inerts the other regardless of React-tree placement (verified by rendering both the sibling
  // and the nested shape and diffing the DOM) — so they pass here even against the pre-fix
  // sibling placement, and are asserted only as a sanity floor, not proof.
  //
  // The actual proof is `data-nested-dialog-open`: base-ui's DialogPopup sets it on the OUTER
  // popup only when a descendant Dialog.Root registers itself as nested through the
  // DialogRootContext React (not DOM) tree — see @base-ui/react's
  // dialog/popup/DialogPopupDataAttributes.js and dialog/root/useDialogRoot.js. A
  // sibling-mounted alert is an unrelated, independent Dialog.Root that never reaches that
  // context, so the attribute stays absent even though the alert renders on top and looks fine.
  it('is registered as a NESTED dialog of the modal it gates, not an independent sibling', () => {
    render(<AddUsersModal open onAdd={vi.fn()} onClose={vi.fn()} />)
    fill('Ada', 'ada@x.io'); fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const discard = screen.getByRole('button', { name: 'Discard' })
    expect(discard.closest('[aria-hidden="true"]')).toBeNull()
    expect(discard.closest('[inert]')).toBeNull()

    const outerDialog = screen.getByText('Add users').closest('[role="dialog"]')
    expect(outerDialog).toHaveAttribute('data-nested-dialog-open')
  })
})
