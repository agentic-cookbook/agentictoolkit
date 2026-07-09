// Buckets API client — wired to the real backend (generic CRUD over
// `bucket.buckets` + `bucket.bucket_types`).
//
// NOTE: this is the EXISTING (pre-FTD) data layer, mechanically repointed to the
// renamed routes/columns so the hub keeps compiling after the buckets DB redesign.
// The full Buckets UI (nesting via parent_id, kind, access groups) is Phase 2; the
// UI model names below (SchemaDefinition/SchemaTable) are unchanged for now.
//
// A bucket DEFINITION is a parent row plus its child bucket-type rows, so this client
// composes two endpoints:
//   /api/bucket/buckets       — the definition (id, owner, name, metadata)
//   /api/bucket/bucket-types  — one row per table (bucket-type) in the definition
//
// Field map:
//   UI SchemaDefinition.id           <->  buckets.id              (opaque uuid)
//   UI SchemaDefinition.name         <->  buckets.name            (unique per owner)
//   UI SchemaDefinition.description  <->  buckets.metadata.description
//   UI SchemaDefinition.ecosystemId  <->  buckets.ecosystem_id        (owner = the ecosystem)
//   UI SchemaTable.id                <->  bucket_types.id         (opaque uuid)
//   UI SchemaTable.name              <->  bucket_types.name       (alias, unique per bucket)
//   UI SchemaTable.type              <->  bucket_types.sql_table_name
//
// `bucket.buckets` is RDID-addressed, but the rdid is optional per row: this
// client never sends an `id`, so each bucket gets a plain uuid with no rdid
// mapping — exactly the opaque-id model the UI already assumes.
//
// NOTE: generic CRUD list has no server-side filter (it returns up to 500 rows),
// so list()/get() fetch all bucket-types and group them client-side. Fine at
// settings-page volume; revisit if a tenant ever exceeds ~500 bucket-types.
//
// The UI model types (SchemaDefinition/SchemaTable/SchemaDefinitionInput) are
// declared locally here (structurally identical to the hub's own
// components/settings/schemas/schema-model.ts, which the hub keeps importing
// UI code from directly) rather than imported — the toolkit can't reach into a
// hub-local component file, and TS's structural typing makes this client's
// return values assignable to the hub's types without any coupling.

import { authedJson, authedRequest, rethrowConflict } from "../http";
import { compact, enc, scopeByOwner, sortByText } from "../client-helpers";
import type {
  BucketRow,
  BucketCreateBody,
  BucketPutBody,
  BucketTypeRow,
  BucketTypeCreateBody,
} from "./wire";

