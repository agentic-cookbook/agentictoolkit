// @agentic-toolkit/data — unified headless data model.
//
// The `.` entry surfaces the cross-cutting substrate (authed HTTP, tenant,
// FTD persistence, the resource-list cache). Feature domains ship on subpaths
// (e.g. `@agentic-toolkit/data/projects`).

// Authed HTTP transport + the status predicate the resource views read.
export { authedJson, authedRequest, isConflict } from "./http";

// Request/response shaping shared by the CRUD clients.
export { compact, enc, narrow, scopeByOwner, sortByText } from "./client-helpers";

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
