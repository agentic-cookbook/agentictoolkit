// Wire types for the personas domain — package-local mirrors of the OpenAPI-generated
// request/response shapes the hub previously imported as `RequestBody`/`SuccessBody` from
// `@adh-shared/api-types`. The persona GRANT surfaces (tools/user-tools/may-act) now live under
// `/access/personas/*`, approvals under `/processing/personas/*`, token-mint under
// `/persona/personas/*` (moved out of the old `/registry/personas/*` base by the schema reorg).
// These carry full backend-schema fidelity (not just the fields today's call sites touch) so the
// toolkit stays decoupled from the hub's generated types without narrowing what a caller can rely on.

/** A persona-action approval row (the human-in-the-loop decision queue). */
export interface ApprovalRow {
  id: string;
  personaId: string;
  subjectKind: "self" | "user" | "team" | "org";
  /** null for self/eco-scoped subjects */
  subjectId?: string | null;
  subjectEco: string;
  /** curated tool name, or the gateway tool 'adh_request' */
  toolName: string;
  /** the frozen invocation payload */
  args: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  requestedBy?: string | null;
  /** the human who decided (null until then) */
  decidedBy?: string | null;
  decidedAt?: string | null;
  /** the outcome once an approved action runs (null until then) */
  result?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApprovalListRow {
  approvals: ApprovalRow[];
}

/** A grantable tool + its grant/autonomy state for one persona. */
export interface ToolCatalogItemRow {
  toolName: string;
  /** null for curated internal tools; else the source id (e.g. "web", "mcp.<server>") */
  source: string | null;
  /** human-readable label from the tool catalog; falls back to `toolName` when uncataloged */
  displayName: string;
  /** human-readable description from the tool catalog; '' when uncataloged */
  description: string;
  readOnly: boolean;
  /** true iff this persona currently holds the tool */
  granted: boolean;
  /** true = this grant skips the approval gate (except acting as self, which always
   *  gates); false when not granted */
  autonomous: boolean;
}

export interface ToolCatalogListRow {
  tools: ToolCatalogItemRow[];
}

/** A tool grant, as returned by the autonomy PATCH. */
export interface ToolGrantRow {
  toolName: string;
  /** true = this grant skips the approval gate (except acting as self, which always gates) */
  autonomous: boolean;
  createdAt: string;
}

export interface SetAutonomyBody {
  autonomous: boolean;
}

/** The subject kinds a persona may act for (always includes seeded 'self'). */
export interface MayActRow {
  kinds: ("self" | "user" | "team" | "org")[];
}

export interface MayActGrantBody {
  kind: "user" | "team" | "org";
}

/** A persona the caller may configure per-tool consent for (holds `may_act 'user'`). */
export interface UserActablePersonaRow {
  id: string;
  slug: string;
  name: string;
}

export interface UserActableListRow {
  personas: UserActablePersonaRow[];
}

/** A persona's owner-granted tool + the caller's own per-tool allow toggle. */
export interface UserToolRow {
  toolName: string;
  /** null for curated internal tools; else the source id (e.g. "web", "mcp.<server>") */
  source: string | null;
  /** human-readable label from the tool catalog; falls back to `toolName` when uncataloged */
  displayName: string;
  /** human-readable description from the tool catalog; '' when uncataloged */
  description: string;
  readOnly: boolean;
  /** true iff the calling user has allowed the persona to invoke this tool for them */
  allowed: boolean;
}

export interface UserToolListRow {
  tools: UserToolRow[];
}

export interface SetAllowedBody {
  allowed: string[];
}

/* ── Me / public profile / persona CRUD (GET rows + request bodies) ──────── */

/** The authenticated user record, exactly as `GET /auth/me` returns it (and
 *  `PATCH /auth/me` echoes back) — the customer.customers identity + effective
 *  capabilities. There is no separate `githubLogin`: GitHub is just one auth
 *  method behind the shared OAuth flow, not a field on the profile. */
export interface MeRow {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  slug: string | null;
  /** Whether the public profile card is visible at /public/users/:slug */
  publicProfileEnabled: boolean;
  capabilities: string[];
}

/** `PATCH /auth/me` body — update the caller's own profile (name, slug, avatar,
 *  public-profile toggle). */
export interface MePatchBody {
  name?: string;
  slug?: string;
  avatarUrl?: string;
  publicProfileEnabled?: boolean;
}

/** One social link on a public profile card. */
export interface PublicSocialLinkRow {
  platform: string;
  url: string;
  handle: string;
}

/** One mailing address on a public profile card. */
export interface PublicAddressRow {
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** The owner byline embedded in a public persona (or persona summary) — null
 *  when the owning user has no public profile. */
export interface PublicOwnerRow {
  slug: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** A public persona as it appears in a public profile card's `personas` list —
 *  a narrower projection than {@link PublicPersonaRow} (no prompt/voice/etc.). */
export interface PublicPersonaSummaryRow {
  slug: string;
  name: string;
  description: string | null;
  visibility: "public";
  createdAt: string;
  owner: PublicOwnerRow | null;
}

/** Backend row for `GET /public/users/{slug}` — a public profile card + its
 *  public personas summary list. */
export interface PublicUserRow {
  slug: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  socialLinks: PublicSocialLinkRow[];
  emails: string[];
  phones: string[];
  addresses: PublicAddressRow[];
  personas: PublicPersonaSummaryRow[];
}

/** A base_url placeholder the connect UI prompts for and substitutes (e.g.
 *  `{account_id}`, `{region}`, `{resource}`). */
export interface ConnectionSpecUrlVar {
  name: string;
  label?: string;
  example?: string;
  secret?: boolean;
}

/** A header the connect UI prompts a per-connection value for and writes into
 *  `extraHeaders` (e.g. Portkey's `x-portkey-provider`). The `extraHeaders`
 *  counterpart of {@link ConnectionSpecUrlVar}: the header NAME is fixed by the
 *  template, only its value is entered per connection. */
export interface ConnectionSpecHeaderVar {
  header: string;
  label?: string;
  example?: string;
  secret?: boolean;
}

/** How the API credential is attached. `bearer`/`header` are enforced by the
 *  backend OpenAI-compat client; `sigv4`/`oauth2` are reserved (stored, not yet
 *  enforced). Mirrors the backend `llm/connectionSpec.ts` union. */
export type ConnectionSpecAuth =
  | { type: "bearer" }
  | { type: "header"; header: string; scheme: "bearer" | "raw" }
  | { type: "sigv4"; region?: string }
  | { type: "oauth2"; tokenUrl?: string };

/** Transport/auth spec for an OpenAI-wire provider — orthogonal to providerKind
 *  (the wire format). Carries URL placeholders + credential placement so Azure /
 *  cloud gateways ride the same client. Null = plain `Authorization: Bearer`. */
export interface ConnectionSpec {
  specVersion: 1;
  urlVars?: ConnectionSpecUrlVar[];
  headerVars?: ConnectionSpecHeaderVar[];
  auth?: ConnectionSpecAuth;
  defaultQuery?: Record<string, string>;
  extraHeaders?: Record<string, string>;
}

/** Sync-fed model row on a provider template (mirrors ProviderTemplateModel). */
export interface TemplateModelRow {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  source: "curated" | "synced";
  lastSyncedAt: string | null;
  createdAt: string;
}

/** Set ⇒ informational template: no first-party API; connect via the named templates. */
export interface TemplateAvailableVia {
  note: string;
  templates: string[];
}

/** Backend DTO for `GET /persona/provider-templates` (one `items[]` entry) — the GLOBAL
 *  provider-catalog row from `persona.service_templates`, as the hand-written route serves
 *  it: `connectionSpec.extraHeaders` REDACTED, operator-only `syncKeys` stripped, and the
 *  template's synced models nested. This route is the SOLE read surface for the table; the
 *  raw generic-CRUD `/persona/service-templates` endpoint was removed because it served the
 *  rows with `extraHeaders` unredacted. */
export interface ServiceTemplateRow {
  id: string;
  providerKind: string;
  name: string;
  baseUrl: string;
  documentationUrl: string | null;
  statusUrl: string | null;
  connectionSpec: ConnectionSpec | null;
  /** Set ⇒ informational template: no first-party API of its own, so `connect` must
   *  be hidden — a would-be user reaches this provider through the named gateway
   *  templates instead. Null/omitted ⇒ a normal, directly-connectable template.
   *  (Older backends omit the field entirely.) */
  availableVia?: TemplateAvailableVia | null;
  /** The provider's supported modalities (e.g. `["chat"]`, `["image"]`,
   *  `["audio"]`). Null/omitted ⇒ chat. Older backends omit it. (`syncKeys` is never
   *  surfaced — the provider-templates payload strips it entirely.) */
  modalities?: string[] | null;
  /** The template's catalog models, name-ordered (curated + synced). */
  models: TemplateModelRow[];
  createdAt: string;
  updatedAt: string;
}

/** Backend row for `GET /persona/services` (and a single service, redacted —
 *  never the raw apiKey). `models` is a jsonb column the spec types loosely
 *  (string | object per entry); the personas client's `ModelInfo` recovers the
 *  structured shape client-side. */
export interface ServiceRow {
  id: string;
  templateId?: string | null;
  providerKind: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  connectionSpec?: ConnectionSpec | null;
  connectStatus: string;
  connectError?: string | null;
  lastConnectedAt?: string | null;
  documentationUrl?: string | null;
  statusUrl?: string | null;
  models: (string | Record<string, unknown>)[];
  modelsFetchedAt?: string | null;
}

/** Backend row for `GET /persona/personas` (and a single persona). */
export interface PersonaRow {
  id: string;
  userId: string | null;
  ownerKind: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  model: string;
  serviceId: string | null;
  appId: string | null;
  avatarAttachmentId: string | null;
  modelPrompt: string;
  voice: string | null;
  character: string | null;
  examples: string | null;
  createdAt: string;
  updatedAt: string;
  ownedEcosystemId?: string | null;
}

/** Backend row for `GET /public/personas/{slug}` and `GET
 *  /public/users/{ownerSlug}/personas/{personaSlug}` — same public-persona shape
 *  either route. */
export interface PublicPersonaRow {
  slug: string;
  name: string;
  description: string | null;
  modelPrompt: string;
  provider: string | null;
  model: string;
  avatarUrl: string | null;
  voice: string | null;
  character: string | null;
  examples: string | null;
  visibility: "public" | "unlisted";
  createdAt: string;
  owner: PublicOwnerRow | null;
}
