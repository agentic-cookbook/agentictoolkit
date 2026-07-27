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

/** The full consumer round-trip: Save hands the staged notes to a stand-in "server" that assigns
 *  its own ids/dates (and reveals a note another admin added meanwhile), then closes the dialog on
 *  success — exactly what AdminNotesModal's wrappers do with `onSuccess: onClose`. */
function SaveHarness(): React.ReactElement {
  const [open, setOpen] = React.useState(true)
  const [notes, setNotes] = React.useState<AdminNote[]>(NOTES)
  return (
    <>
      <button onClick={() => setOpen(true)}>reopen</button>
      <AdminNotesModal
        open={open}
        onClose={() => setOpen(false)}
        author="tester"
        notes={notes}
        onSave={(staged) => {
          setNotes([
            ...staged.map((n, i) => ({
              id: `server-${i + 1}`,
              content: n.content,
              author: 'admin',
              addedDate: '2026-02-02',
              modifiedDate: '2026-02-02',
              subjectTable: 'invitation_requests',
              subjectId: 'r1',
            })),
            {
              id: 'server-concurrent',
              content: 'Added by another admin',
              author: 'someone-else',
              addedDate: '2026-02-02',
              modifiedDate: '2026-02-02',
              subjectTable: 'invitation_requests',
              subjectId: 'r1',
            },
          ])
          setOpen(false)
        }}
      />
    </>
  )
}

/** A note that arrives from a REFETCH while the dialog is open — react-query's 30s staleTime +
 *  refetchOnWindowFocus make that reachable on the admin app's defaults, and both wrappers pass
 *  `notes={notesQ.data}` straight through. Its author is distinct so the grid (Author / Added /
 *  Modified — the content lives in the detail pane) tells it apart from the seeded/staged rows. */
const CONCURRENT_NOTE: AdminNote = {
  id: 'n2',
  content: 'Added by another admin',
  author: 'someone-else',
  addedDate: '2026-03-03',
  modifiedDate: '2026-03-03',
  subjectTable: 'invitation_requests',
  subjectId: 'r1',
}

/** The dialog held OPEN with a given `notes` prop. Swapping that prop via `rerender` is a refetch
 *  landing mid-session — no close/reopen, no remount. (A trigger button rendered alongside would
 *  be unreachable: the open modal marks everything outside it inert.) */
function openWith(notes: AdminNote[]): React.ReactElement {
  return <AdminNotesModal open onClose={() => {}} author="tester" notes={notes} onSave={() => {}} />
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

  // The other way out of the dialog. SAVE closes through the CALLER (mutation onSuccess → onClose),
  // so it never runs the component's own `close()`. Without a re-seed on close, the working copy
  // that was just persisted outlives the refetch it caused: its client-side ids/dates can never
  // match the server-shaped rows again, so Save stays lit and one click re-sends the pre-refresh
  // set — wiping the note another admin added in between.
  it('adopts the refetched notes after a SAVE closes the still-mounted modal', async () => {
    render(<SaveHarness />)
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    const textarea = await screen.findByRole('textbox', { name: /note content/i })
    fireEvent.change(textarea, { target: { value: 'Staged addition' } })
    const editorDialog = textarea.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(editorDialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /note content/i })).toBeNull())

    fireEvent.click(outerSaveButton())
    await waitFor(() => expect(screen.queryByRole('grid', { name: /admin notes/i })).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /reopen/i }))
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    // The refetched set — the two saved notes AND the concurrent one — not the stale working copy.
    expect(dataRowCount()).toBe(3)
    expect(outerSaveButton()).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// The close-path re-seed above covers only a CLOSED dialog. A refetch landing
// while the dialog is OPEN reached the same silent revert through a different
// door: `working` stayed on the pre-refetch set, `dirty` flipped true with zero
// user edits, and one click PUT the stale set back over the newer one. The rule
// is asymmetric on purpose, so both halves are pinned here:
//   • nothing staged  → adopt the incoming notes (Save goes quiet, the new note shows)
//   • edits staged    → keep the user's work (never clobber typed input)
// ---------------------------------------------------------------------------
describe('AdminNotesModal — a refetch landing while the dialog is OPEN', () => {
  function outerSaveButton(): HTMLElement {
    const grid = screen.getByRole('grid', { name: /admin notes/i })
    const outerDialog = grid.closest('[role="dialog"]') as HTMLElement
    return within(outerDialog).getByRole('button', { name: /^save$/i })
  }

  it('is ADOPTED when the user has staged nothing — Save stays disabled and the new note shows', async () => {
    const { rerender } = render(openWith(NOTES))
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())
    expect(dataRowCount()).toBe(1)
    expect(outerSaveButton()).toBeDisabled()

    rerender(openWith([...NOTES, CONCURRENT_NOTE]))
    await waitFor(() => expect(dataRowCount()).toBe(2))

    // The note another admin added is visible…
    expect(screen.getByText('someone-else')).toBeInTheDocument()
    // …and Save is still grey: adopting a refetch is not a user edit.
    expect(outerSaveButton()).toBeDisabled()
  })

  it('does NOT clobber staged edits — the user’s work survives the refetch', async () => {
    const { rerender } = render(openWith(NOTES))
    await waitFor(() => expect(screen.getByRole('grid', { name: /admin notes/i })).toBeInTheDocument())

    // Stage a new note (author "tester", so the grid can tell it from the seeded row).
    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    const textarea = await screen.findByRole('textbox', { name: /note content/i })
    fireEvent.change(textarea, { target: { value: 'Staged addition' } })
    const editorDialog = textarea.closest('[role="dialog"]') as HTMLElement
    fireEvent.click(within(editorDialog).getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: /note content/i })).toBeNull())
    expect(dataRowCount()).toBe(2)

    rerender(openWith([...NOTES, CONCURRENT_NOTE]))

    // Still the staged set: the adopt path must not fire once anything is staged.
    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument())
    expect(dataRowCount()).toBe(2)
    expect(screen.queryByText('someone-else')).toBeNull()
    // Genuinely unsaved work, so Save is lit — and the concurrent note it would drop is the
    // documented, out-of-scope merge conflict, not a save-gate defect.
    expect(outerSaveButton()).not.toBeDisabled()
  })
})
