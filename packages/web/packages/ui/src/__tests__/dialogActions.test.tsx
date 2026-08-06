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

/**
 * The focus ring on a cancel button we focused ourselves.
 *
 * `initialFocus="cancel"` (which `destructive` forces) lands focus on Cancel as the
 * dialog mounts, so its ring is painted before the user has chosen anything. Button's
 * ring is `--ring` = the theme's accent, and three of the 39 themes make that accent a
 * red — which would put the alarm colour on the button that does NOTHING, beside a
 * confirm that is red because it destroys work.
 *
 * jsdom resolves no cascade, so the assertion is on the class the button carries, not
 * on a computed colour. That is the whole surface of the fix: the ring utilities are
 * the only colour-bearing classes on this button that a theme can turn red.
 */
describe('DialogActions — the cancel button we autofocus', () => {
  const RING = 'focus-visible:ring-apt-text/40'
  const BORDER = 'focus-visible:border-apt-text'

  it('overrides the accent ring when it is the button taking initial focus', () => {
    render(
      <DialogActions
        cancelLabel="Stay"
        onCancel={vi.fn()}
        confirmLabel="Discard"
        onConfirm={vi.fn()}
        destructive
      />,
    )
    const stay = screen.getByRole('button', { name: 'Stay' })
    expect(document.activeElement).toBe(stay)
    expect(stay.className).toContain(RING)
    expect(stay.className).toContain(BORDER)
    // tailwind-merge keeps the last of a conflicting pair; the accent ring must be GONE
    // from the class list, not merely losing to source order in the cascade.
    expect(stay.className).not.toContain('ring-ring/50')
    expect(stay.className).not.toContain('focus-visible:border-ring')
  })

  it('leaves the accent ring alone on a cancel button that is NOT autofocused', () => {
    // Confirm takes focus here, so Cancel only ever rings because the user tabbed to it —
    // the case the accent ring is for.
    render(
      <DialogActions
        cancelLabel="Cancel"
        onCancel={vi.fn()}
        confirmLabel="Save"
        onConfirm={vi.fn()}
      />,
    )
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel.className).toContain('ring-ring/50')
    expect(cancel.className).not.toContain(RING)
  })

  it('never moves the confirm button off the destructive ring', () => {
    // Discard is the one thing in the dialog that SHOULD read as danger.
    render(
      <DialogActions
        cancelLabel="Stay"
        onCancel={vi.fn()}
        confirmLabel="Discard"
        onConfirm={vi.fn()}
        destructive
      />,
    )
    const discard = screen.getByRole('button', { name: 'Discard' })
    expect(discard.className).toContain('text-destructive')
    expect(discard.className).toContain('focus-visible:ring-destructive/40')
    expect(discard.className).not.toContain(RING)
  })
})
