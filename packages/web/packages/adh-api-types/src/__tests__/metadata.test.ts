import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { CRUD_TABLES, CRUD_SCHEMAS } from '@agentic-toolkit/crud'
import { ADH_SPEC_PATH, loadAdhSpec, skipNotice } from './adh-spec'

// Drift gate: the committed generated module must agree with the committed
// OpenAPI spec in BOTH directions. When the backend schema changes (spec
// regenerated), this fails until `pnpm gen:crud-metadata` is rerun — without re-implementing
// the generator's projection logic here.

// Single source of truth, shared with tools/gen_table_metadata.py: the schemas
// whose generic-CRUD tables the hub edits. The generator and this drift gate read
// the SAME list (allowed-schemas.json) so they can't drift apart.
const ALLOWED_SCHEMAS = new Set<string>(
  JSON.parse(readFileSync(resolve(process.cwd(), 'allowed-schemas.json'), 'utf8')) as string[],
)

type SpecOps = Record<string, unknown>

// Mirror of gen_table_metadata.py's HAND_WRITTEN_BASES: collection paths that
// match the generic-CRUD signature but are hand-written routes the backend
// excludes from generic CRUD (src/crud/policy.ts). Both the generator and this
// gate must drop them, or the two disagree.
const HAND_WRITTEN_BASES = new Set<string>([
  '/content/markdown',
  '/discussion/topics',
  '/discussion/posts',
  '/persona/provider-templates',
])

// adh's spec is an explicit input (see ./adh-spec) — it does not live in this
// repo. Unset means no adh checkout: the gate skips, loudly. The empty stub keeps
// collection-time helpers working in that state.
type Spec = { paths: Record<string, SpecOps> }
if (!ADH_SPEC_PATH) skipNotice('CRUD table metadata drift gate')
const spec: Spec = ADH_SPEC_PATH ? loadAdhSpec<Spec>() : { paths: {} }

/** Optional-chaining walk into the untyped spec — a layout shift returns
 *  undefined for the caller to assert on with a named message, instead of a
 *  bare TypeError mid-dig. */
function dig(obj: unknown, ...keys: string[]): unknown {
  let node: unknown = obj
  for (const key of keys) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[key]
  }
  return node
}

const bodyProps = (op: unknown): unknown =>
  dig(op, 'requestBody', 'content', 'application/json', 'schema', 'properties')

/** Spec paths that carry the full generic-CRUD signature, per schema allowlist. */
function specCrudBases(): string[] {
  const bases: string[] = []
  for (const [path, ops] of Object.entries(spec.paths)) {
    if (HAND_WRITTEN_BASES.has(path)) continue
    const match = /^\/([a-z-]+)\/([a-z-]+)$/.exec(path)
    if (!match || !ALLOWED_SCHEMAS.has(match[1]!)) continue
    if (!('get' in ops) || !('post' in ops)) continue
    const itemRe = new RegExp(`^${path.replace(/[/-]/g, '\\$&')}(/\\{[a-zA-Z0-9_]+\\})+$`)
    const items = Object.entries(spec.paths).filter(
      ([p, o]) => itemRe.test(p) && 'get' in o && 'put' in o && 'delete' in o,
    )
    if (items.length === 1) bases.push(path)
  }
  return bases
}

