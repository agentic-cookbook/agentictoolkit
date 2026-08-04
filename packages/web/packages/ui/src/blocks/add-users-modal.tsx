"use client"

import * as React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/dialog"
import { DataTable, type DataTableColumn } from "../components/data-table"
import { Input } from "../components/input"
import { UnsavedChangesAlert } from "../components/unsaved-changes-alert"
import { Button } from "../components/button"
import { Field } from "./field"

export interface DraftUser { name: string; email: string; phone: string; note: string }
export interface AddUsersModalProps {
  open: boolean
  onAdd: (users: DraftUser[]) => void
  onClose: () => void
  busy?: boolean
  title?: string
}

const COLS: DataTableColumn<DraftUser & { id: string }>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Phone" },
  { key: "note", header: "Admin note" },
]

const EMPTY_DRAFT: DraftUser = { name: "", email: "", phone: "", note: "" }

export function AddUsersModal({
  open,
  onAdd,
  onClose,
  busy = false,
  title = "Add users",
}: AddUsersModalProps): React.ReactElement {
  const [rows, setRows] = React.useState<(DraftUser & { id: string })[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [draft, setDraft] = React.useState<DraftUser>(EMPTY_DRAFT)
  const [confirming, setConfirming] = React.useState(false)
  const nameRef = React.useRef<HTMLInputElement>(null)

  const draftDirty =
    draft.name !== "" || draft.email !== "" || draft.phone !== "" || draft.note !== ""

  const setField =
    (k: keyof DraftUser) =>
    (e: React.ChangeEvent<HTMLInputElement>): void =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  function addRow(): void {
    if (!draft.name.trim() && !draft.email.trim() && !draft.phone.trim()) return
    setRows((r) => [...r, { ...draft, id: `${Date.now()}-${r.length}` }])
    setDraft(EMPTY_DRAFT)
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  function onEntryKey(e: React.KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault()
      addRow()
    }
  }

  function reset(): void {
    setRows([])
    setSelected(new Set())
    setDraft(EMPTY_DRAFT)
    setConfirming(false)
  }

  function close(): void {
    reset()
    onClose()
  }

  function requestCancel(): void {
    if (rows.length > 0 || draftDirty) {
      setConfirming(true)
    } else {
      close()
    }
  }

  function commit(): void {
    onAdd(rows.map(({ id: _id, ...u }) => u))
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestCancel() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-apt-gold">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <DataTable
            columns={COLS}
            rows={rows}
            getRowId={(r) => r.id}
            selectedIds={selected}
            onSelectionChange={setSelected}
            emptyLabel="No users added yet."
            ariaLabel="Staged users"
            className="max-h-56"
          />
          <div className="flex items-end gap-2"
            onKeyDown={(e) => { if ((e.target as HTMLElement).tagName === 'INPUT') onEntryKey(e) }}>
            <Field label="Name">
              <Input ref={nameRef} aria-label="Name" value={draft.name} onChange={setField("name")} />
            </Field>
            <Field label="Email">
              <Input aria-label="Email" type="email" value={draft.email} onChange={setField("email")} />
            </Field>
            <Field label="Phone">
              <Input aria-label="Phone" type="tel" value={draft.phone} onChange={setField("phone")} />
            </Field>
            <Field label="Admin note">
              <Input aria-label="Admin note" value={draft.note} onChange={setField("note")} />
            </Field>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={addRow} aria-label="Add user to list">
              Add
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={requestCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={rows.length === 0 || busy}
            onClick={commit}
            aria-label="Add all users"
          >
            Add
          </Button>
        </DialogFooter>
        <UnsavedChangesAlert
          open={confirming}
          description="The users you have added will be lost."
          onDiscard={close}
          onStay={() => setConfirming(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