/** One ADH table within a schema definition. Structure only. */
export interface SchemaTable {
  /** Stable client id for React keys / cross-referencing grants. */
  id: string;
  /** User-defined slug, e.g. "contacts" — no spaces. */
  name: string;
  /** The underlying sql-table type id (e.g. "personal.contacts"). */
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

const SCHEMAS = "/api/bucket/buckets";
const TABLES = "/api/bucket/bucket-types";

function descriptionOf(metadata: BucketRow["metadata"]): string {
  return metadata && typeof metadata.description === "string"
    ? metadata.description
    : "";
}

function toTable(r: BucketTypeRow): SchemaTable {
  return { id: r.id, name: r.name, type: r.sqlTableName };
}

function toDefinition(s: BucketRow, allTables: BucketTypeRow[]): SchemaDefinition {
  return {
    id: s.id,
    name: s.name,
    description: descriptionOf(s.metadata),
    tables: allTables.filter((t) => t.bucketId === s.id).map(toTable),
    ecosystemId: s.ecosystemId,
    kind: s.kind ?? "custom",
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/**
 * Reject duplicate table names up front. The backend has a unique
 * (bucket_id, name) index, so a colliding child insert would 409 mid-create —
 * after the parent schema (and earlier tables) already exist. Case-insensitive
 * to match the schema-name check. Throws on the first duplicate.
 */
function assertUniqueTableNames(tables: { name: string }[]): void {
  const seen = new Set<string>();
  for (const t of tables) {
    const key = t.name.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate table name "${t.name.trim()}" in this bucket.`);
    }
    seen.add(key);
  }
}

/**
 * Best-effort cleanup when a schema create half-fails (a child-table insert
 * threw). Generic CRUD has no cross-endpoint transaction, so delete whatever we
 * created — the child rows, then the parent — and swallow cleanup errors so the
 * ORIGINAL failure is what reaches the caller.
 */
async function rollbackSchema(
  bucketId: string,
  createdTables: BucketTypeRow[],
): Promise<void> {
  await Promise.allSettled([
    ...createdTables.map((t) =>
      authedRequest(`${TABLES}/${enc(t.id)}`, { method: "DELETE" }),
    ),
    authedRequest(`${SCHEMAS}/${enc(bucketId)}`, { method: "DELETE" }),
  ]);
}

export const schemasApi = {
  async list(ecosystemId?: string): Promise<SchemaDefinition[]> {
    const [schemaRows, tableRows] = await Promise.all([
      authedJson<BucketRow[]>(SCHEMAS),
      authedJson<BucketTypeRow[]>(TABLES),
    ]);
    return sortByText(
      scopeByOwner(schemaRows, ecosystemId, (s) => s.ecosystemId).map((s) =>
        toDefinition(s, tableRows),
      ),
      (d) => d.name,
    );
  },

  async get(id: string): Promise<SchemaDefinition | null> {
    try {
      const [s, tableRows] = await Promise.all([
        authedJson<BucketRow>(`${SCHEMAS}/${enc(id)}`),
        authedJson<BucketTypeRow[]>(`${TABLES}?bucketId=${enc(id)}`),
      ]);
      return toDefinition(s, tableRows);
    } catch {
      return null;
    }
  },

  async create(
    input: SchemaDefinitionInput,
    ecosystemId: string,
  ): Promise<SchemaDefinition> {
    const name = input.name.trim();
    // Catch a duplicate child name before creating anything (the unique
    // (schema, name) index would otherwise reject it mid-create).
    assertUniqueTableNames(input.tables);

    const schemaBody: BucketCreateBody = {
      name,
      metadata: { description: input.description },
    };
    // owner = the chosen ecosystem; absent, the backend defaults to the caller's.
    if (ecosystemId) schemaBody.ecosystemId = ecosystemId;
    // No pre-read for duplicates: the backend's unique (owner, name) index is the
    // real guard (and a pre-read can't see a soft-deleted row still holding the
    // name, plus it cost a full schemas+tables list()). Catch the 409 → friendly
    // message, consistent with the ecosystems/teams/applications clients.
    let schema: BucketRow;
    try {
      schema = await authedJson<BucketRow>(SCHEMAS, {
        method: "POST",
        body: JSON.stringify(schemaBody),
      });
    } catch (err) {
      rethrowConflict(err, `A bucket named "${name}" already exists.`);
    }

    // A schema definition is a parent + its child tables, but generic CRUD has no
    // transaction across the two endpoints. Insert the children sequentially so a
    // mid-way failure is recoverable: roll back what we created (children, then
    // the parent) and surface the original error rather than orphaning a
    // half-built schema.
    const createdTables: BucketTypeRow[] = [];
    try {
      for (const t of input.tables) {
        const tableBody: BucketTypeCreateBody = {
          bucketId: schema.id,
          ecosystemId: schema.ecosystemId,
          sqlTableName: t.type,
          name: t.name,
        };
        createdTables.push(
          await authedJson<BucketTypeRow>(TABLES, {
            method: "POST",
            body: JSON.stringify(tableBody),
          }),
        );
      }
    } catch (err) {
      await rollbackSchema(schema.id, createdTables);
      throw err;
    }
    return toDefinition(schema, createdTables);
  },

  async update(
    id: string,
    input: Partial<SchemaDefinitionInput>,
  ): Promise<SchemaDefinition> {
    const patch = compact({
      name: input.name?.trim(),
      metadata:
        input.description !== undefined ? { description: input.description } : undefined,
    } satisfies BucketPutBody);

    const schema = Object.keys(patch).length
      ? await authedJson<BucketRow>(`${SCHEMAS}/${enc(id)}`, {
          method: "PUT",
          body: JSON.stringify(patch),
        })
      : await authedJson<BucketRow>(`${SCHEMAS}/${enc(id)}`);

    if (input.tables !== undefined) {
      assertUniqueTableNames(input.tables);
      const allTables = await authedJson<BucketTypeRow[]>(`${TABLES}?bucketId=${enc(id)}`);
      const current = allTables.filter((t) => t.bucketId === id);
      const currentById = new Map(current.map((t) => [t.id, t]));
      const desiredIds = new Set(input.tables.map((t) => t.id));

      // Sequence the reconcile: DROP removed tables first and wait for them to
      // commit, THEN add/patch. Running both in one batch races the unique
      // (schema, name) index — e.g. renaming a table to a name freed by a delete
      // in the same batch could 409 if the insert lands before the delete.
      for (const t of current) {
        if (!desiredIds.has(t.id)) {
          await authedRequest(`${TABLES}/${enc(t.id)}`, { method: "DELETE" });
        }
      }
      // Add new tables / patch renamed-or-retyped ones. A table whose id isn't in
      // the backend set is new (the UI minted a client-side id for it).
      for (const t of input.tables) {
        const existing = currentById.get(t.id);
        if (!existing) {
          await authedJson<BucketTypeRow>(TABLES, {
            method: "POST",
            body: JSON.stringify({
              bucketId: id,
              ecosystemId: schema.ecosystemId,
              sqlTableName: t.type,
              name: t.name,
            }),
          });
        } else if (existing.name !== t.name || existing.sqlTableName !== t.type) {
          await authedJson<BucketTypeRow>(`${TABLES}/${enc(t.id)}`, {
            method: "PUT",
            body: JSON.stringify({ name: t.name, sqlTableName: t.type }),
          });
        }
      }
    }

    // Re-read so the response carries the backend's table ids (new rows got uuids).
    const finalTables = await authedJson<BucketTypeRow[]>(`${TABLES}?bucketId=${enc(id)}`);
    return toDefinition(schema, finalTables);
  },

  async delete(id: string): Promise<void> {
    // No DB-level cascade from buckets to bucket_types, so remove children first.
    const allTables = await authedJson<BucketTypeRow[]>(`${TABLES}?bucketId=${enc(id)}`);
    await Promise.all(
      allTables
        .filter((t) => t.bucketId === id)
        .map((t) => authedRequest(`${TABLES}/${enc(t.id)}`, { method: "DELETE" })),
    );
    await authedRequest(`${SCHEMAS}/${enc(id)}`, { method: "DELETE" });
  },
};
