"use client"

import * as React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/dialog"
import { Textarea } from "../components/textarea"
import { Button } from "../components/button"
import { ListWithDetailsPane } from "./list-with-details-pane"
import type { DataTableColumn } from "../components/data-table"
import type { AdminNote } from "../lib/invitations-types"

const COLS: DataTableColumn<AdminNote>[] = [
  { key: "author", header: "Author" },
  { key: "addedDate", header: "Added" },
  { key: "modifiedDate", header: "Modified" },
]

/**
 * Prop-driven, staged Cancel/Save notes editor. Rendered as a controlled dialog.
 *
 * The caller passes the already-loaded `notes` (react-query lives in the app,
 * never here) plus an `onSave` callback. The component seeds a private working
 * copy from `notes` — the staged model — and re-seeds from the prop whenever it
 * is closed, so every open starts from what is actually loaded. While OPEN it
 * adopts a fresh `notes` only when the user has staged nothing; staged edits are
 * never clobbered (see the effect for that boundary). To reset mid-open when the
 * target subject changes, the caller passes a changing `key`
 * (e.g. `subjectTable:subjectId`) so React remounts it.
 *
 * Save → `onSave(working)`; the caller performs the mutation and closes (flips
 * `open`) on success. Cancel (or dialog-dismiss) → discard the staged working
 * copy back to the `notes` prop and `onClose`. Either way a consumer that keeps
 * this modal mounted (stable `key`) can't resurrect a stale working copy on the
 * next open — neither a cancelled edit nor a just-saved, now-superseded one.
 */
