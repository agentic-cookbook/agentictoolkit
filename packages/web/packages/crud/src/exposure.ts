// What a given viewer may do with a given table, from the backend's documented exposure tier.
// Pure, React-free, unit-testable: the browser (CrudDataBrowser) asks which tables to list, the
// editor (CrudDataView) asks whether to offer the write actions.
//
// This mirrors the server's gate — `hasPermission` in backend src/lib/permissions.ts, over the
// TABLE_EXPOSURE map that src/openapi/build.ts publishes as `x-exposure` — so the two cannot
// drift silently: the tier is generated from that one map, never restated here.
//
// IMPORTANT: this is presentation, NOT enforcement. The server check runs on every request
// regardless of what the client renders; hiding a table only spares the viewer a 403 they can
// do nothing about. Never treat a passing check here as authorization.

import type { CrudTableMeta } from './types'

/**
 * Whether the viewer may READ this table at all — i.e. whether it should appear in the
 * browser's schema ▸ table rails.
 *
 * Only the `admin` tier is viewer-restricted: `catalog` tables are readable by anyone
 * authenticated (they are global catalogs and server-written ledgers), and `owner` tables are
 * readable by anyone, with the rows themselves isolated to the caller's tenant server-side.
 */
export function canReadTable(meta: CrudTableMeta, isAdminViewer: boolean): boolean {
  return meta.exposure === 'admin' ? isAdminViewer : true
}

/**
 * Whether the viewer may WRITE this table — create, update, delete. Only `owner` tables are
 * writable by a non-admin; `catalog` and `admin` tiers both reserve writes to admins (a
 * self-written catalog row is a paywall bypass or a self-granted entitlement).
 *
 * A false here means the editor renders read-only: no Create, no Delete, and every field
 * locked, so nothing can go dirty and Save stays disabled.
 */
export function canWriteTable(meta: CrudTableMeta, isAdminViewer: boolean): boolean {
  return meta.exposure === 'owner' ? true : isAdminViewer
}

/** The subset of `tables` the viewer may read, order preserved. */
export function readableTables(
  tables: readonly CrudTableMeta[],
  isAdminViewer: boolean,
): CrudTableMeta[] {
  return tables.filter((table) => canReadTable(table, isAdminViewer))
}
