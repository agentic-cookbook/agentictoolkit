// Per-column editability for the /all-data split table editor. Pure, React-free,
// unit-testable: the row-details pane (CrudDataView) asks it which columns get an
// input and which render as locked, read-only text.

import type { CrudColumn, CrudTableMeta } from './types'

export type EditableMode = 'create' | 'edit'

/**
 * Per-table editability overrides, keyed by `meta.key` ('<schema>/<table>') then
 * column name. A value FORCES an otherwise-editable column read-only (`false`) or
 * an otherwise-read-only column editable (`true`), winning over the create-only
 * default.
 *
 * It governs NON-relational, NON-server-managed columns only. It cannot make a
 * relational key (rule 3 of {@link isColumnEditable} owns those) nor a
 * server-managed column (rule 1) editable — those classifications also drive
 * visibility ({@link isColumnHidden}), so letting an override contradict them
 * would render an input the payload builder then silently drops.
 *
 * Empty for now (every table uses the default rules); populate as specific
 * columns need forcing, e.g.:
 *
 * ```ts
 * export const EDITABLE_OVERRIDES: EditableOverrides = {
 *   'persona/personas': { slug: false },  // computed elsewhere — lock the input
 * }
 * ```
 */
export type EditableOverrides = Record<string, Record<string, boolean>>
export const EDITABLE_OVERRIDES: EditableOverrides = {}

/** Exact column names that always denote an id reference (no suffix to match). */
const ID_REF_NAMES = new Set([
  'id',
  'rdid',
  'ownerId',
  'owner_id',
  'customerId',
  'customer_id',
  'accountId',
  'userId',
])

/** Name-suffix convention for foreign-key / ownership / rdid id references:
 *  `somethingId`, `something_id`, `somethingRdid`, `something_rdid`. */
const ID_REF_SUFFIX = /(Id|_id|Rdid|_rdid)$/

/**
 * A column that addresses a row (its own primary key) or references another
 * row's identity (a foreign key, ownership ref, or rdid). These are NEVER hand
 * editable in the table editor — the hard floor {@link isColumnEditable} enforces
 * first, above even an override.
 */
export function isRelationalColumn(meta: CrudTableMeta, column: CrudColumn): boolean {
  if (meta.pkParams.includes(column.name)) return true
  if (ID_REF_NAMES.has(column.name)) return true
  return ID_REF_SUFFIX.test(column.name)
}

/**
 * Whether a column may be edited in the given mode. Precedence:
 *
 *   1. Server-managed columns are NEVER hand-editable — the server assigns them
 *      (generated ids, timestamps, audit fields), in any mode. They are also
 *      hidden from the detail pane ({@link isColumnHidden}); the two agree.
 *   2. A per-table {@link EDITABLE_OVERRIDES} entry (non-relational columns only)
 *      forces the column editable or read-only, over the create-only default.
 *   3. Relational columns (PK / FK / ownership / rdid reference) are editable
 *      ONLY when CREATING a row — the client must supply the key/reference to
 *      insert it — and never when editing an existing row, where re-pointing a
 *      key would orphan or corrupt data. (Server-GENERATED keys already returned
 *      at rule 1.)
 *   4. create-only columns lock once the row exists (the backend strips them from PUT).
 *   5. Otherwise editable.
 */
export function isColumnEditable(
  meta: CrudTableMeta,
  column: CrudColumn,
  mode: EditableMode,
): boolean {
  // 1. Server-managed — the server owns the value; never editable, in any mode.
  if (column.serverManaged) return false
  // 2. Override (non-relational only): force editable (true) or read-only (false).
  //    A relational column is governed by rule 3, not by the override map.
  const override = EDITABLE_OVERRIDES[meta.key]?.[column.name]
  if (override !== undefined && !isRelationalColumn(meta, column)) return override
  // 3. Relational key/reference: supply it on create, immutable on edit.
  if (isRelationalColumn(meta, column)) return mode === 'create'
  // 4. create-only columns lock on edit.
  if (mode === 'edit' && column.createOnly === true) return false
  // 5. Otherwise editable.
  return true
}

/**
 * Columns hidden from the detail editor by default — server-managed ids,
 * timestamps, and audit fields. They still appear in the read-only row LIST
 * (top pane); the detail pane's column:value list omits them.
 */
export function isColumnHidden(column: CrudColumn): boolean {
  return column.serverManaged === true
}
