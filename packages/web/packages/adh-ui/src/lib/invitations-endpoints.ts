// Pure endpoint-path builders for the invitation resources. Each consumer picks
// the surface it is authorized for (platform-admin vs. ecosystem-owner) and feeds
// the resulting paths to its own react-query hooks. No fetching here — just paths.

export interface InvitationEndpoints {
  requests: string;
  requestItem: (id: string) => string;
  pendingUsers: string;
  pendingUserItem: (id: string) => string;
  invitations: string;
  invitationItem: (id: string) => string;
  adminNotes: (subjectTable: string, subjectId: string) => string;
  adminNotesPut: string;
  entityHistory: (subjectTable: string, subjectId: string) => string;
}
const enc = encodeURIComponent;

/** Platform-admin surface: /api/auth/* invitation resources + /api/system/* notes/history. */
export function adminInvitationEndpoints(): InvitationEndpoints {
  return {
    requests: '/api/auth/invitation-requests',
    requestItem: (id) => `/api/auth/invitation-requests/${enc(id)}`,
    pendingUsers: '/api/auth/pending-users',
    pendingUserItem: (id) => `/api/auth/pending-users/${enc(id)}`,
    invitations: '/api/auth/invitations',
    invitationItem: (id) => `/api/auth/invitations/${enc(id)}`,
    adminNotes: (t, i) => `/api/system/admin-notes?subjectTable=${enc(t)}&subjectId=${enc(i)}`,
    adminNotesPut: '/api/system/admin-notes',
    entityHistory: (t, i) => `/api/system/entity-history?subjectTable=${enc(t)}&subjectId=${enc(i)}`,
  };
}

/** Ecosystem-owner surface: everything under /api/auth/ecosystems/<rdid>/*. */
export function ecosystemInvitationEndpoints(ecosystemRdid: string): InvitationEndpoints {
  const base = `/api/auth/ecosystems/${enc(ecosystemRdid)}`;
  return {
    requests: `${base}/invitation-requests`,
    requestItem: (id) => `${base}/invitation-requests/${enc(id)}`,
    pendingUsers: `${base}/pending-users`,
    pendingUserItem: (id) => `${base}/pending-users/${enc(id)}`,
    invitations: `${base}/invitations`,
    invitationItem: (id) => `${base}/invitations/${enc(id)}`,
    adminNotes: (t, i) => `${base}/admin-notes?subjectTable=${enc(t)}&subjectId=${enc(i)}`,
    adminNotesPut: `${base}/admin-notes`,
    entityHistory: (t, i) => `${base}/entity-history?subjectTable=${enc(t)}&subjectId=${enc(i)}`,
  };
}
