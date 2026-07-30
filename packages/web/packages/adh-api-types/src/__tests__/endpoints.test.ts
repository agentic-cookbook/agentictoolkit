import { describe, expect, it } from 'vitest'
import { API_ENDPOINTS, API_SCHEMAS } from '@agentic-toolkit/api-explorer/generated/endpoints.generated'
import { ADH_SPEC_PATH, loadAdhSpec, skipNotice } from './adh-spec'

// Drift gate: the committed generated module must agree with the committed
// OpenAPI spec. When the backend surface changes (spec regenerated), these fail
// until `pnpm gen:api-endpoints` is rerun — without re-implementing the generator's full
// projection here (we re-derive only the facts a UI must not get wrong).

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

// adh's spec is an explicit input (see ./adh-spec) — it does not live in this
// repo. Unset means no adh checkout: the gate skips, loudly. The empty stub keeps
// collection-time helpers (specOperations() below) working in that state.
type Spec = {
  paths: Record<string, Record<string, unknown>>
  components?: { schemas?: Record<string, unknown> }
}
if (!ADH_SPEC_PATH) skipNotice('endpoint metadata drift gate')
const spec: Spec = ADH_SPEC_PATH ? loadAdhSpec<Spec>() : { paths: {} }

/** One-hop `#/...` ref resolve (params can be component refs). */
function deref(node: unknown): unknown {
  if (node && typeof node === 'object' && '$ref' in node) {
    const ref = (node as { $ref: unknown }).$ref
    if (typeof ref === 'string' && ref.startsWith('#/')) {
      let target: unknown = spec
      for (const part of ref.slice(2).split('/')) {
        if (!target || typeof target !== 'object') return node
        target = (target as Record<string, unknown>)[part]
      }
      return target
    }
  }
  return node
}

interface SpecOp {
  key: string
  path: string
  method: string
  op: Record<string, unknown>
  pathItem: Record<string, unknown>
}

function specOperations(): SpecOp[] {
  const out: SpecOp[] = []
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue
    for (const method of METHODS) {
      const op = pathItem[method]
      if (!op || typeof op !== 'object') continue
      out.push({ key: `${method.toUpperCase()} ${path}`, path, method: method.toUpperCase(), op: op as Record<string, unknown>, pathItem })
    }
  }
  return out
}

/** The set of `<in>:<name>` for the path+query params of a spec operation. */
function specParamKeys(specOp: SpecOp): Set<string> {
  const raw = [
    ...((specOp.pathItem['parameters'] as unknown[]) ?? []),
    ...((specOp.op['parameters'] as unknown[]) ?? []),
  ]
  const keys = new Set<string>()
  for (const entry of raw) {
    const param = deref(entry)
    if (!param || typeof param !== 'object') continue
    const { name, in: loc } = param as { name?: unknown; in?: unknown }
    if ((loc === 'path' || loc === 'query') && typeof name === 'string') keys.add(`${loc}:${name}`)
  }
  return keys
}

describe.skipIf(!ADH_SPEC_PATH)('generated endpoint metadata ↔ openapi.json drift gate', () => {
  const operations = specOperations()

  it('covers exactly the operations in the spec', () => {
    const expected = new Set(operations.map((o) => o.key))
    const actual = new Set(Object.keys(API_ENDPOINTS))
    expect(actual).toEqual(expected)
  })

  it('ships exactly the spec component schemas', () => {
    const expected = new Set(Object.keys(spec.components?.schemas ?? {}))
    const actual = new Set(Object.keys(API_SCHEMAS))
    expect(actual).toEqual(expected)
  })

  it('every entry is internally consistent (key = method+path)', () => {
    for (const [key, meta] of Object.entries(API_ENDPOINTS)) {
      expect(meta.key).toBe(key)
      expect(`${meta.method} ${meta.path}`).toBe(key)
      expect(meta.method).toBe(meta.method.toUpperCase())
    }
  })

  it('param names match the spec for every operation', () => {
    const bySpecKey = new Map(operations.map((o) => [o.key, o]))
    for (const meta of Object.values(API_ENDPOINTS)) {
      const specOp = bySpecKey.get(meta.key)
      expect(specOp, `${meta.key} missing from spec`).toBeDefined()
      const actual = new Set(meta.params.map((p) => `${p.in}:${p.name}`))
      expect(actual, `${meta.key} params drift — rerun pnpm gen:api-endpoints`).toEqual(specParamKeys(specOp!))
    }
  })

  it('response statuses match the spec for every operation', () => {
    const bySpecKey = new Map(operations.map((o) => [o.key, o]))
    for (const meta of Object.values(API_ENDPOINTS)) {
      const specOp = bySpecKey.get(meta.key)!
      const expected = new Set(Object.keys((specOp.op['responses'] as Record<string, unknown>) ?? {}).map(String))
      const actual = new Set(meta.responses.map((r) => r.status))
      expect(actual, `${meta.key} response statuses drift — rerun pnpm gen:api-endpoints`).toEqual(expected)
    }
  })

  it('family lists reference only real endpoints and include self', () => {
    for (const meta of Object.values(API_ENDPOINTS)) {
      expect(meta.family).toContain(meta.key)
      for (const sibling of meta.family) {
        expect(API_ENDPOINTS[sibling], `${meta.key} family → unknown ${sibling}`).toBeDefined()
      }
    }
  })

  it('spot-checks GET /persona/personas/{id} (the proof endpoint)', () => {
    const meta = API_ENDPOINTS['GET /persona/personas/{id}']
    expect(meta, 'persona read endpoint missing').toBeDefined()
    expect(meta!.params.some((p) => p.in === 'path' && p.name === 'id')).toBe(true)
    expect(meta!.responses.some((r) => r.status === '200')).toBe(true)
    expect(meta!.tag).toBe('persona')
    // Full CRUD family — related calls has all five plus the collection.
    expect(meta!.family).toEqual(
      expect.arrayContaining([
        'GET /persona/personas',
        'POST /persona/personas',
        'GET /persona/personas/{id}',
        'PUT /persona/personas/{id}',
        'DELETE /persona/personas/{id}',
      ]),
    )
  })
})
