/**
 * Unit tests for DialogActions' `confirmDisabled` prop.
 *
 * DialogActions has no built-in notion of "valid"/"dirty" — every consumer
 * computes that itself and must be able to express "visible but not clickable"
 * without falling back to `busy` (which hides both buttons behind a spinner
 * instead of disabling confirm). This prop is what several Save dialogs
 * (feature-flags, server-bags, provider templates) rely on to gate Save on a
 * dirty+valid check rather than leaving it always-enabled while idle.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DialogActions } from '../components/dialog-actions'

describe('DialogActions — confirmDisabled', () => {
  it('defaults to enabled when confirmDisabled is omitted (backward-compatible)', () => {
    render(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('disables the confirm button when confirmDisabled=true', () => {
    render(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('a disabled confirm button does not fire onConfirm when clicked', () => {
    const onConfirm = vi.fn()
    render(<DialogActions confirmLabel="Save" onConfirm={onConfirm} confirmDisabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('re-enables once confirmDisabled flips back to false', () => {
    const { rerender } = render(
      <DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    rerender(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled={false} />)
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('busy hides the buttons entirely regardless of confirmDisabled', () => {
    render(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled busy />)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('cancel button is unaffected by confirmDisabled', () => {
    render(
      <DialogActions
        cancelLabel="Cancel"
        onCancel={vi.fn()}
        confirmLabel="Save"
        onConfirm={vi.fn()}
        confirmDisabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
