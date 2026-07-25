// The metadata contract between the generated table descriptors
// (src/generated/table-metadata.ts, emitted by scripts/gen_table_metadata.py
// from the backend OpenAPI spec) and the CRUD components/hook.

export type CrudColumnType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'unknown'

export interface CrudColumn {
  /** camelCase JSON field name, exactly as served by the API. */
  name: string
  type: CrudColumnType
  /** Required in the create body. */
  required: boolean
  nullable: boolean
  /** Present on rows but not accepted on create/update (id, timestamps, …). */
  serverManaged: boolean
  /** Present in the create body but stripped by the backend on update
   *  (client-supplied rdids) — edit forms must disable and skip it. */
  createOnly?: boolean
  /** Allowed values, when the column is an enum. */
  enum?: string[]
  maxLength?: number
}

/**
 * A table's authorization tier, as the backend documents it (`x-exposure` on the collection
 * path) from the same map its runtime gate enforces:
 *
 *   - `owner`   — any authenticated principal; rows are isolated to the caller's tenant
 *                 server-side, so the whole table is readable and writable here.
 *   - `catalog` — a global catalog or a server-written ledger: readable by anyone
 *                 authenticated, writable only by an admin.
 *   - `admin`   — readable AND writable only by an admin.
 *
 * The UI consumes this to present the surface the viewer may actually use (hide admin-only
 * tables, render catalog tables read-only) instead of letting them discover it as a 403.
 * It is NOT a security boundary — the server-side check is, and it runs regardless.
 */
export type CrudExposure = 'owner' | 'catalog' | 'admin'

export interface CrudTableMeta {
  /** '<schema>/<table>' in URL (kebab) form, e.g. 'billing/subscription-tiers'. */
  key: string
  /** URL schema segment (kebab), e.g. 'persona-memory'. */
  schema: string
  /** URL table segment (kebab), e.g. 'subscription-tiers'. */
  table: string
  /** Collection REST path on the backend (no /api prefix), e.g. '/billing/subscription-tiers'. */
  basePath: string
  /** Item path template, e.g. '/billing/subscription-tiers/{id}'. */
  itemPath: string
  /** itemPath's params in order — also the row fields holding the primary key. */
  pkParams: string[]
  /** Who may reach this table, per the backend — see {@link CrudExposure}. Required, with no
   *  default: guessing would either hide a usable table or offer an unusable one. */
  exposure: CrudExposure
  columns: CrudColumn[]
}

/** A row as served by the generic CRUD API. */
export type CrudRow = Record<string, unknown>
