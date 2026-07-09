// Wire types for the personas domain — package-local mirrors of the OpenAPI-generated
// request/response shapes the hub previously imported as `RequestBody`/`SuccessBody` from
// `@adh-shared/api-types` (for /registry/personas/*). These carry full backend-schema
// fidelity (not just the fields today's call sites touch) so the toolkit stays decoupled
// from the hub's generated types without narrowing what a caller can rely on.

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
