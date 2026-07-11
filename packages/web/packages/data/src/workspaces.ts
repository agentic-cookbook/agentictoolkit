"use client";

// The caller's workspaces — the owning principals they can act as.
//
// A workspace is a slug the backend resolves to an owning principal (see the
// backend's `resolveWorkspaceOwner`): the caller's own personal slug, or an
// organization they belong to. It is what `?workspace=<slug>` pins a list/create
// to, so it is the natural ROOT of a feature site's hierarchical stack.
//
// The backend's `/workspaces` also returns `team` rows, but a team is a membership
// grouping, NOT an owning principal — `?workspace=<teamSlug>` 404s. So `list()`
// drops them: every row it returns is one a feature can actually be scoped to.
// (The hub's own switcher shows teams because it navigates to team routes; this
// client exists for owner-scoping, which is a strictly smaller set.)

import { authedJson } from "./http";
import { sortByText } from "./client-helpers";

/** A principal the caller can scope a feature to: their personal workspace, or an org's. */
export interface Workspace {
  slug: string;
  name: string;
  kind: "individual" | "organization";
}

interface WorkspaceRow {
  slug: string;
  name: string;
  type: "individual" | "organization" | "team";
}

export const workspacesApi = {
  /** The caller's personal workspace first, then their organizations (A→Z). */
  async list(): Promise<Workspace[]> {
    const rows = await authedJson<WorkspaceRow[]>("/api/workspaces");
    const own = rows.filter((r) => r.type === "individual");
    const orgs = rows.filter((r) => r.type === "organization");
    return [...own, ...sortByText(orgs, (o) => o.name)].map((r) => ({
      slug: r.slug,
      name: r.name,
      kind: r.type as Workspace["kind"],
    }));
  },
};
