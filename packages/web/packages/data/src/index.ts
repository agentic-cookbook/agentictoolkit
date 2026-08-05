// @agentic-toolkit/data — unified headless data model.
//
// The `.` entry surfaces the cross-cutting substrate (authed HTTP, tenant,
// FTD persistence, the resource-list cache). Feature domains ship on subpaths
// (e.g. `@agentic-toolkit/data/projects`).

// Authed HTTP transport + the status-error helpers the resource views read: the
// raw `httpStatus` extractor, the 404/403/409/503 predicates, the friendly
// message fallback, and the conflict rethrow. A host (the hub) re-exports these
// rather than keeping a byte-identical copy.
export {
  authedJson,
  authedRequest,
  httpStatus,
  isNotFound,
  isConflict,
  isForbidden,
  isServiceUnavailable,
  errMsg,
  rethrowConflict,
  readTokenSubject,
} from "./http";

// Request/response shaping shared by the CRUD clients.
export { compact, enc, narrow, scopeByOwner, sortByText } from "./client-helpers";

// Host-injectable runtime config (the FTD storage-key prefix, default "adh").
export { configureData, dataConfig } from "./config";
export type { DataRuntimeConfig } from "./config";

// The current access token's tenant (its own React hook for consumers).
export { decodeJwtClaims, tenantIdFromToken, useTenantId } from "./tenant";

// Per-collection FTD UI persistence.
export {
  readLastId,
  clearLastId,
  writeLastId,
  readViewMode,
  writeViewMode,
  type ViewMode,
} from "./ftd-storage";

// Shared, tenant-scoped list cache for a resource tab, plus the reusable
// delete-with-confirm handler its rows wire to a trash affordance.
export { useResourceList, makeEntityDeleteHandler, type ResourceList } from "./use-resource-list";

// The caller's owner-scopable workspaces (personal + orgs) — the root of a feature
// site's stack, and what `?workspace=<slug>` pins a list/create to.
export { workspacesApi, type Workspace } from "./workspaces";

// Which of those workspaces the user last chose — the server row that makes the choice follow
// them across the family's many domains, plus its per-browser localStorage cache.
export {
  workspacePrefsApi,
  readCachedWorkspace,
  writeCachedWorkspace,
  type WorkspacePrefs,
} from "./workspace-prefs";
