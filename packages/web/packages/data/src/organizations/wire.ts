// Local wire types for the Organizations + workspace-members clients — the backend row and
// request-body shapes those clients read/send (see ecosystems/wire.ts for the pattern: these
// replace the hub's generated `SuccessBody<…>` / `RequestBody<…>` from
// `@agentic-toolkit/adh-api-types`, adh product vocabulary a generic data client must not take
// on). Transcribed from the `RegistryOrganization` / `RegistryProvisionedOrganization` /
// `WorkspaceMember` component schemas the backend's openapi.json documents for
// `/organization/organizations*` and `/workspaces/{slug}/members`.
// Type-only file.

/** An organization as the resolve/rename routes return it. `rdid` is present only on the
 *  POST create response — a plain GET/PATCH omits it, which is why it is optional here. */
export interface Organization {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  /** org.<slug> — present on the POST create response; absent on plain GET/PATCH. */
  rdid?: string;
}

/** POST body. Only slug + name: everything else about the org is provisioned server-side. */
export interface OrganizationCreateInput {
  slug: string;
  name: string;
}

/** The 201 body — the org plus the ownership chain the create PROVISIONED for it. */
export interface OrganizationProvisioned {
  organization: Organization;
  namespace: {
    id: string;
    ownerKind: "customer" | "organization" | "persona" | "ecosystem";
    ownerId: string;
    slug: string | null;
    name: string | null;
    rdid: string | null;
  };
  /** The provisioned admin team id. */
  teamId: string;
  ecosystem: { id: string; slug: string; rdid: string };
}

/** PATCH body — at least one of the three. `slug` is site-admin only (it re-mints the org's
 *  global rdid tree); name/description are org-team-admin. */
export interface OrganizationRenameInput {
  name?: string;
  slug?: string;
  description?: string;
}

/** The PATCH 200 body — the same `RegistryOrganization` the resolve returns. Named separately
 *  because call sites read as "what a rename gave back", and the two could diverge upstream. */
export type OrganizationRenamed = Organization;

/** The restore route's 200 body. */
export interface OrganizationRestored {
  organization: Organization;
}

/** One row of an organization workspace's roster. `email`/`displayName` are null for a member
 *  outside the caller's ecosystem (an RLS-bounded read, same as team rosters). */
export interface WorkspaceMember {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  /** Admin of any of the org's teams (the roster's strongest role). */
  isAdmin: boolean;
  /** Earliest membership across the org's teams. */
  addedAt: string;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
}
