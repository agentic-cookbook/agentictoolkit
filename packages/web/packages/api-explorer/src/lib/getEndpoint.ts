import { API_ENDPOINTS } from '../generated/endpoints.generated'
import type { EndpointMeta, EndpointRef } from '../types'

/** The map key for a method+path reference (`"GET /persona/personas/{id}"`). */
export function endpointKey(ref: EndpointRef | string): string {
  if (typeof ref === 'string') return ref
  return `${ref.method.toUpperCase()} ${ref.path}`
}

/** Look up generated metadata for an endpoint, by ref or by raw key. */
export function getEndpoint(ref: EndpointRef | string): EndpointMeta | undefined {
  return API_ENDPOINTS[endpointKey(ref)]
}

const METHOD_ORDER: Record<string, number> = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 }

// Computed once — the generated map is a module constant, so these never change.
let _tags: string[] | null = null
let _byTag: Map<string, EndpointMeta[]> | null = null

function index(): Map<string, EndpointMeta[]> {
  if (!_byTag) {
    _byTag = new Map()
    for (const meta of Object.values(API_ENDPOINTS)) {
      const tag = meta.tag ?? 'other'
      const list = _byTag.get(tag) ?? []
      list.push(meta)
      _byTag.set(tag, list)
    }
    for (const list of _byTag.values()) {
      list.sort(
        (a, b) => a.path.localeCompare(b.path) || (METHOD_ORDER[a.method] ?? 9) - (METHOD_ORDER[b.method] ?? 9),
      )
    }
  }
  return _byTag
}

/** All endpoint tags, sorted — the top level of the API browser. */
export function allTags(): string[] {
  if (!_tags) _tags = [...index().keys()].sort()
  return _tags
}

/** Endpoints under a tag, sorted by path then method (collection before item). */
export function endpointsForTag(tag: string): EndpointMeta[] {
  return index().get(tag) ?? []
}
