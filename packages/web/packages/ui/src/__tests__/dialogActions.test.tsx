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

/**
 * `confirmDisabled` × `focusOnMount` used to be a focus hole: `focus()` on a disabled button is a
 * silent no-op with no fallback, so the dialog opened with focus still on `<body>` — no focus trap,
 * Tab walking the page behind the dialog, Escape possibly never reaching the handler. With
 * `focusOnMount` defaulting to true, `initialFocus` defaulting to "confirm", and dirty-gating
 * meaning Save now STARTS disabled, that is the ordinary combination rather than an exotic one.
 */
describe('DialogActions — initial focus with a disabled preferred target', () => {
  it('focuses confirm on mount when it is enabled', () => {
    render(
      <DialogActions cancelLabel="Cancel" onCancel={vi.fn()} confirmLabel="Save" onConfirm={vi.fn()} />,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }))
  })

  it('falls back to Cancel when the preferred confirm is disabled', () => {
    render(
      <DialogActions
        cancelLabel="Cancel"
        onCancel={vi.fn()}
        confirmLabel="Save"
        onConfirm={vi.fn()}
        confirmDisabled
      />,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('falls back to confirm when the preferred cancel is missing (destructive default)', () => {
    // `destructive` flips the default initialFocus to "cancel"; with no cancel button rendered
    // there is nothing to prefer, so the confirm has to take it.
    render(<DialogActions confirmLabel="Delete" onConfirm={vi.fn()} destructive />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' }))
  })

  it('leaves focus alone when no button can take it', () => {
    render(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled />)
    expect(document.activeElement).toBe(document.body)
  })

  it('does not steal focus later when the gate flips open', () => {
    const { rerender } = render(
      <DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled />,
    )
    rerender(<DialogActions confirmLabel="Save" onConfirm={vi.fn()} confirmDisabled={false} />)
    // The focus effect is mount-only on purpose — re-running it would yank focus out of whatever
    // field the user was typing in at the moment their edit made the form savable.
    expect(document.activeElement).toBe(document.body)
  })
})
