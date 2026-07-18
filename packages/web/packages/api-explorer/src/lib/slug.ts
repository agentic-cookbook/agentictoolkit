/**
 * URL slugs for the server-rendered API reference — one crawlable route per endpoint.
 *
 * An endpoint's map key is `"<METHOD> <path>"` (e.g. `"GET /persona/personas/{id}"`); a slug is
 * that projected to clean, URL-safe path segments plus the lower-cased method last, so the reference
 * URLs mirror the real API shape: `GET /persona/personas/{id}` → `persona/personas/id/get`. Path
 * params (`{id}`) drop their braces. The slug↔key maps are built once from the generated metadata,
 * asserting the projection is collision-free (it is for this API; the assert fails fast if a future
 * spec introduces a literal-vs-param clash).
 */
import { API_ENDPOINTS } from '../generated/endpoints.generated'
import type { EndpointMeta } from '../types'

/** Every endpoint's projected slug segments: path parts (`{id}`→`id`) then the method. */
export function endpointSlug(meta: EndpointMeta): string[] {
  const parts = meta.path
    .split('/')
    .filter((s) => s !== '')
    .map((s) => s.replace(/\{([^}]+)\}/g, '$1'))
  return [...parts, meta.method.toLowerCase()]
}

let _slugToKey: Map<string, string> | null = null

function slugIndex(): Map<string, string> {
  if (!_slugToKey) {
    _slugToKey = new Map()
    for (const meta of Object.values(API_ENDPOINTS)) {
      const slug = endpointSlug(meta).join('/')
      const existing = _slugToKey.get(slug)
      if (existing && existing !== meta.key) {
        throw new Error(`api-explorer: endpoint slug collision on "${slug}" (${existing} vs ${meta.key})`)
      }
      _slugToKey.set(slug, meta.key)
    }
  }
  return _slugToKey
}

/** Resolve a route's slug segments back to endpoint metadata, or `undefined` if none matches. */
export function endpointForSlug(slug: string[]): EndpointMeta | undefined {
  const key = slugIndex().get(slug.join('/'))
  return key ? API_ENDPOINTS[key] : undefined
}

/** Every endpoint, in stable key order — the enumerable set of reference routes to prerender. */
export function allEndpoints(): EndpointMeta[] {
  return Object.values(API_ENDPOINTS)
}
