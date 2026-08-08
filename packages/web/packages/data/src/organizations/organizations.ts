"use client";

// Organizations API client — the dedicated /organization/organizations routes.
// Hand-written on the backend (NOT generic CRUD): creating an org PROVISIONS
// its ownership chain (namespace + admin team + default ecosystem) and mints
// its reverse-domain rdid. There is no list endpoint, so the UI is
// lookup-based. Authz is split server-side: create is open to any
// authenticated caller, name/description edits are org-team-admin, and slug
// changes are site-admin; a 403 surfaces as an inline error.
//
// (No list endpoint is why a host that wants "the caller's organizations" reads
// `workspacesApi.list()` and filters `kind === "organization"` instead.)

import { authedJson, authedRequest, isConflict, rethrowConflict } from "../http";
import { compact, enc } from "../client-helpers";
import type {
  Organization,
  OrganizationCreateInput,
  OrganizationProvisioned,
  OrganizationRenameInput,
  OrganizationRestored,
} from "./wire";

export type {
  Organization,
  OrganizationCreateInput,
  OrganizationProvisioned,
  OrganizationRenameInput,
  OrganizationRenamed,
  OrganizationRestored,
} from "./wire";

export const organizationsApi = {
  /** Resolve an organization by UUID, slug, or reverse-domain rdid. */
  async resolve(key: string): Promise<Organization> {
    return authedJson<Organization>(`/api/organization/organizations/${enc(key)}`);
  },

  /** Create + provision an organization (any authenticated caller; the creator
   *  is seeded as the org's admin). */
  async create(input: OrganizationCreateInput): Promise<OrganizationProvisioned> {
    try {
      return await authedJson<OrganizationProvisioned>("/api/organization/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
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
        body: JSON.stringify(compact(input as Record<string, unknown>)),
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
