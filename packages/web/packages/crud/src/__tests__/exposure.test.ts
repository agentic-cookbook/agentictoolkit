import { describe, it, expect } from 'vitest'
import { canReadTable, canWriteTable, readableTables } from '../exposure'
import type { CrudExposure, CrudTableMeta } from '../types'

const table = (name: string, exposure: CrudExposure): CrudTableMeta => ({
  key: `demo/${name}`,
  schema: 'demo',
  table: name,
  basePath: `/demo/${name}`,
  itemPath: `/demo/${name}/{id}`,
  pkParams: ['id'],
  exposure,
  columns: [],
})

const owner = table('widgets', 'owner')
const catalog = table('tiers', 'catalog')
const admin = table('audit', 'admin')

// These mirror the server gate (backend src/lib/permissions.ts hasPermission over
// TABLE_EXPOSURE). If the backend's rule changes, this table of cases is what has to
// change with it — the UI must not diverge into its own policy.
describe('canReadTable', () => {
  it('lets anyone read owner and catalog tiers', () => {
    for (const meta of [owner, catalog]) {
      expect(canReadTable(meta, false)).toBe(true)
      expect(canReadTable(meta, true)).toBe(true)
    }
  })

  it('reserves the admin tier to admins', () => {
    expect(canReadTable(admin, false)).toBe(false)
    expect(canReadTable(admin, true)).toBe(true)
  })

  // The server's hasPermission returns false for a table it cannot classify. So must this: a
  // meta whose tier is missing (a hand-built literal from JS, a stale prebuilt catalog) or a
  // stricter tier added later must NOT list to everyone by default.
  it('fails closed on a missing or unrecognised tier', () => {
    const untiered = { ...owner, exposure: undefined as unknown as CrudExposure }
    const future = { ...owner, exposure: 'sealed' as unknown as CrudExposure }
    for (const meta of [untiered, future]) {
      expect(canReadTable(meta, false)).toBe(false)
      expect(canWriteTable(meta, false)).toBe(false)
    }
    expect(readableTables([owner, untiered, future], false).map((t) => t.exposure)).toEqual([
      'owner',
    ])
  })
})

describe('canWriteTable', () => {
  it('lets anyone write an owner table (rows are tenant-isolated server-side)', () => {
    expect(canWriteTable(owner, false)).toBe(true)
    expect(canWriteTable(owner, true)).toBe(true)
  })

  it('reserves catalog and admin writes to admins', () => {
    for (const meta of [catalog, admin]) {
      expect(canWriteTable(meta, false)).toBe(false)
      expect(canWriteTable(meta, true)).toBe(true)
    }
  })

  // Readable-but-not-writable is the whole reason CrudDataView has a read-only mode; if this
  // ever collapses into read===write the mode is dead code and the assertion should go with it.
  it('has a readable-but-not-writable tier', () => {
    expect(canReadTable(catalog, false)).toBe(true)
    expect(canWriteTable(catalog, false)).toBe(false)
  })
})

describe('readableTables', () => {
  it('drops admin tables for a non-admin and keeps input order', () => {
    expect(readableTables([owner, admin, catalog], false).map((t) => t.key)).toEqual([
      'demo/widgets',
      'demo/tiers',
    ])
  })

  it('keeps everything for an admin', () => {
    expect(readableTables([owner, admin, catalog], true)).toHaveLength(3)
  })

  it('handles an all-admin list without inventing an entry', () => {
    expect(readableTables([admin], false)).toEqual([])
  })
})
