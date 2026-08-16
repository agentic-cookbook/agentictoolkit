// Persona/services/me API client — the hand-written /auth/me, /auth/slug-available,
// /public/* profile, and /persona/provider-templates routes, plus generic CRUD over
// `persona.services` and `persona.personas`.
//
// Routes: /api/auth/me (get/patch), /api/auth/slug-available/{slug},
//         /api/public/users/{slug}, /api/public/personas/{slug},
//         /api/public/users/{ownerSlug}/personas/{personaSlug},
//         /api/persona/provider-templates,
//         /api/persona/services (list/create), /api/persona/services/{id}
//         (patch/delete/connect/models/models/refresh),
//         /api/persona/personas (list/create), /api/persona/personas/{id}
//         (update/delete).
import { authedJson, authedRequest } from "../http";
import { workspaceQuery } from "../client-helpers";
import type {
  MeRow,
  MePatchBody,
  PublicUserRow,
  ServiceTemplateRow,
  ServiceRow,
  PersonaRow,
  PublicPersonaRow,
  ConnectionSpec,
  CannedChatConfig,
} from "./wire";
import type { ChatStatusConfig } from "./chat-status";

// The backend returns the /me payload UNWRAPPED (no `{ data }` envelope): GET and
// PATCH both respond with the user object directly.
function meRequest(): Promise<MeResponse> {
  return authedJson<MeResponse>("/api/auth/me");
}

