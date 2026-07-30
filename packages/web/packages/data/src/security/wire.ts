// Wire types for the security domain — package-local mirrors of the OpenAPI-generated
// request/response shapes the hub previously imported as `RequestBody`/`SuccessBody` from
// `@agentic-toolkit/adh-api-types` (for /auth/tokens and /bucket/{access-groups,buckets}/*). These
// carry full backend-schema fidelity (not just the fields today's call sites touch) so the
// toolkit stays decoupled from the hub's generated types without narrowing what a caller
// can rely on.

// --- API tokens (/auth/tokens) -----------------------------------------------------------

export interface ApiTokenRow {
  id: string;
  name: string;
  /** Non-secret leading chars, for display */
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  /** REST path prefixes this token may reach (e.g. ["/content/markdown"], optional ":read"
   *  suffix, "*" = all). null = legacy curated-only. */
  scope?: string[] | null;
}

export interface ApiTokenCreatedRow extends ApiTokenRow {
  /** The raw token value — shown exactly once */
  token: string;
}

export interface MintTokenBody {
  name: string;
  expiresAt?: string | null;
  /** REST path prefixes the token may reach */
  scope?: string[];
}

// --- Bucket access lists (/bucket/access-groups, /bucket/buckets/{bucketId}/access-groups) --

export type MemberType = "user" | "organization" | "persona" | "app" | "token";
export type GrantTargetType = "bucket" | "bucket_type" | "row";

export interface AccessGroupRow {
  id: string;
  /** owning ecosystem */
  ecosystemId: string;
  bucketId: string;
  name: string;
  description: string;
  /** 'everyone' (seeded) or 'custom' */
  kind: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGroupMemberRow {
  id: string;
  ecosystemId: string;
  accessGroupId: string;
  memberType: MemberType;
  memberId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGrantRow {
  id: string;
  ecosystemId: string;
  accessGroupId: string;
  targetType: GrantTargetType;
  targetId: string;
  /** comma-separated CRUD subset, e.g. 'C,R,U,D' or '' (none) */
  crud: string;
  grantedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGroupDetailRow extends AccessGroupRow {
  members: AccessGroupMemberRow[];
  grants: AccessGrantRow[];
}

export interface AccessGroupListRow {
  accessGroups: AccessGroupRow[];
}

export interface AccessGroupCreateBody {
  name: string;
  description?: string;
}

export interface AccessGroupPatchBody {
  name?: string;
  description?: string;
}

export interface AccessGroupMemberAddBody {
  memberType: MemberType;
  memberId: string;
}

export interface AccessGrantPutBody {
  targetType: GrantTargetType;
  targetId: string;
  /** comma-separated CRUD subset (or '' for none) */
  crud: string;
}
