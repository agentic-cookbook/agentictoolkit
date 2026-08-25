// Ecosystem-owner react-query glue for the Invitations topic. Same shapes as the
// platform-admin hooks (websites/main/admin/src/api/invitations.ts), but each hook
// takes the ecosystem's rdid, builds its URLs from ecosystemInvitationEndpoints(rdid)
// (everything under /api/auth/ecosystems/<rdid>/*), maps the byte-identical backend
// responses with the shared mappers, and namespaces its query keys by rdid so two
// ecosystems' caches never collide. No pane logic here — the panes are prop-driven.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedJson, authedRequest } from "../http";
import {
  toRequest,
  toPendingUser,
  toInvite,
  toAdminNote,
  toHistoryEntry,
  type InvitationRequest,
  type PendingUser,
  type Invite,
  type AdminNote,
  type HistoryEntry,
  type EntityKind,
  type BackendRequest,
  type BackendPendingUser,
  type BackendInvite,
  type BackendAdminNote,
  type BackendHistoryEntry,
} from "@agentic-toolkit/adh-ui/invitations-types";
import { ecosystemInvitationEndpoints } from "@agentic-toolkit/adh-ui/invitations-endpoints";

// ── Query keys (namespaced by ecosystem rdid) ───────────────────────────────────

const KEYS = {
  requests: (rdid: string) => ["eco-inv", rdid, "requests"] as const,
  pending: (rdid: string) => ["eco-inv", rdid, "pending"] as const,
  invites: (rdid: string) => ["eco-inv", rdid, "invites"] as const,
  notes: (rdid: string, subjectTable: string, subjectId: string) =>
    ["eco-inv", rdid, "notes", subjectTable, subjectId] as const,
  history: (rdid: string, subjectTable: string, subjectId: string) =>
    ["eco-inv", rdid, "history", subjectTable, subjectId] as const,
};

// ── List hooks ────────────────────────────────────────────────────────────────

export function useEcoInvitationRequests(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  return useQuery({
    queryKey: KEYS.requests(ecosystemRdid),
    queryFn: async (): Promise<InvitationRequest[]> => {
      const rows = await authedJson<BackendRequest[]>(E.requests);
      return rows.map(toRequest);
    },
  });
}

export function useEcoPendingUsers(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  return useQuery({
    queryKey: KEYS.pending(ecosystemRdid),
    queryFn: async (): Promise<PendingUser[]> => {
      const rows = await authedJson<BackendPendingUser[]>(E.pendingUsers);
      return rows.map(toPendingUser);
    },
  });
}

export function useEcoInvites(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  return useQuery({
    queryKey: KEYS.invites(ecosystemRdid),
    queryFn: async (): Promise<Invite[]> => {
      const rows = await authedJson<BackendInvite[]>(E.invitations);
      return rows.map(toInvite);
    },
  });
}

// ── Notes + history hooks ─────────────────────────────────────────────────────

export function useEcoRowNotes(ecosystemRdid: string, subjectTable: string, subjectId: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  return useQuery({
    queryKey: KEYS.notes(ecosystemRdid, subjectTable, subjectId),
    queryFn: async (): Promise<AdminNote[]> => {
      const rows = await authedJson<BackendAdminNote[]>(E.adminNotes(subjectTable, subjectId));
      return rows.map(toAdminNote);
    },
    enabled: !!subjectId,
  });
}

export function useEcoRowHistory(ecosystemRdid: string, subjectTable: string, subjectId: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  return useQuery({
    queryKey: KEYS.history(ecosystemRdid, subjectTable, subjectId),
    queryFn: async (): Promise<HistoryEntry[]> => {
      const rows = await authedJson<BackendHistoryEntry[]>(E.entityHistory(subjectTable, subjectId));
      return rows.map(toHistoryEntry);
    },
    enabled: !!subjectId,
  });
}

export function useEcoSaveNotes(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      subjectTable,
      subjectId,
      notes,
    }: {
      subjectTable: string;
      subjectId: string;
      notes: { id?: string; content: string }[];
    }) =>
      authedJson(E.adminNotesPut, {
        method: "PUT",
        body: JSON.stringify({
          subjectTable,
          subjectId,
          notes: notes.map((n) => ({ id: n.id, content: n.content })),
        }),
      }),
    onSuccess: (_data, { subjectTable, subjectId }) => {
      void qc.invalidateQueries({ queryKey: KEYS.notes(ecosystemRdid, subjectTable, subjectId) });
      void qc.invalidateQueries({ queryKey: KEYS.history(ecosystemRdid, subjectTable, subjectId) });
    },
  });
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

export function useEcoSendInvitations(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pendingUserIds,
      email,
      sms,
    }: {
      pendingUserIds: string[];
      email?: { note?: string };
      sms?: { note?: string };
    }) =>
      authedJson(E.invitations, {
        method: "POST",
        body: JSON.stringify({ pendingUserIds, email, sms }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.pending(ecosystemRdid) });
      void qc.invalidateQueries({ queryKey: KEYS.invites(ecosystemRdid) });
    },
  });
}

export function useEcoAddPendingUsers(ecosystemRdid: string) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (users: Array<{ name: string; email?: string; phone?: string; note?: string }>) =>
      authedJson(E.pendingUsers, {
        method: "POST",
        body: JSON.stringify({ users }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.pending(ecosystemRdid) });
    },
  });
}

/** Delete one row from a topic. kind = EntityKind mapped to the endpoint. */
export function useEcoDeleteRow(ecosystemRdid: string, kind: EntityKind) {
  const E = ecosystemInvitationEndpoints(ecosystemRdid);
  const qc = useQueryClient();
  const itemUrl =
    kind === "request"
      ? E.requestItem
      : kind === "pending"
        ? E.pendingUserItem
        : E.invitationItem;
  return useMutation({
    mutationFn: (id: string) =>
      authedRequest(itemUrl(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      if (kind === "request") void qc.invalidateQueries({ queryKey: KEYS.requests(ecosystemRdid) });
      else if (kind === "pending") void qc.invalidateQueries({ queryKey: KEYS.pending(ecosystemRdid) });
      else void qc.invalidateQueries({ queryKey: KEYS.invites(ecosystemRdid) });
    },
  });
}