function patchMe(body: MePatchBody): Promise<MeResponse> {
  return authedJson<MeResponse>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type SlugAvailability =
  | { available: true }
  | { available: false; reason: "format" | "reserved" | "taken" };

function slugAvailable(slug: string): Promise<SlugAvailability> {
  return authedJson<SlugAvailability>(
    `/api/auth/slug-available/${encodeURIComponent(slug)}`,
  );
}

export const api = {
  me: meRequest,
  patchMe,
  slugAvailable,
  publicUser: (slug: string) =>
    authedJson<PublicUser>(`/api/public/users/${encodeURIComponent(slug)}`),
  publicPersonaByOwner: (ownerSlug: string, personaSlug: string) =>
    authedJson<PublicPersona>(
      `/api/public/users/${encodeURIComponent(ownerSlug)}/personas/${encodeURIComponent(personaSlug)}`,
    ),
  // Sign-out is the shared AuthProvider's `logout()` (revoke + clear the local
  // Bearer tokens), not an api.ts call — see src/App.tsx.
  // Provider templates are the GLOBAL provider catalog, served by the hand-written
  // /persona/provider-templates route: paginated ({ items, total, page, pageSize }), with
  // connectionSpec.extraHeaders REDACTED and operator-only `syncKeys` stripped. Fetch one
  // max-size page (MAX_PAGE_SIZE is 100; the catalog is well under that) and return the items.
  templates: () =>
    authedJson<{ items: Template[] }>(
      "/api/persona/provider-templates?pageSize=100",
    ).then((r) => r.items),
  services: {
    list: () => authedJson<UserService[]>("/api/persona/services"),
    create: (body: CreateServiceBody) =>
      authedJson<UserService>("/api/persona/services", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    patch: (id: string, body: PatchServiceBody) =>
      authedJson<UserService>(`/api/persona/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      authedRequest(`/api/persona/services/${id}`, { method: "DELETE" }),
    connect: (id: string) =>
      authedJson<UserService>(`/api/persona/services/${id}/connect`, { method: "POST" }),
    models: (id: string) =>
      authedJson<ModelInfo[]>(`/api/persona/services/${id}/models`),
    refreshModels: (id: string) =>
      authedJson<UserService>(`/api/persona/services/${id}/models/refresh`, {
        method: "POST",
      }),
  },
  personas: {
    // `workspace` scopes EVERY op to the WORKSPACE'S owning principal (backend
    // `?workspace=<slug>`): list returns only personas that principal OWNS (owner_kind +
    // owner_id — never the caller-reachable set), create stamps that principal as the
    // owner (so an org workspace's new persona is org-owned), and item update/delete
    // swap the non-creator pin for the same ownership scope — so any org member can
    // edit rows other members created for the org. Omit for the caller's own
    // creator-scoped rows (the pre-workspace behavior).
    list: (opts?: { workspace?: string }) =>
      authedJson<Persona[]>(`/api/persona/personas${workspaceQuery(opts)}`),
    create: (body: PersonaBody, opts?: { workspace?: string }) =>
      authedJson<Persona>(`/api/persona/personas${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    // Persona rdids are DERIVED — `persona.<owner-address>.<slug>`, where the owner segment is
    // itself an rdid (`org.<slug>` or `user.<eco-path>.<slug>`) and NOT a bare workspace slug; the
    // slug is the only user-editable segment (the leaf). The address is derived from the stored
    // slug, and this body always carries `slug`, so the PUT IS the rename: CRUD sees the address
    // move and cascades the new address onto the handle and every descendant. Mirrors
    // ecosystemsApi.update(), including what was removed from it — the follow-up
    // `identifiersApi.rename` was a SECOND rename of a handle the cascade had already moved, from
    // an old rdid that is now a superseded alias onto a new one the row itself already holds, and
    // that target is taken (23505 -> 409). It reported a rename that had in fact succeeded as a
    // failure. The 404-recovery branch went with it: it existed because two calls could half-land,
    // and one call has no such window.
    update: (id: string, body: PersonaBody, opts?: { workspace?: string }): Promise<Persona> =>
      // The echoed row carries the address the server DERIVED, which is the authority — callers
      // (PersonasSection) still detect the rename via the id change, now from the server's answer
      // rather than a client-side guess at what it would be.
      authedJson<Persona>(`/api/persona/personas/${id}${workspaceQuery(opts)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string, opts?: { workspace?: string }) =>
      authedRequest(`/api/persona/personas/${id}${workspaceQuery(opts)}`, { method: "DELETE" }),
    // Owner-scoped slug lookup. Generic CRUD's list is already confined to the
    // caller's own rows (ecosystem_id + user_id) and supports an equality filter via
    // `?slug=`, so the first match IS the caller's persona with that slug. There is
    // no dedicated by-slug route; a miss is a 404 to mirror the old endpoint.
    bySlugAsOwner: async (slug: string) => {
      const rows = await authedJson<Persona[]>(
        `/api/persona/personas?slug=${encodeURIComponent(slug)}`,
      );
      const row = rows[0];
      if (!row) throw new Error("404 Not Found");
      return row;
    },
  },
  publicPersona: (slug: string) =>
    authedJson<PublicPersona>(`/api/public/personas/${encodeURIComponent(slug)}`),
};

// The authenticated developer, exactly as the backend /auth/me payload returns it
// (`userPayload`): the customer.customers identity + effective capabilities. There is
// no separate `githubLogin` anymore — GitHub is just one auth method behind the
// shared OAuth flow, not a field on the profile.
export type MeResponse = MeRow;
export type PublicUser = PublicUserRow;
export type Template = ServiceTemplateRow;
export type Modality = "text" | "image" | "audio" | "video" | "embedding";
export type ModelInfo = {
  id: string;
  displayName?: string;
  family?: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputUsdPerMTokens?: number;
  outputUsdPerMTokens?: number;
  inputModalities?: Modality[];
  outputModalities?: Modality[];
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsThinking?: boolean;
};
// Spec-typed, but keep the rich `models` typing: the backend column is jsonb so the
// spec documents PersonaServiceModel loosely (string | object); the registry UI needs
// the structured ModelInfo, so override just that field.
export type UserService = Omit<ServiceRow, "models"> & { models: ModelInfo[] };
// Re-exported so connect-form UIs can read a template's transport/auth spec
// (url-var placeholders, auth kind) without reaching into ./wire directly.
export type {
  ConnectionSpec,
  ConnectionSpecAuth,
  ConnectionSpecUrlVar,
  ConnectionSpecHeaderVar,
} from "./wire";
// Re-exported so the editor's demo facet can type its draft state without reaching
// into ./wire directly.
export type {
  CannedChatConfig,
  CannedPacing,
  CannedScript,
  CannedSeeded,
} from "./wire";
export {
  CHAT_STATUS_DEFAULT,
  CHAT_STATUS_KINDS,
  CHAT_STATUS_WORD_PRESETS,
  CHAT_STATUS_ICON_PRESETS,
  chatStatusBlank,
  parseChatStatus,
  resolveChatStatus,
} from "./chat-status";
export type {
  ChatStatusConfig,
  ChatStatusKind,
  ResolvedChatStatus,
  StatusIconSet,
  StatusTint,
  StatusWordPair,
} from "./chat-status";
export type CreateServiceBody = {
  templateId?: string;
  name: string;
  providerKind: UserService["providerKind"];
  baseUrl: string;
  apiKey?: string;
  // Usually omitted: when templateId is set the backend copies the template's
  // spec onto the connection. Supply it only to override or for a template-less
  // connection. The UI has already substituted url vars into baseUrl.
  connectionSpec?: ConnectionSpec | null;
};
export type PatchServiceBody = {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  connectionSpec?: ConnectionSpec | null;
};
// The persona row exactly as GET /persona/personas returns it (spec-typed) + the
// display-only `serviceName` join (no DB column). A backend column change now fails
// registry's tsc instead of at runtime.
export type Persona = PersonaRow & {
  serviceName?: string | null;
};
export type PersonaVisibility = "public" | "unlisted" | "private";
// The editable draft PersonaEditor works with: user-settable fields only — no
// server-assigned userId/appId, `model` nullable while unset, and the
// precise `visibility` union (the spec response types it as a plain string).
export type PersonaDraft = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  modelPrompt: string;
  voice: string | null;
  character: string | null;
  examples: string | null;
  avatarAttachmentId: string | null;
  serviceId: string | null;
  serviceName?: string | null;
  model: string | null;
  visibility: PersonaVisibility;
  /** Demo-mode script. Owner-only — absent from every public payload. */
  cannedChat: CannedChatConfig | null;
  chatStatus: ChatStatusConfig | null;
};
// Map a loaded persona (response) into an editable draft, narrowing the spec's
// loose `visibility: string` back to the UI union.
export function toPersonaDraft(p: Persona): PersonaDraft {
  const visibility: PersonaVisibility =
    p.visibility === "public" || p.visibility === "unlisted" ? p.visibility : "private";
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    modelPrompt: p.modelPrompt,
    voice: p.voice,
    character: p.character,
    examples: p.examples,
    avatarAttachmentId: p.avatarAttachmentId ?? null,
    serviceId: p.serviceId,
    serviceName: p.serviceName ?? null,
    model: p.model,
    visibility,
    cannedChat: p.cannedChat ?? null,
    chatStatus: p.chatStatus ?? null,
  };
}
export type PublicPersona = PublicPersonaRow;
export type PersonaBody = {
  slug: string;
  name: string;
  description?: string;
  modelPrompt: string;
  voice?: string;
  character?: string;
  examples?: string;
  avatarAttachmentId?: string | null;
  serviceId?: string | null;
  model?: string | null;
  visibility?: PersonaVisibility;
  cannedChat?: CannedChatConfig | null;
  chatStatus?: ChatStatusConfig | null;
};
