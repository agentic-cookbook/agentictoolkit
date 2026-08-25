// Prop-driven invitation panes are fed these frontend view types. They + their
// pure field mappers are shared so every consumer (admin, hub) maps the byte-
// identical backend response shapes the same way. No react-query, no fetching —
// purely types + transforms.

export interface AdminNote { id: string; content: string; author: string; addedDate: string; modifiedDate: string; subjectTable: string; subjectId: string }
export interface HistoryEntry { id: string; actor: string; action: string; timestamp: string }

export interface InvitationRequest {
  id: string; userNumber: number; name: string; phone: string; email: string;
  requestedDate: string; source: string; note: string;
}
export interface PendingUser {
  id: string; name: string; phone: string; email: string;
  invitedCount: number; requestCount: number;
  lastRequestDate: string | null; lastInviteSentDate: string | null; requestedDate: string;
  lastSource: string; lastNote: string | null;
}
export interface Invite {
  id: string; name: string; email: string; sentBy: string; sentDate: string;
}
export type EntityKind = "request" | "pending" | "invite";

// Stable table-name constants that mirror the Phase-3 schema.
export const TABLE_INVITATION_REQUESTS = "invitation_requests" as const;
export const TABLE_PENDING_USERS = "pending_users" as const;
export const TABLE_INVITATIONS = "invitations" as const;

// ── Backend response shapes ───────────────────────────────────────────────────
// Field names match what the backend returns; the mappers below map them to the
// frontend types (requestedDate = createdAt, lastRequestDate = lastRequestAt, etc.).

export interface BackendRequest {
  id: string;
  pendingUserId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  note: string | null;
  createdAt: string;
  userNumber: number | null;
}

export interface BackendPendingUser {
  id: string;
  userNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  invitedCount: number;
  requestCount: number;
  lastRequestAt: string | null;
  lastInviteSentAt: string | null;
  firstRequestedAt: string;
  lastSource: string | null;
  lastNote: string | null;
  status: string;
}

export interface BackendInvite {
  id: string;
  name: string;
  channel: string;
  destination: string;
  sentBy: string;
  sentAt: string;
  status: string;
}

export interface BackendAdminNote {
  id: string;
  content: string;
  createdBy: string;
  subjectTable: string;
  subjectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendHistoryEntry {
  id: string;
  actorLabel: string | null;
  actorId: string | null;
  action: string;
  createdAt: string;
}

// ── Field mapping helpers ─────────────────────────────────────────────────────

export function toRequest(r: BackendRequest): InvitationRequest {
  return {
    id: r.id,
    userNumber: r.userNumber ?? 0,
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    requestedDate: r.createdAt.slice(0, 10),
    source: r.source ?? "",
    note: r.note ?? "",
  };
}

export function toPendingUser(u: BackendPendingUser): PendingUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? "",
    phone: u.phone ?? "",
    invitedCount: u.invitedCount,
    requestCount: u.requestCount,
    lastRequestDate: u.lastRequestAt ? u.lastRequestAt.slice(0, 10) : null,
    lastInviteSentDate: u.lastInviteSentAt ? u.lastInviteSentAt.slice(0, 10) : null,
    requestedDate: u.firstRequestedAt.slice(0, 10),
    lastSource: u.lastSource ?? "",
    lastNote: u.lastNote,
  };
}

export function toInvite(i: BackendInvite): Invite {
  return {
    id: i.id,
    name: i.name,
    // The invitations table stores destination (email or phone); use it as email.
    email: i.destination,
    sentBy: i.sentBy,
    sentDate: i.sentAt.slice(0, 10),
  };
}

export function toAdminNote(n: BackendAdminNote): AdminNote {
  return {
    id: n.id,
    content: n.content,
    author: n.createdBy,
    addedDate: n.createdAt.slice(0, 10),
    modifiedDate: n.updatedAt.slice(0, 10),
    subjectTable: n.subjectTable,
    subjectId: n.subjectId,
  };
}

export function toHistoryEntry(h: BackendHistoryEntry): HistoryEntry {
  return {
    id: h.id,
    actor: h.actorLabel ?? h.actorId ?? "system",
    action: h.action,
    timestamp: h.createdAt.slice(0, 10),
  };
}
