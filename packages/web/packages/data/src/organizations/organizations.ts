"use client";

// Organizations API client — the dedicated /organization/organizations routes.
// Hand-written on the backend (NOT generic CRUD): creating an org PROVISIONS
// its ownership chain (namespace + admin team + default ecosystem) and mints
// its reverse-domain rdid. Authz is split server-side: create is open to any
// authenticated caller in their PERSONAL workspace but needs admin of the org
// when created from an org workspace, name/description edits are org-team-admin,
// and slug changes are site-admin; a 403 surfaces as an inline error.
//
// `list` is WORKSPACE-SCOPED and takes the workspace slug. It replaced the older
// arrangement, where a host wanting "the caller's organizations" read
// `workspacesApi.list()` and filtered `kind === "organization"` — that answered a
// pure MEMBERSHIP question, identical under every workspace, so switching
// workspaces changed nothing about the list and the workspace you had open
// appeared inside its own organizations rail. Organizations now carry an owning
// workspace (`owner_kind`/`owner_id`), and this endpoint reads it.
// `workspacesApi.list()` remains the right call for the workspace SWITCHER, which
// genuinely is asking the membership question.

import { authedJson, authedRequest, isConflict, rethrowConflict } from "../http";
import { compact, enc } from "../client-helpers";
import type {
  Organization,
  OrganizationCreateInput,
  OrganizationListRow,
  OrganizationProvisioned,
  OrganizationRenameInput,
  OrganizationRestored,
} from "./wire";

export type {
  Organization,
  OrganizationCreateInput,
  OrganizationListRow,
  OrganizationProvisioned,
  OrganizationRenameInput,
  OrganizationRenamed,
  OrganizationRestored,
} from "./wire";

/**
 * The react-query key PREFIX for the workspace-scoped organizations list. A caller appends the
 * workspace slug (`[...ORGANIZATIONS_QUERY_KEY, slug]`), so each workspace caches its own answer
 * and switching workspaces cannot serve the previous one's rows; invalidating the bare prefix
 * clears every workspace at once, which is what a create or a rename needs.
 *
 * Deliberately NOT `WORKSPACES_QUERY_KEY`: that key caches the switcher's membership list, a
 * different question over a different endpoint. Sharing one key over two questions is what made
 * the two lists impossible to tell apart in the first place.
 */
export const ORGANIZATIONS_QUERY_KEY = ["organizations"] as const;

export const organizationsApi = {
  /**
   * The organizations of ONE workspace. What the answer means depends on the workspace's kind,
   * and the backend decides it — a personal workspace gets the orgs you own plus the orgs you
   * belong to; an ORG workspace gets the orgs that org owns, and only those.
   *
   * `workspaceSlug` is required, because an unscoped organizations list is the bug this endpoint
   * was added to end: the rail used to read `workspacesApi.list()` (a pure membership question)
   * and therefore showed the same rows under every workspace — including the one you had open.
   */
  async list(workspaceSlug: string): Promise<OrganizationListRow[]> {
    return authedJson<OrganizationListRow[]>(
      `/api/organization/organizations?workspace=${enc(workspaceSlug)}`,
    );
  },

  /** Resolve an organization by UUID, slug, or reverse-domain rdid. */
  async resolve(key: string): Promise<Organization> {
    return authedJson<Organization>(`/api/organization/organizations/${enc(key)}`);
  },

  /**
   * Create + provision an organization; the creator is seeded as the new org's admin.
   *
   * Open to any authenticated caller in their own personal workspace. Creating from an ORG
   * workspace is a governance act — the org that owns the workspace ends up owning the result —
   * so the backend requires the caller to be an admin of that org (or of one above it) and
   * answers 403 otherwise.
   *
   * `workspaceSlug` names the workspace the org is created FROM, and therefore the workspace that
   * will OWN it — creating from an org workspace makes that org the owner. It is required for the
   * same reason `list` requires it: leaving it off is how an org created inside an org workspace
   * silently became the creator's personal org.
   */
  async create(
    input: OrganizationCreateInput,
    workspaceSlug: string,
  ): Promise<OrganizationProvisioned> {
    try {
      return await authedJson<OrganizationProvisioned>(
        `/api/organization/organizations?workspace=${enc(workspaceSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
    } catch (err) {
      rethrowConflict(err, "An organization with that slug already exists.");
    }
  },

  /** Patch the mutable handle/labels. name/description: org-team-admin;
   *  slug: site-admin only (it re-mints the org's global rdid tree). */
  async rename(id: string, input: OrganizationRenameInput): Promise<Organization> {
    try {
      return await authedJson<Organization>(`/api/organization/organizations/${enc(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compact(input)),
      });
    } catch (err) {
      rethrowConflict(err, "That organization slug is already taken.");
    }
  },

  /** ARCHIVE an organization: it leaves every live surface and its `org.<slug>` handle is released
   *  for anyone to claim. Reversible via {@link restore} while that handle is still free. Org
   *  creator, org-team admin, or site-admin; a 403 surfaces as an inline error. */
  async archive(id: string): Promise<void> {
    // 204 No Content — authedRequest, not authedJson (nothing to parse).
    await authedRequest(`/api/organization/organizations/${enc(id)}`, { method: "DELETE" });
  },

  /** Restore an archived organization to its OWN handle. A conflict means the handle has since
   *  been taken — the org stays archived, and getting it back needs a different slug. */
  async restore(id: string): Promise<Organization> {
    try {
      const body = await authedJson<OrganizationRestored>(
        `/api/organization/organizations/${enc(id)}/restore`,
        { method: "POST" },
      );
      return body.organization;
    } catch (err) {
      // Status-based, not rethrowConflict: the restore route's 409 message
      // ("that organization handle has been taken") doesn't match the
      // "already exists" pattern rethrowConflict keys off of.
      if (isConflict(err)) {
        throw new Error("That organization's handle has been taken, so it can't be restored.");
      }
      throw err;
    }
  },
};
