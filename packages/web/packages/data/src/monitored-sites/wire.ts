// Local wire types for the Monitored-Sites clients — the backend row + request-
// body shapes the clients read/send (see projects/wire.ts for the pattern: these
// replace the hub's generated `SuccessBody<...>` / `RequestBody<...>` from
// `@agentic-toolkit/adh-api-types`, adh product vocabulary a
// generic data client must not take on). Each
// interface carries exactly the fields the mappers/call sites touch.
// Type-only file.

/* ── Site groups ──────────────────────────────────────────────────────── */

/** Backend row for `GET /monitoring/site-groups` (and a single group). */
export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Sites ────────────────────────────────────────────────────────────── */

/** Backend row for `GET /monitoring/sites` (and a single site). */
export interface SiteRow {
  id: string;
  slug: string;
  name: string;
  siteGroupId: string;
  createdAt: string;
  updatedAt: string;
}

/** `POST /monitoring/sites` body — note the backend's `siteGroupId`, renamed to
 *  `groupId` in the client's `CreateSiteBody`. */
export interface SiteCreateBody {
  name: string;
  slug: string;
  siteGroupId: string;
}

/** `PUT /monitoring/sites/{id}` body — same rename as `SiteCreateBody`. */
export interface SitePutBody {
  name?: string;
  slug?: string;
  siteGroupId?: string;
}

/* ── Endpoints ────────────────────────────────────────────────────────── */

/** Backend row for `GET /monitoring/endpoints` (and a single endpoint). */
export interface EndpointRow {
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

/** `POST /monitoring/endpoints` body — adds the `siteId` the client's
 *  `CreateEndpointBody` doesn't carry (it's a separate function argument). */
export interface EndpointCreateBody {
  siteId: string;
  url: string;
  kind?: string;
  expectedStatus?: number;
  checkIntervalSeconds?: number;
  isActive?: boolean;
}

/** `POST /monitoring/site-groups` body (the fields this client sends). */
export interface GroupCreateBody {
  name: string;
  slug: string;
  retentionDays?: number;
}

/** `PUT /monitoring/site-groups/{id}` body (all-optional partial update). */
export interface GroupPutBody {
  name?: string;
  slug?: string;
  retentionDays?: number;
}

/** `PUT /monitoring/endpoints/{id}` body (the fields this client sends). */
export interface EndpointPutBody {
  url?: string;
  kind?: string;
  expectedStatus?: number;
  checkIntervalSeconds?: number;
  isActive?: boolean;
}
