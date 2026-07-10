// Status Sites API client — wired to the real backend generic CRUD over the
// `monitored_sites` schema:
//   /api/monitoring/site-groups   (groups)
//   /api/monitoring/sites         (sites)
//   /api/monitoring/endpoints     (endpoints)
//
// Returns raw rows (camelCase); this client maps the handful of fields the UI
// names differently and fills the gaps the backend has no filter params for.
//
// MODEL (matches the DB, NOT the old prototype): a site belongs to EXACTLY ONE
// group (`sites.site_group_id`, NOT NULL, FK ON DELETE CASCADE). This is a 1:M
// relationship — the prototype's many-to-many `groupIds[]` is gone. An endpoint
// belongs to exactly one site (same cascade). Deleting a group deletes its sites
// and their endpoints at the DB level; deleting a site deletes its endpoints.
//
// SCOPING: the whole chain is owner-scoped server-side (site_groups by the
// caller's user_id; sites/endpoints INHERIT user_id + owner from their parent at
// create/reparent). An optional `workspace` on every op pins it to the
// WORKSPACE'S owning principal instead (backend `?workspace=<slug>`): list
// returns only that principal's rows, create stamps it as the owner, and item
// update/delete resolve org-owned rows other members created. The client-side
// narrowing in listSites()/listEndpoints() stays as defense-in-depth. Columns
// the UI doesn't model (description, displayOrder, timeoutMs, …) are left to
// their server defaults.

import { authedJson, authedRequest } from "../http";
import { compact, enc, sortByText, workspaceQuery } from "../client-helpers";
import type {
  GroupRow,
  SiteRow,
  EndpointRow,
  GroupCreateBody,
  GroupPutBody,
  SiteCreateBody,
  SitePutBody,
  EndpointCreateBody,
  EndpointPutBody,
} from "./wire";

