/** Unit test for the staged AdminNotesModal — pins the Cancel/close contract.
 *
 * The component seeds a private working copy from `notes` at mount and stages
 * add/edit/delete against it. The documented contract is that Cancel (and
 * dialog-dismiss) DISCARD the staged working copy. A consumer that keeps this
 * modal mounted (stable `key`) relies on that: without it, a cancelled edit
 * would survive and get destructively PUT on the next Save. This test keeps the
 * modal mounted across a close/reopen and asserts a staged note is gone. */
/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { AdminNotesModal } from '../blocks/admin-notes-modal'
import type { AdminNote } from '../lib/invitations-types'

const NOTES: AdminNote[] = [
  {
    id: 'n1',
    content: 'Existing note',
    author: 'admin',
    addedDate: '2026-01-01',
    modifiedDate: '2026-01-01',
    subjectTable: 'invitation_requests',
    subjectId: 'r1',
  },
]

/** Keeps the modal MOUNTED (stable key) and only toggles `open`, mirroring a
 *  consumer that reopens the same subject without a remount. */
function Harness({ notes }: { notes: AdminNote[] }): React.ReactElement {
  const [open, setOpen] = React.useState(true)
  return (
    <>
      <button onClick={() => setOpen(true)}>reopen</button>
      <AdminNotesModal open={open} onClose={() => setOpen(false)} author="tester" notes={notes} onSave={() => {}} />
    </>
  )
}

function dataRowCount(): number {
  const grid = screen.getByRole('grid', { name: /admin notes/i })
  return within(grid)
    .getAllByRole('row')
    .filter((r) => within(r).queryAllByRole('gridcell').length > 0).length
}

describe('AdminNotesModal — Cancel discards the staged working copy', () => {
  it('a note staged then cancelled is gone when the still-mounted modal reopens', async () => {
    render(<Harness notes={NOTES} />)

    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())
    expect(dataRowCount()).toBe(1)

    // Stage a new note via the editor sub-dialog.
    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    const textarea = await screen.findByRole('textbox', { name: /note content/i })
    fireEvent.change(textarea, { target: { value: 'Staged addition' } })
    const editorDialog = textarea.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(editorDialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /note content/i })).toBeNull())

    // The staged note is now in the working copy.
    expect(dataRowCount()).toBe(2)

    // Cancel the outer dialog → discard.
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('grid', { name: /admin notes/i })).toBeNull())

    // Reopen the SAME (never-remounted) modal.
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    // Cancel reset the working copy back to the notes prop — the staged note is gone.
    expect(dataRowCount()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// The outer Save button used to enable unconditionally (any mount, any
// selection) — it only checked `busy`, never whether the working copy had
// actually diverged from the loaded `notes`. Regression coverage for the
// dirty gate: disabled at mount, enabled once a note is staged, and disabled
// again after that staged edit is discarded.
// ---------------------------------------------------------------------------
describe('AdminNotesModal — outer Save button is dirty-gated', () => {
  function outerSaveButton(): HTMLElement {
    // Two "Save" buttons can coexist (the editor sub-dialog's), so scope to the
    // outer dialog's footer via the grid's ancestor dialog.
    const grid = screen.getByRole('grid', { name: /admin notes/i })
    const outerDialog = grid.closest('[role="dialog"]') as HTMLElement
    return within(outerDialog).getByRole('button', { name: /^save$/i })
  }

  it('is disabled at mount — nothing staged', async () => {
    render(<Harness notes={NOTES} />)
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())
    expect(outerSaveButton()).toBeDisabled()
  })

  it('becomes enabled once a note is staged, and calls onSave with the working copy', async () => {
    const onSave = vi.fn()
    render(<AdminNotesModal open onClose={() => {}} author="tester" notes={NOTES} onSave={onSave} />)
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())
    expect(outerSaveButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    const textarea = await screen.findByRole('textbox', { name: /note content/i })
    fireEvent.change(textarea, { target: { value: 'Staged addition' } })
    const editorDialog = textarea.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(editorDialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /note content/i })).toBeNull())

    expect(outerSaveButton()).not.toBeDisabled()
    fireEvent.click(outerSaveButton())
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: 'Staged addition' })]),
    )
  })

  it('goes back to disabled after Cancel discards the staged note (still-mounted modal)', async () => {
    render(<Harness notes={NOTES} />)
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    const textarea = await screen.findByRole('textbox', { name: /note content/i })
    fireEvent.change(textarea, { target: { value: 'Staged addition' } })
    const editorDialog = textarea.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(editorDialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /note content/i })).toBeNull())
    expect(outerSaveButton()).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('grid', { name: /admin notes/i })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    expect(outerSaveButton()).toBeDisabled()
  })
})
