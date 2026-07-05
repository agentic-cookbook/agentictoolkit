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
})
