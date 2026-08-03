/**
 * CreateResourceDialog's unsaved-work guard: what the "New …" modal does when Cancel/×/Esc
 * meets a dirty draft. This is the THIRD hand-rolled copy of the old 3-button Save/Discard/
 * Keep-editing prompt (after HTDV and HMDV) — it must raise the platform's shared, 2-button
 * Discard/Stay alert instead, and the alert must never save.
 *
 * The dialog's own footer keeps a real `Save` button, so the "no Save inside the alert"
 * assertion is scoped to the alert's own dialog element with `within(...)`, not the document.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CreateResourceDialog } from '../blocks/create-resource-dialog'

interface Draft {
  text: string
}

/** Renders the dialog with a single text field as its draft, so typing into it is what makes
 *  the draft dirty. Returns the spies the tests assert on. */
function renderDialog() {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const create = vi.fn(async () => ({ id: '1' }))
  render(
    <CreateResourceDialog<Draft, { id: string }>
      ariaLabel="New Thing"
      heading="New Thing"
      blank={() => ({ text: '' })}
      validate={(d) => (d.text.trim() ? null : 'Required')}
      create={create}
      onClose={onClose}
      onCreated={onCreated}
      renderForm={(draft, onChange) => (
        <input
          aria-label="Text"
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
    />,
  )
  return { onClose, onCreated, create }
}

function makeDirty(): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
    target: { value: 'a draft' },
  })
}

function clickCancel(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
}

/** The alert's own dialog element, found via one of its buttons and walked up to its
 *  containing `role="dialog"` — both the outer form dialog and the alert portal straight to
 *  `document.body`, so this is DOM ancestry, not React-tree nesting. */
function alertWithin() {
  const discard = screen.getByRole('button', { name: 'Discard' })
  const dialog = discard.closest('[role="dialog"]')
  if (!dialog) throw new Error('Discard button is not inside a dialog')
  return within(dialog as HTMLElement)
}

describe('CreateResourceDialog — exit guard', () => {
  it('closes immediately on Cancel when pristine — no alert raised', () => {
    const { onClose } = renderDialog()
    clickCancel()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  it('raises the alert on Cancel when dirty, and holds the close', () => {
    const { onClose } = renderDialog()
    makeDirty()
    clickCancel()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('the alert has exactly two buttons — Discard and Stay — and no Save', () => {
    renderDialog()
    makeDirty()
    clickCancel()
    const alert = alertWithin()
    expect(alert.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(alert.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
    expect(alert.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('Discard closes the dialog and never calls create', () => {
    const { onClose, create } = renderDialog()
    makeDirty()
    clickCancel()
    fireEvent.click(alertWithin().getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })

  it('Stay dismisses the alert and leaves the dialog open with the draft intact', () => {
    const { onClose } = renderDialog()
    makeDirty()
    clickCancel()
    fireEvent.click(alertWithin().getByRole('button', { name: 'Stay' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('a draft')
  })
})