describe.skipIf(!ADH_SPEC_PATH)('generated table metadata ↔ openapi.json drift gate', () => {
  it('covers every generic CRUD table in the allowlisted schemas', () => {
    const expected = new Set(specCrudBases())
    const actual = new Set(Object.values(CRUD_TABLES).map((t) => t.basePath))
    expect(actual).toEqual(expected)
  })

  it('every entry has its five operations in the spec', () => {
    for (const table of Object.values(CRUD_TABLES)) {
      const base = spec.paths[table.basePath]
      const item = spec.paths[table.itemPath]
      expect(base, `${table.key} base path missing from spec`).toBeDefined()
      expect(item, `${table.key} item path missing from spec`).toBeDefined()
      expect('get' in base! && 'post' in base!).toBe(true)
      expect('get' in item! && 'put' in item! && 'delete' in item!).toBe(true)
    }
  })

  it('is internally consistent (keys, paths, pk params, column names)', () => {
    for (const [key, table] of Object.entries(CRUD_TABLES)) {
      expect(table.key).toBe(key)
      expect(table.basePath).toBe(`/${table.schema}/${table.table}`)
      expect(table.itemPath.startsWith(`${table.basePath}/`)).toBe(true)
      expect(table.pkParams.length).toBeGreaterThan(0)
      const names = new Set(table.columns.map((c) => c.name))
      expect(names.size).toBe(table.columns.length)
      // every single-pk table keys rows by a real column; composite path params
      // (threadId/srcId/…) must be row fields too
      for (const param of table.pkParams) {
        expect(names.has(param), `${key} pk param ${param} must be a column`).toBe(true)
      }
    }
  })

  it('column names match each table\'s spec row schema (catches renames)', () => {
    for (const table of Object.values(CRUD_TABLES)) {
      const props = dig(
        spec.paths[table.basePath],
        'get', 'responses', '200', 'content', 'application/json', 'schema', 'items', 'properties',
      )
      expect(props, `${table.key} row schema missing — spec layout shifted?`).toBeDefined()
      expect(
        table.columns.map((c) => c.name).sort(),
        `${table.key} columns drift from the spec — rerun pnpm gen:crud-metadata`,
      ).toEqual(Object.keys(props as Record<string, unknown>).sort())
    }
  })

  it('createOnly matches POST-minus-PUT body properties for every table', () => {
    for (const table of Object.values(CRUD_TABLES)) {
      const createProps = bodyProps(dig(spec.paths[table.basePath], 'post'))
      const updateProps = bodyProps(dig(spec.paths[table.itemPath], 'put'))
      expect(createProps, `${table.key} create body missing — spec layout shifted?`).toBeDefined()
      expect(updateProps, `${table.key} update body missing — spec layout shifted?`).toBeDefined()
      const create = new Set(Object.keys(createProps as Record<string, unknown>))
      const update = new Set(Object.keys(updateProps as Record<string, unknown>))
      for (const column of table.columns) {
        expect(
          column.createOnly === true,
          `${table.key}.${column.name} createOnly drifts from the spec — rerun pnpm gen:crud-metadata`,
        ).toBe(create.has(column.name) && !update.has(column.name))
      }
    }
  })

  // The exposure tier the UI filters on is generated from the backend's `x-exposure`, which is
  // itself emitted from the TABLE_EXPOSURE map the runtime gate enforces. Drift here means the
  // browser offers a table (or a write) the server will refuse — or, worse, hides one it allows.
  it('exposure matches the spec x-exposure for every table', () => {
    for (const table of Object.values(CRUD_TABLES)) {
      const tier = dig(spec.paths[table.basePath], 'x-exposure')
      expect(tier, `${table.key} has no x-exposure — rerun the backend's openapi:dump`).toBeDefined()
      expect(['owner', 'catalog', 'admin']).toContain(tier)
      expect(
        table.exposure,
        `${table.key} exposure drifts from the spec — rerun pnpm gen:crud-metadata`,
      ).toBe(tier)
    }
  })

  // Spot-check one table per tier, so a wholesale mis-classification (e.g. everything emitted as
  // 'owner') can't pass the drift test above by being wrong identically on both sides.
  it('spot-checks a table of each exposure tier', () => {
    expect(CRUD_TABLES['system/audit-events']?.exposure).toBe('admin')
    expect(CRUD_TABLES['billing/subscription-tiers']?.exposure).toBe('catalog')
    expect(CRUD_TABLES['persona/personas']?.exposure).toBe('owner')
  })

  it('spot-checks persona/personas: id is client-supplied on create only', () => {
    const id = CRUD_TABLES['persona/personas']?.columns.find((c) => c.name === 'id')
    expect(id?.createOnly).toBe(true)
    expect(id?.serverManaged).toBe(false)
  })

  it('spot-checks billing/subscription-tiers shapes', () => {
    const tiers = CRUD_TABLES['billing/subscription-tiers']!
    const byName = new Map(tiers.columns.map((c) => [c.name, c]))
    expect(byName.get('key')?.required).toBe(true)
    expect(byName.get('name')?.required).toBe(true)
    expect(byName.get('id')?.serverManaged).toBe(true)
    expect(byName.get('createdAt')?.serverManaged).toBe(true)
    expect(byName.get('isActive')?.type).toBe('boolean')
    expect(byName.get('displayOrder')?.type).toBe('integer')
    expect(byName.get('description')?.nullable).toBe(true)
  })

  it('keeps policy-excluded tables out (services, attachments, owner-scoped feed, sessions)', () => {
    // Each key MUST be a table in an allowed (hub-exposed) schema that policy
    // nonetheless excludes — otherwise the assertion is vacuous (a key in a
    // non-allowlisted schema can never appear regardless of policy). content,
    // personal, persona, and customer are all in allowed-schemas.json.
    for (const key of [
      'persona/services', // holds a plaintext api_key
      'content/attachments', // object-lifecycle owned by the storage route
      'content/markdown', // append-only versioned storage; hand-written REST surface
      'content/feed', // owner-scoped activity feed (peer read/forge otherwise)
      'customer/auth-methods',
      'customer/sessions',
      'customer/contact-methods', // verification + 2FA stores (code/credential material)
      'customer/verification-codes',
      'customer/totp-credentials',
      'customer/webauthn-credentials',
      'customer/recovery-codes',
    ]) {
      expect(CRUD_TABLES[key], `${key} must not be CRUD-exposed`).toBeUndefined()
    }
  })

  // Composite-PK tables are back (usage/principal-tiers keys on scope+principalId,
  // usage/usage-counters on scope+principalId+periodStart), so this is no longer a
  // single-key catalog. No dedicated assertion is needed: the param-match test above
  // already proves every pkParam is a real row column whatever the arity, and the
  // client handles both (buildItemPath/rowKey walk pkParams in order — only
  // CrudDataView's cross-ecosystem move is single-pk gated, by design).
  it('composite-PK tables key on real row columns', () => {
    const composite = Object.values(CRUD_TABLES).filter((t) => t.pkParams.length > 1)
    expect(composite.length, 'expected the usage.* composite-key tables').toBeGreaterThan(0)
    for (const table of composite) {
      const names = new Set(table.columns.map((c) => c.name))
      for (const param of table.pkParams) {
        expect(names.has(param), `${table.key} pk param ${param} must be a column`).toBe(true)
      }
    }
  })

  // Lockstep gate (half 1 of 2; the other half lives in the hub's
  // feature-routes.test.ts). allowed-schemas.json is hand-maintained alongside the
  // hub's feature schemas[]; a schema rename must touch both. This catches a STALE
  // or TYPO'd allowlist entry — one that exposes no generic-CRUD table at all (e.g.
  // a pre-rename name left behind) — which would otherwise generate nothing and
  // pass silently because no feature happens to reference it.
  it('every allowed schema exposes at least one generic-CRUD table', () => {
    for (const schema of ALLOWED_SCHEMAS) {
      expect(
        CRUD_SCHEMAS.has(schema),
        `'${schema}' is in allowed-schemas.json but exposes no CRUD table — a stale/typo allowlist entry (rename it or remove it)`,
      ).toBe(true)
    }
  })
})
