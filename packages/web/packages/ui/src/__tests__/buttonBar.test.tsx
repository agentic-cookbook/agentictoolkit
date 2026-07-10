import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ButtonBar } from '../blocks/button-bar'

describe('ButtonBar editing actions', () => {
  const base = {
    onCancel: vi.fn(),
    canCancel: true,
    onSave: vi.fn(),
    canSave: true,
  }

  it('disables Delete while a save is in flight', () => {
    render(
      <ButtonBar
        actions={{ ...base, onCreate: vi.fn(), saving: true, onDelete: vi.fn(), canDelete: true }}
      />,
    )
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('omits the New button when onCreate is not supplied', () => {
    render(<ButtonBar actions={{ ...base, onDelete: vi.fn(), canDelete: true }} />)
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })
})
