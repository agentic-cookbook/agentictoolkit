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
  columns: CrudColumn[]
}

/** A row as served by the generic CRUD API. */
export type CrudRow = Record<string, unknown>
