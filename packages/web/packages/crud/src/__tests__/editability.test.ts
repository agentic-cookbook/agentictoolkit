import { describe, it, expect } from 'vitest'
import {
  EDITABLE_OVERRIDES,
  isColumnEditable,
  isColumnHidden,
  isRelationalColumn,
} from '../editability'
import type { CrudColumn, CrudTableMeta } from '../types'

function col(name: string, extra: Partial<CrudColumn> = {}): CrudColumn {
  return { name, type: 'string', required: false, nullable: false, serverManaged: false, ...extra }
}

const meta: CrudTableMeta = {
  key: 'demo/widgets',
  schema: 'demo',
  table: 'widgets',
  basePath: '/demo/widgets',
  itemPath: '/demo/widgets/{id}',
  pkParams: ['id'],
  exposure: 'owner',
  columns: [],
}

describe('isRelationalColumn', () => {
  it('flags primary keys (any pkParams member)', () => {
    expect(isRelationalColumn({ ...meta, pkParams: ['code'] }, col('code'))).toBe(true)
  })
  it('flags id / rdid exact names', () => {
    expect(isRelationalColumn(meta, col('id'))).toBe(true)
    expect(isRelationalColumn(meta, col('rdid'))).toBe(true)
  })
  it('flags id-reference and rdid suffixes (camel + snake)', () => {
    for (const name of ['ownerId', 'owner_id', 'customerId', 'userId', 'personaRdid', 'src_rdid']) {
      expect(isRelationalColumn(meta, col(name)), name).toBe(true)
    }
  })
  it('leaves plain data columns relational-free', () => {
    for (const name of ['name', 'title', 'valid', 'count', 'rapid']) {
      expect(isRelationalColumn(meta, col(name)), name).toBe(false)
    }
  })
})

describe('isColumnEditable', () => {
  it('locks relational columns on edit but allows them on create (client-supplied key/FK)', () => {
    // A required client-supplied key must be settable when inserting the row, and
    // frozen once it exists — otherwise junction / client-keyed tables can't be created.
    expect(isColumnEditable(meta, col('ownerId'), 'edit')).toBe(false)
    expect(isColumnEditable(meta, col('ownerId', { required: true }), 'create')).toBe(true)
    expect(isColumnEditable({ ...meta, pkParams: ['code'] }, col('code'), 'create')).toBe(true)
    expect(isColumnEditable({ ...meta, pkParams: ['code'] }, col('code'), 'edit')).toBe(false)
  })
  it('never edits a relational column, even an override that says true', () => {
    const m: CrudTableMeta = { ...meta, key: 'demo/forced' }
    EDITABLE_OVERRIDES['demo/forced'] = { ownerId: true }
    try {
      // The override cannot govern a relational key — it stays create-only.
      expect(isColumnEditable(m, col('ownerId'), 'edit')).toBe(false)
    } finally {
      delete EDITABLE_OVERRIDES['demo/forced']
    }
  })
  it('locks server-managed columns in every mode, even with an override', () => {
    expect(isColumnEditable(meta, col('createdAt', { serverManaged: true }), 'edit')).toBe(false)
    const m: CrudTableMeta = { ...meta, key: 'demo/sm' }
    EDITABLE_OVERRIDES['demo/sm'] = { createdAt: true }
    try {
      // A server-managed column is off-limits (it's also hidden) — the override can't lift it.
      expect(isColumnEditable(m, col('createdAt', { serverManaged: true }), 'edit')).toBe(false)
      expect(isColumnEditable(m, col('createdAt', { serverManaged: true }), 'create')).toBe(false)
    } finally {
      delete EDITABLE_OVERRIDES['demo/sm']
    }
  })
  it('locks createOnly columns on edit but allows them on create', () => {
    const c = col('slug', { createOnly: true })
    expect(isColumnEditable(meta, c, 'edit')).toBe(false)
    expect(isColumnEditable(meta, c, 'create')).toBe(true)
  })
  it('edits a plain non-relational column', () => {
    expect(isColumnEditable(meta, col('name'), 'edit')).toBe(true)
  })
  it('honors an override on a non-relational column (both directions)', () => {
    const m: CrudTableMeta = { ...meta, key: 'demo/over' }
    EDITABLE_OVERRIDES['demo/over'] = { note: true, name: false }
    try {
      // forces an otherwise create-only column editable on edit
      expect(isColumnEditable(m, col('note', { createOnly: true }), 'edit')).toBe(true)
      // forces an otherwise-editable column read-only
      expect(isColumnEditable(m, col('name'), 'edit')).toBe(false)
    } finally {
      delete EDITABLE_OVERRIDES['demo/over']
    }
  })
})

describe('isColumnHidden', () => {
  it('hides server-managed columns only', () => {
    expect(isColumnHidden(col('id', { serverManaged: true }))).toBe(true)
    expect(isColumnHidden(col('name'))).toBe(false)
  })
})
