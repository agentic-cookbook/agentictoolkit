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
import { getToolkitQueryClient } from "./query";
import { revalidateResources } from "./use-resource-list";

/** A principal the caller can scope a feature to: their personal workspace, or an org's. */
export interface Workspace {
  slug: string;
  name: string;
  kind: "individual" | "organization";
}

/**
 * The react-query key for {@link workspacesApi.list} — exported because the list goes stale from
 * OUTSIDE this module: renaming an organization moves its slug, and the workspace bar, the
 * switcher and every feature rail read it. Published here so a host and a feature invalidate the
 * same cache entry rather than each holding a private key for the same endpoint.
 */
export const WORKSPACES_QUERY_KEY = ["workspaces"] as const;

/** The window event {@link notifyWorkspacesChanged} fires. Exported for tests and for a host that
 *  would rather listen directly than through {@link onWorkspacesChanged}. */
export const WORKSPACES_CHANGED_EVENT = "adh:workspaces-changed";

/**
 * Announce that the workspace LIST gained or lost a row. Creating an organization is the action
 * that does it today; archiving one is the other direction.
 *
 * A WINDOW EVENT rather than an invalidation, because the list is cached more than once and the
 * copies do not share a client:
 *
 *  - the toolkit's client, under {@link WORKSPACES_QUERY_KEY} — the fleet's switcher;
 *  - the toolkit's resource cache, under `useResourceList('workspaces')` — SiteHomeShell's chooser,
 *    which is a different entry over the same endpoint;
 *  - **the host app's own client**, which is a different PHYSICAL react-query module from this one
 *    (see `@agentic-toolkit/data/query`). The hub bundles its own copy, so its provider is
 *    invisible to any toolkit component and no `useQueryClient()` here can ever reach it. That is
 *    the bug this exists for: an org created from the Organizations rail refetched the org list and
 *    left the hub's workspace switcher showing the pre-create list for the whole 5-minute
 *    `staleTime`. `colorMode` crosses the same boundary the same way.
 *
 * The two caches this module CAN reach are swept here, so one call is the whole announcement. A
 * host with its own cache subscribes with {@link onWorkspacesChanged}.
 */
export function notifyWorkspacesChanged(): void {
  void getToolkitQueryClient()
    .invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY })
    .catch(() => {});
  revalidateResources((cacheKey) => cacheKey === "workspaces");
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKSPACES_CHANGED_EVENT));
}

/** Subscribe a host's own cache to {@link notifyWorkspacesChanged}. Returns the unsubscribe, so it
 *  is an effect body on its own: `useEffect(() => onWorkspacesChanged(fn), [fn])`. */
export function onWorkspacesChanged(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WORKSPACES_CHANGED_EVENT, listener);
  return () => window.removeEventListener(WORKSPACES_CHANGED_EVENT, listener);
}

/** `GET /auth/slug-available/:slug`, verbatim: `reason` says which test refused it. */
export interface SlugAvailability {
  available: boolean;
  reason?: "format" | "taken";
}

/**
 * Is `slug` free to claim in the workspace URL namespace?
 *
 * ONE namespace, deliberately: a user's handle and an organization's occupy the same URL space,
 * so the endpoint answers about both and a form editing either must ask it. It excludes only the
 * CALLER's own user row — an org editing its own handle must therefore skip the probe for its
 * current slug, or its live row comes back "taken" and the form refuses the value it already has.
 */
export function checkWorkspaceSlugAvailable(slug: string): Promise<SlugAvailability> {
  return authedJson<SlugAvailability>(`/api/auth/slug-available/${encodeURIComponent(slug)}`);
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
