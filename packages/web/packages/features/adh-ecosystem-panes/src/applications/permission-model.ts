// Permission model for an application's access to a schema.
//
// The generic CRUD primitives (Crud, CRUD_KEYS, defaults, clampToParent) live in
// @agenticdevelopertoolkit/ui/components/crud (shared with the bucket-access feature) and are
// re-exported here so the applications feature keeps a single import site.
//
// Permissions are an OVERLAY: an application "grants" itself access to a schema
// DEFINITION (owned by the Schemas feature) and sets CRUD permissions on the
// schema and its tables. The definition supplies structure (which tables);
// this supplies the permission decisions. Inheritance: schema → table (→ row);
// a child can never be more permissive than its parent (clampToParent is the
// single enforcement point).

import {
  CRUD_KEYS,
  clampToParent,
  noAccess,
  readOnly,
  type Crud,
  type CrudKey,
} from "@agenticdevelopertoolkit/ui/components/crud";

// Re-export so existing applications consumers keep importing the CRUD model from here.
export { CRUD_KEYS, clampToParent, noAccess, readOnly };
export type { Crud, CrudKey };

/** Whether a table applies one CRUD set to all rows, or is per-row. */
export type PermissionLevel = "table" | "row";

/** Per-table permission decision within a grant. Keyed by SchemaTable.id. */
export interface TableGrant {
  level: PermissionLevel;
  /** Table-level CRUD. Meaningful when level === "table"; clamped to schema. */
  permissions: Crud;
}

/**
 * An application's grant of a schema definition: the schema-level CRUD ceiling
 * plus a per-table overlay. `tables` is sparse — tables without an entry use
 * the most-restrictive default (defaultTableGrant). This keeps grants robust
 * when the underlying definition gains/loses tables.
 */
export interface SchemaGrant {
  /** References SchemaDefinition.id. */
  schemaId: string;
  permissions: Crud;
  tables: Record<string, TableGrant>;
}

/** A new table grant: row-level, no access (most restrictive). */
export function defaultTableGrant(): TableGrant {
  return { level: "row", permissions: noAccess() };
}

/** A new schema grant: read-only ceiling, no per-table overrides yet. */
export function newSchemaGrant(schemaId: string): SchemaGrant {
  return { schemaId, permissions: readOnly(), tables: {} };
}

/** Resolve a table's grant, falling back to the most-restrictive default. */
export function tableGrantFor(grant: SchemaGrant, tableId: string): TableGrant {
  return grant.tables[tableId] ?? defaultTableGrant();
}
