// Structure-only model for a schema DEFINITION.
//
// A schema definition describes WHICH ADH tables it contains and what they're
// called — pure structure, no permissions. Permissions are a separate concern
// applied per-application when an app adds a schema (see
// applications/permission-model.ts). This split is deliberate: the same schema
// definition can be granted to many applications, each with its own permission
// overlay.
//
// Persisted via the backend `bucket.schemas` + `bucket.schema_tables`
// tables (see api/schemas.ts). Each table's `type` is one of the
// `content`/`personal` table types the DB exposes (see available-types.ts).

/** One ADH table within a schema definition. Structure only. */
export interface SchemaTable {
  /** Stable client id for React keys / cross-referencing grants. */
  id: string;
  /** User-defined slug, e.g. "contacts" — no spaces. */
  name: string;
  /** The underlying sql-table type id (e.g. "content.contacts"). */
  type: string;
}

export interface SchemaDefinition {
  id: string;
  /** Unique display name — the schema's identity. */
  name: string;
  description: string;
  tables: SchemaTable[];
  ecosystemId: string;
  /** `default` = the auto-seeded "all available tables" bucket every ecosystem gets (undeletable —
   *  the backend 409s a non-custom delete); `custom` = a developer-created bucket. */
  kind: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaDefinitionInput {
  name: string;
  description: string;
  tables: SchemaTable[];
}

/** Slugify a table name to the allowed shape (lowercase, underscores, no spaces). */
export function slugifyTableName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function newSchemaTableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tbl_${crypto.randomUUID()}`;
  }
  return `tbl_${Math.floor(performance.now() * 1000).toString(36)}`;
}

export function newSchemaTable(type: string, name = ""): SchemaTable {
  return { id: newSchemaTableId(), name, type };
}