export function AdminNotesModal({
  open,
  onClose,
  author,
  notes,
  onSave,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  author: string
  notes: AdminNote[]
  onSave: (notes: { id?: string; content: string }[]) => void
  busy?: boolean
}): React.ReactElement {
  // Seeded from the loaded notes and re-seeded whenever the dialog is closed (staged model)
  // or a refetch lands on an unstaged open dialog (see the effect below).
  const [working, setWorking] = React.useState<AdminNote[]>(notes)
  // The `notes` value most recently SEEDED into `working`. It is the only honest baseline for
  // "has the user staged anything?": the incoming `notes` differs from `working` by definition
  // the moment a refetch lands, so comparing against that would read every refetch as a user edit.
  const seededNotes = React.useRef<AdminNote[]>(notes)
  // null = editor closed; a note-id string = editing that note; "" = new note.
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")

  const today = new Date().toISOString().slice(0, 10)
  const editorOpen = editingId !== null
  const editorTitle = editingId === "" ? "New note" : "Edit note"

  function openNewNote(): void {
    setDraft("")
    setEditingId("")
  }

  function openEditNote(note: AdminNote): void {
    setDraft(note.content)
    setEditingId(note.id)
  }

  function commitEditor(): void {
    const content = draft.trim()
    if (!content) return

    if (editingId === "") {
      // subjectTable/subjectId are stripped on save (only id+content are sent),
      // so a new working-copy note carries empty subject fields.
      const newNote: AdminNote = {
        id: `note-${Date.now()}`,
        content,
        author,
        addedDate: today,
        modifiedDate: today,
        subjectTable: "",
        subjectId: "",
      }
      setWorking((prev) => [...prev, newNote])
    } else {
      setWorking((prev) =>
        prev.map((n) => (n.id === editingId ? { ...n, content, modifiedDate: today } : n)),
      )
    }
    setEditingId(null)
    setDraft("")
  }

  function cancelEditor(): void {
    setEditingId(null)
    setDraft("")
  }

  function handleDelete(ids: string[]): void {
    const set = new Set(ids)
    setWorking((prev) => prev.filter((n) => !set.has(n.id)))
  }

  function handleSave(): void {
    onSave(working.map((n) => ({ id: n.id, content: n.content })))
  }

  // The outer Save button used to enable on ANY selection/mount regardless of whether
  // the working copy actually diverges from the loaded `notes` — clicking it with zero
  // edits staged would still fire `onSave([...])`. Compare structurally (order-sensitive,
  // matching how add/edit/delete mutate `working` in place) against the SAME `notes`
  // reference `close()` already treats as the reset baseline.
  const dirty = JSON.stringify(working) !== JSON.stringify(notes)

  // Drop the staged working copy back to the loaded `notes` and close any in-progress note editor.
  function resetWorking(): void {
    seededNotes.current = notes
    setWorking(notes)
    setEditingId(null)
    setDraft("")
  }

  // Re-seed whenever the dialog ends up CLOSED, whoever closed it — including the SAVE path, which
  // closes through the caller (its mutation's onSuccess flips `open`) and so never runs `close()`.
  // Without this, a saved-then-reopened modal that was never remounted (stable `key`) still holds
  // the pre-save working copy: its client-side note ids and dates can no longer match the refetched
  // `notes`, so `dirty` is stuck true, Save is permanently lit, and one click re-sends that stale
  // set — silently REVERTING whatever the refresh brought in.
  //
  // …and re-seed on the SAME grounds when a refetch lands while the dialog is OPEN and the user
  // has staged nothing. That is reachable on defaults (react-query's 30s staleTime +
  // refetchOnWindowFocus), and without it an untouched open dialog goes `dirty` with zero user
  // edits, lighting Save so one click PUTs the pre-refetch set over the newer one — the same
  // silent revert through a different door.
  //
  // SCOPE BOUNDARY — deliberate, do not "finish" this into a merge. When the user HAS staged
  // edits we keep them: clobbering typed work would be strictly worse. That leaves a genuine
  // concurrent-edit conflict — a note another admin added while this user was editing is dropped
  // by the save. That is PRE-EXISTING behaviour of this component and explicitly OUT OF SCOPE for
  // the save-gate work: it is a data-MERGE problem, not a save-gate problem, and a 3-way merge
  // here would be a large, unreviewed behaviour change. Fix it deliberately, on its own, or not
  // at all.
  React.useEffect(() => {
    if (!open) {
      resetWorking()
      return
    }
    // Structural, order-sensitive, and against the LAST SEEDED value — matching `dirty` below.
    if (JSON.stringify(working) === JSON.stringify(seededNotes.current)) resetWorking()
    // `resetWorking` is re-created every render, so depending on it would re-seed in a loop.
    // `working` is read but deliberately NOT a dep: this reacts to `notes` arriving, not to the
    // user's own staging (which must not re-trigger the adopt check).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notes])

  // Cancel/close discards the staged working copy back to the loaded `notes` and
  // clears any in-progress note editor, so reopening (without a remount) starts
  // clean even before the effect above sees `open` flip.
  function close(): void {
    resetWorking()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="text-apt-gold">Admin notes</DialogTitle></DialogHeader>
          <div className="h-[420px]">
            <ListWithDetailsPane<AdminNote>
              columns={COLS}
              rows={working}
              getRowId={(n) => n.id}
              renderDetail={(n) => (
                <div className="flex flex-col gap-3">
                  <div className="whitespace-pre-wrap text-sm text-apt-text">{n.content}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => openEditNote(n)}
                  >
                    Edit
                  </Button>
                </div>
              )}
              emptyDetail="Select a note to read it."
              emptyLabel="No admin notes yet."
              ariaLabel="Admin notes"
              actions={[{ id: "new", label: "New note", onClick: openNewNote }]}
              onDelete={handleDelete}
              deleteConfirm={{
                title: "Delete note?",
                description: "This removes the selected note. Click Save on the outer dialog to confirm.",
              }}
            />
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={busy || !dirty}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note editor sub-dialog (new or edit) */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o) cancelEditor() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-apt-gold">{editorTitle}</DialogTitle>
          </DialogHeader>
          <Textarea
            aria-label="Note content"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-32"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={cancelEditor}>Cancel</Button>
            <Button size="sm" disabled={draft.trim() === ""} onClick={commitEditor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
