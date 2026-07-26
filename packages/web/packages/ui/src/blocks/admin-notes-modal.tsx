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
 * copy from `notes` AT MOUNT and never re-syncs while open — the staged model. To
 * reset the working copy when the target subject changes, the caller passes a
 * changing `key` (e.g. `subjectTable:subjectId`) so React remounts this component.
 *
 * Save → `onSave(working)`; the caller performs the mutation and closes (flips
 * `open`) on success. Cancel (or dialog-dismiss) → discard the staged working
 * copy back to the `notes` prop and `onClose`, so a consumer that keeps this
 * modal mounted (stable `key`) can't resurrect a cancelled edit on the next open.
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
  // Seeded at mount from the loaded notes; Cancel/close resets back to it (staged model).
  const [working, setWorking] = React.useState<AdminNote[]>(notes)
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

  // Cancel/close discards the staged working copy back to the loaded `notes` and
  // clears any in-progress note editor, so reopening (without a remount) starts
  // clean. Save does NOT call this — the caller closes on mutation success.
  function close(): void {
    setWorking(notes)
    setEditingId(null)
    setDraft("")
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