export interface SiteGroupView {
  id: string;
  slug: string;
  name: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteView {
  id: string;
  slug: string;
  name: string;
  /** The single group this site belongs to (1:M; required). */
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointView {
  id: string;
  siteId: string;
  url: string;
  kind: string;
  expectedStatus: number;
  checkIntervalSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupBody {
  name: string;
  slug: string;
  retentionDays?: number;
}

export interface UpdateGroupBody {
  name?: string;
  slug?: string;
  retentionDays?: number;
}

export interface CreateSiteBody {
  name: string;
  slug: string;
  /** Required: a site must belong to a group. */
  groupId: string;
}

export interface UpdateSiteBody {
  name?: string;
  slug?: string;
  groupId?: string;
}

export interface CreateEndpointBody {
  url: string;
  kind: string;
  expectedStatus?: number;
  checkIntervalSeconds?: number;
  isActive?: boolean;
}

export interface UpdateEndpointBody {
  url?: string;
  kind?: string;
  expectedStatus?: number;
  checkIntervalSeconds?: number;
  isActive?: boolean;
}

export const ENDPOINT_KINDS = ["http", "tcp", "icmp"] as const;

const GROUPS = "/api/monitoring/site-groups";
const SITES = "/api/monitoring/sites";
const ENDPOINTS = "/api/monitoring/endpoints";

export function toGroup(r: GroupRow): SiteGroupView {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    retentionDays: r.retentionDays,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toSite(r: SiteRow): SiteView {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    groupId: r.siteGroupId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toEndpoint(r: EndpointRow): EndpointView {
  return {
    id: r.id,
    siteId: r.siteId,
    url: r.url,
    kind: r.kind,
    expectedStatus: r.expectedStatus,
    checkIntervalSeconds: r.checkIntervalSeconds,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// --- groups -----------------------------------------------------------------

export async function listGroups(opts?: { workspace?: string }): Promise<SiteGroupView[]> {
  const rows = await authedJson<GroupRow[]>(`${GROUPS}${workspaceQuery(opts)}`);
  return sortByText(rows.map(toGroup), (g) => g.name);
}

export async function createGroup(
  body: CreateGroupBody,
  opts?: { workspace?: string },
): Promise<SiteGroupView> {
  const row = await authedJson<GroupRow>(`${GROUPS}${workspaceQuery(opts)}`, {
    method: "POST",
    body: JSON.stringify(
      compact({
        name: body.name,
        slug: body.slug,
        retentionDays: body.retentionDays,
      } satisfies GroupCreateBody),
    ),
  });
  return toGroup(row);
}

export async function updateGroup(
  id: string,
  body: UpdateGroupBody,
  opts?: { workspace?: string },
): Promise<SiteGroupView> {
  const patch = compact({
    name: body.name,
    slug: body.slug,
    retentionDays: body.retentionDays,
  } satisfies GroupPutBody);
  const row = await authedJson<GroupRow>(`${GROUPS}/${enc(id)}${workspaceQuery(opts)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return toGroup(row);
}

export function deleteGroup(id: string, opts?: { workspace?: string }): Promise<void> {
  // FK ON DELETE CASCADE removes the group's sites and their endpoints.
  return authedRequest(`${GROUPS}/${enc(id)}${workspaceQuery(opts)}`, { method: "DELETE" });
}

// --- sites ------------------------------------------------------------------

export async function listSites(opts?: { workspace?: string }): Promise<SiteView[]> {
  // Server-side owner scope covers both lists; the group narrowing stays as
  // defense-in-depth so the view can't drift from the groups rail.
  const [groups, rows] = await Promise.all([
    authedJson<GroupRow[]>(`${GROUPS}${workspaceQuery(opts)}`),
    authedJson<SiteRow[]>(`${SITES}${workspaceQuery(opts)}`),
  ]);
  const mine = new Set(groups.map((g) => g.id));
  return sortByText(
    rows.map(toSite).filter((s) => mine.has(s.groupId)),
    (s) => s.name,
  );
}

export async function createSite(
  body: CreateSiteBody,
  opts?: { workspace?: string },
): Promise<SiteView> {
  const fields: SiteCreateBody = {
    name: body.name,
    slug: body.slug,
    siteGroupId: body.groupId,
  };
  const row = await authedJson<SiteRow>(`${SITES}${workspaceQuery(opts)}`, {
    method: "POST",
    body: JSON.stringify(fields),
  });
  return toSite(row);
}

export async function updateSite(
  id: string,
  body: UpdateSiteBody,
  opts?: { workspace?: string },
): Promise<SiteView> {
  const patch = compact({
    name: body.name,
    slug: body.slug,
    siteGroupId: body.groupId,
  } satisfies SitePutBody);
  const row = await authedJson<SiteRow>(`${SITES}/${enc(id)}${workspaceQuery(opts)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return toSite(row);
}

export function deleteSite(id: string, opts?: { workspace?: string }): Promise<void> {
  // FK ON DELETE CASCADE removes the site's endpoints.
  return authedRequest(`${SITES}/${enc(id)}${workspaceQuery(opts)}`, { method: "DELETE" });
}

// --- endpoints --------------------------------------------------------------

export async function listEndpoints(
  siteId: string,
  opts?: { workspace?: string },
): Promise<EndpointView[]> {
  // Server-side equality filter on the siteId column; the client filter stays as
  // a defense-in-depth narrowing (harmless once the server already scoped).
  const qs = new URLSearchParams({ siteId });
  if (opts?.workspace) qs.set("workspace", opts.workspace);
  const rows = await authedJson<EndpointRow[]>(`${ENDPOINTS}?${qs}`);
  return sortByText(
    rows.map(toEndpoint).filter((e) => e.siteId === siteId),
    (e) => e.url,
  );
}

export async function createEndpoint(
  siteId: string,
  body: CreateEndpointBody,
  opts?: { workspace?: string },
): Promise<EndpointView> {
  const row = await authedJson<EndpointRow>(`${ENDPOINTS}${workspaceQuery(opts)}`, {
    method: "POST",
    body: JSON.stringify(
      compact({
        siteId,
        url: body.url,
        kind: body.kind,
        expectedStatus: body.expectedStatus,
        checkIntervalSeconds: body.checkIntervalSeconds,
        isActive: body.isActive,
      } satisfies EndpointCreateBody),
    ),
  });
  return toEndpoint(row);
}

export async function updateEndpoint(
  id: string,
  body: UpdateEndpointBody,
  opts?: { workspace?: string },
): Promise<EndpointView> {
  const patch = compact({
    url: body.url,
    kind: body.kind,
    expectedStatus: body.expectedStatus,
    checkIntervalSeconds: body.checkIntervalSeconds,
    isActive: body.isActive,
  } satisfies EndpointPutBody);
  const row = await authedJson<EndpointRow>(`${ENDPOINTS}/${enc(id)}${workspaceQuery(opts)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return toEndpoint(row);
}

export function deleteEndpoint(id: string, opts?: { workspace?: string }): Promise<void> {
  return authedRequest(`${ENDPOINTS}/${enc(id)}${workspaceQuery(opts)}`, { method: "DELETE" });
}
