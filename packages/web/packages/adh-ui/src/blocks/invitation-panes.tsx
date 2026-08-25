"use client"

import * as React from "react"

import { ListWithDetailsPane } from "@agenticdevelopertoolkit/ui/blocks/list-with-details-pane"
import { SendInvitationModal, type SendInvitationPayload } from "./send-invitation-modal"
import { AddUsersModal, type DraftUser } from "@agenticdevelopertoolkit/ui/blocks/add-users-modal"
import type { DataTableColumn } from "@agenticdevelopertoolkit/ui/components/data-table"
import {
  type InvitationRequest,
  type PendingUser,
  type Invite,
  TABLE_INVITATION_REQUESTS,
  TABLE_PENDING_USERS,
  TABLE_INVITATIONS,
} from "../lib/invitations-types"

/**
 * Render-props the panes use to inject each app's own (react-query-backed)
 * notes/history views — the shared blocks never fetch. `renderNotesAndHistory`
 * fills a row's detail panel; `renderNotesModal` supplies the staged notes editor
 * opened from the toolbar (the caller keys it by subject so it re-seeds).
 */
export interface NotesSlots {
  renderNotesAndHistory: (s: { subjectTable: string; subjectId: string }) => React.ReactNode
  renderNotesModal: (s: { subjectTable: string; subjectId: string; open: boolean; onClose: () => void }) => React.ReactNode
}

/**
 * `onSend` payload: the recipient/note selections from the send modal plus the
 * pending-user ids the invitation targets. The ids come from the rows that were
 * selected when Send was opened — the send mutation keys off them, so they must
 * flow to the caller alongside the modal's `SendInvitationPayload`.
 *
 * `onSend` returns the mutation's promise: the pane closes the send modal only
 * when it RESOLVES. On rejection the modal stays open (and Send re-enables via
 * `sendBusy` going false) so the failure is visible and the send retryable.
 */
export interface InvitationSendPayload extends SendInvitationPayload {
  pendingUserIds: string[]
}

// ── Column definitions (moved verbatim from the admin panes) ──────────────────

const REQUEST_COLS: DataTableColumn<InvitationRequest>[] = [
  { key: "userNumber", header: "User #", width: "6rem" },
  { key: "name", header: "Name" },
  { key: "phone", header: "Phone" },
  { key: "email", header: "Email" },
  { key: "requestedDate", header: "Requested", width: "9rem" },
]

const PENDING_COLS: DataTableColumn<PendingUser>[] = [
  { key: "name", header: "Name" },
  { key: "phone", header: "Phone" },
  { key: "email", header: "Email" },
  { key: "invitedCount", header: "Invited", width: "6rem", align: "end" },
  { key: "requestCount", header: "Requests", width: "6rem", align: "end" },
  { key: "lastRequestDate", header: "Last request", width: "9rem", render: (u) => u.lastRequestDate ?? "—" },
  { key: "lastInviteSentDate", header: "Last invite", width: "9rem", render: (u) => u.lastInviteSentDate ?? "—" },
  { key: "requestedDate", header: "Requested", width: "9rem" },
]

const INVITE_COLS: DataTableColumn<Invite>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "sentBy", header: "Sent by" },
  { key: "sentDate", header: "Sent", width: "9rem" },
]

const LOADING = <p className="text-sm text-apt-text-dim">Loading…</p>

// ── Invitation requests ───────────────────────────────────────────────────────

export function InvitationRequestsPane({
  rows,
  loading,
  onDelete,
  paramKey,
  renderNotesAndHistory,
  renderNotesModal,
}: {
  rows: InvitationRequest[]
  loading?: boolean
  onDelete: (ids: string[]) => void
  /** Optional URL search-param key for deep-linking the selected row (forwarded to ListWithDetailsPane). */
  paramKey?: string
} & NotesSlots): React.ReactElement {
  const [notesForId, setNotesForId] = React.useState<string | null>(null)
  const selectedRow = rows.find((r) => r.id === notesForId) ?? null

  if (loading) return LOADING

  return (
    <>
      <ListWithDetailsPane<InvitationRequest>
        columns={REQUEST_COLS}
        rows={rows}
        getRowId={(r) => r.id}
        ariaLabel="Invitation requests"
        emptyLabel="No invitation requests."
        storageKey="adm-inv-requests"
        paramKey={paramKey}
        onDelete={onDelete}
        deleteConfirm={{ title: "Delete requests?", description: "This removes the selected invitation requests." }}
        actions={[{ id: "notes", label: "Admin notes", requiresSelection: true, onClick: (ids) => setNotesForId(ids[0] ?? null) }]}
        renderDetail={(r) => (
          <div className="text-sm text-apt-text">
            <div><span className="text-apt-text-muted">Source:</span> {r.source}</div>
            <div className="mt-1"><span className="text-apt-text-muted">Note to the team:</span> {r.note || "—"}</div>
            {renderNotesAndHistory({ subjectTable: TABLE_INVITATION_REQUESTS, subjectId: r.id })}
          </div>
        )}
      />
      {renderNotesModal({
        subjectTable: TABLE_INVITATION_REQUESTS,
        subjectId: notesForId ?? "",
        open: selectedRow != null,
        onClose: () => setNotesForId(null),
      })}
    </>
  )
}

