// Self-serve account API — moved from adh's hub
// (frontend/src/sites/hub/src/api/account.ts). Per-category notification
// preferences (/notifications/preferences) and contact-method management with
// verification (/account/contacts). Backs the Notifications workspace and the
// Profile/Contact-info panels.
//
// Request/response shapes below are TRANSCRIBED from the backend rather than
// imported from `@agentic-toolkit/adh-api-types`, unlike hub's original (which typed
// them as `SuccessBody<'/notifications/preferences', 'get'>` etc). That package's
// name starts with `@agentic-toolkit/adh`, which `scripts/check_boundaries.py`'s
// `_is_vocabulary` check classifies as the adh VOCABULARY tier — this package is
// MECHANISM tier (see package.json's `comment:tier`) and may never import it. See
// `./auth.ts`'s header for the fuller rationale and the guard evidence.
//
// Fields copied verbatim from `packages/adh-api-types/src/schema.ts` as of this
// move: `components.schemas.NotificationPreference`, the `/notifications/preferences`
// PUT request body, and `components.schemas.ContactMethod`. Unlike the generated
// SuccessBody/RequestBody helpers, these do NOT auto-track a backend schema change.
import { authedJson, authedRequest } from "@agentic-toolkit/auth/client";

/** The notification categories the backend recognizes (schema.ts `NotificationPreference.category`). */
type NotificationCategory =
  | "account"
  | "community_reply"
  | "community_mention"
  | "admin_announcement"
  | "direct_message"
  | "project_assigned"
  | "project_mention"
  | "project_comment"
  | "project_status"
  | "project_due";

export interface NotificationPref {
  category: NotificationCategory;
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

// What a SAVE carries, taken from the request body rather than reused from the response. The two
// are structurally identical today, which is exactly why naming them separately is worth a line:
// the PUT is a whole-row replace, so the day the server starts maintaining a field it will not
// accept back — or accepts one it never returns — the two shapes part company, and a caller typed
// on the response would go on compiling while sending the wrong body.
export interface NotificationPrefInput {
  category: NotificationCategory;
  email: boolean;
  sms: boolean;
  /** In-app (inbox) delivery for this category. Omitted means true — the PUT replaces the row wholesale, so a client that edits only email/sms must send back the value it read. */
  inApp?: boolean;
}

export interface ContactMethod {
  id: string;
  type: "email" | "phone";
  value: string;
  verified: boolean;
  isPrimary: boolean;
  createdAt?: string;
}

export interface AddContactBody {
  type: "email" | "phone";
  value: string;
}

export async function listPreferences(): Promise<NotificationPref[]> {
  const res = await authedJson<{ preferences: NotificationPref[] }>(
    "/api/notifications/preferences",
  );
  return res.preferences;
}

export async function savePreferences(
  preferences: NotificationPrefInput[],
): Promise<NotificationPref[]> {
  const res = await authedJson<{ preferences: NotificationPref[] }>(
    "/api/notifications/preferences",
    { method: "PUT", body: JSON.stringify({ preferences }) },
  );
  return res.preferences;
}

export async function listContacts(): Promise<ContactMethod[]> {
  const res = await authedJson<{ items: ContactMethod[] }>("/api/account/contacts");
  return res.items;
}

export async function addContact(body: AddContactBody): Promise<void> {
  await authedJson("/api/account/contacts", { method: "POST", body: JSON.stringify(body) });
}

export async function deleteContact(id: string): Promise<void> {
  // 204 No Content — authedRequest, not authedJson (nothing to parse).
  await authedRequest(`/api/account/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function startContactVerification(id: string): Promise<void> {
  await authedJson(`/api/account/contacts/${encodeURIComponent(id)}/verify/start`, {
    method: "POST",
  });
}

export async function confirmContactVerification(id: string, code: string): Promise<void> {
  await authedJson(`/api/account/contacts/${encodeURIComponent(id)}/verify/confirm`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
