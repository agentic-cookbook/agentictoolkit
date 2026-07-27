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

  // The branch convention is `canSave = dirty && valid` with the busy term applied HERE, at the
  // button — so mid-save `canSave` is still TRUE. Styling keyed off `canSave` alone therefore
  // painted the button gold/enabled while it was disabled and reading "Saving…". These pin the
  // three affordances (disabled, variant, muted class) to ONE term.
  describe('the Save button never looks enabled while it is disabled', () => {
    const saveButton = () => screen.getByRole('button', { name: /Sav/ }) as HTMLButtonElement

    it('renders MUTED while a save is in flight, even though canSave stays true', () => {
      render(<ButtonBar actions={{ ...base, canSave: true, saving: true }} />)
      const save = saveButton()
      expect(save.textContent).toContain('Saving…')
      expect(save.disabled).toBe(true)
      expect(save.className).toContain('text-apt-text-muted')
      // `variant="default"`'s signature — the gold/primary fill an ENABLED Save gets.
      expect(save.className).not.toContain('bg-primary')
    })

    it('renders MUTED when the draft is not savable', () => {
      render(<ButtonBar actions={{ ...base, canSave: false }} />)
      const save = saveButton()
      expect(save.disabled).toBe(true)
      expect(save.className).toContain('text-apt-text-muted')
      expect(save.className).not.toContain('bg-primary')
    })

    it('renders FILLED only when Save is actually clickable', () => {
      render(<ButtonBar actions={{ ...base, canSave: true }} />)
      const save = saveButton()
      expect(save.disabled).toBe(false)
      expect(save.className).toContain('bg-primary')
      expect(save.className).not.toContain('text-apt-text-muted')
    })
  })
})