// ── Pending users ─────────────────────────────────────────────────────────────

export function InvitationPendingUsersPane({
  rows,
  loading,
  onDelete,
  onSend,
  onAdd,
  sendBusy,
  addBusy,
  paramKey,
  renderNotesAndHistory,
  renderNotesModal,
}: {
  rows: PendingUser[]
  loading?: boolean
  onDelete: (ids: string[]) => void
  onSend: (payload: InvitationSendPayload) => Promise<unknown>
  onAdd: (users: DraftUser[]) => void
  sendBusy?: boolean
  addBusy?: boolean
  /** Optional URL search-param key for deep-linking the selected row (forwarded to ListWithDetailsPane). */
  paramKey?: string
} & NotesSlots): React.ReactElement {
  const [notesForId, setNotesForId] = React.useState<string | null>(null)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [sendSeed, setSendSeed] = React.useState<{ emails: string[]; phones: string[]; ids: string[] }>({ emails: [], phones: [], ids: [] })
  const [addOpen, setAddOpen] = React.useState(false)

  const selectedNotesRow = rows.find((u) => u.id === notesForId) ?? null

  function openSend(ids: string[]): void {
    const selected = rows.filter((u) => ids.includes(u.id))
    setSendSeed({
      emails: selected.map((u) => u.email).filter(Boolean),
      phones: selected.map((u) => u.phone).filter(Boolean),
      ids,
    })
    setSendOpen(true)
  }

  if (loading) return LOADING

  return (
    <>
      <ListWithDetailsPane<PendingUser>
        columns={PENDING_COLS}
        rows={rows}
        getRowId={(u) => u.id}
        ariaLabel="Pending users"
        emptyLabel="No pending users."
        storageKey="adm-inv-pending"
        paramKey={paramKey}
        onDelete={onDelete}
        deleteConfirm={{ title: "Delete pending users?", description: "This removes the selected pending users." }}
        actions={[
          { id: "notes", label: "Admin notes", requiresSelection: true, onClick: (ids) => setNotesForId(ids[0] ?? null) },
          { id: "send", label: "Send invitation", requiresSelection: true, onClick: openSend },
          { id: "add", label: "Add users", dividerBefore: true, onClick: () => setAddOpen(true) },
        ]}
        renderDetail={(u) => (
          <div className="text-sm text-apt-text">
            <div><span className="text-apt-text-muted">Source:</span> {u.lastSource}</div>
            <div className="mt-1"><span className="text-apt-text-muted">Note from user:</span> {u.lastNote ?? "—"}</div>
            {renderNotesAndHistory({ subjectTable: TABLE_PENDING_USERS, subjectId: u.id })}
          </div>
        )}
      />

      {renderNotesModal({
        subjectTable: TABLE_PENDING_USERS,
        subjectId: notesForId ?? "",
        open: selectedNotesRow != null,
        onClose: () => setNotesForId(null),
      })}
      <SendInvitationModal
        key={`${sendSeed.emails.join()}|${sendSeed.phones.join()}`}
        open={sendOpen}
        emails={sendSeed.emails}
        phones={sendSeed.phones}
        busy={sendBusy}
        onSend={(payload) => {
          // Close only on SUCCESS; a rejected send keeps the modal open so the
          // failure is visible and the admin can retry.
          onSend({ ...payload, pendingUserIds: sendSeed.ids }).then(
            () => setSendOpen(false),
            () => undefined,
          )
        }}
        onClose={() => setSendOpen(false)}
      />
      <AddUsersModal
        open={addOpen}
        busy={addBusy}
        onAdd={onAdd}
        onClose={() => setAddOpen(false)}
      />
    </>
  )
}

// ── Sent invites ──────────────────────────────────────────────────────────────

export function InvitationInvitesPane({
  rows,
  loading,
  onDelete,
  paramKey,
  renderNotesAndHistory,
  renderNotesModal,
}: {
  rows: Invite[]
  loading?: boolean
  onDelete: (ids: string[]) => void
  /** Optional URL search-param key for deep-linking the selected row (forwarded to ListWithDetailsPane). */
  paramKey?: string
} & NotesSlots): React.ReactElement {
  const [notesForId, setNotesForId] = React.useState<string | null>(null)
  const selectedRow = rows.find((i) => i.id === notesForId) ?? null

  if (loading) return LOADING

  return (
    <>
      <ListWithDetailsPane<Invite>
        columns={INVITE_COLS}
        rows={rows}
        getRowId={(i) => i.id}
        ariaLabel="Sent invites"
        emptyLabel="No invites sent."
        storageKey="adm-inv-invites"
        paramKey={paramKey}
        onDelete={onDelete}
        deleteConfirm={{ title: "Delete invites?", description: "This removes the selected sent invites." }}
        actions={[{ id: "notes", label: "Admin notes", requiresSelection: true, onClick: (ids) => setNotesForId(ids[0] ?? null) }]}
        renderDetail={(i) => renderNotesAndHistory({ subjectTable: TABLE_INVITATIONS, subjectId: i.id })}
      />
      {renderNotesModal({
        subjectTable: TABLE_INVITATIONS,
        subjectId: notesForId ?? "",
        open: selectedRow != null,
        onClose: () => setNotesForId(null),
      })}
    </>
  )
}
