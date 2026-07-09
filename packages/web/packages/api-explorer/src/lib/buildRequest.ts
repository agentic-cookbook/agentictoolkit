/**
 * Turns endpoint metadata + the user's form values into a concrete request, and
 * executes it. Calls go SAME-ORIGIN to `/api/<path>`; the site's BFF proxy strips
 * `/api` and forwards to the backend (which is unprefixed). The bearer is attached
 * by the caller (from useAuth) so the call runs as the logged-in user.
 */
import type { EndpointMeta } from '../types'

/** Same-origin base: the per-site BFF proxy that strips `/api` → backend root. */
export const API_BASE = '/api'

export interface RequestValues {
  pathValues: Record<string, string>
  queryValues: Record<string, string>
  /** Raw JSON request-body text (for endpoints that declare a body). */
  body?: string
}

export interface BuiltRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface ApiResult {
  status: number
  statusText: string
  ok: boolean
  headers: [string, string][]
  contentType: string | null
  bodyText: string
  durationMs: number
}

/** Substitute `{param}` placeholders; leave unfilled ones visible so the user
 *  sees what's missing rather than getting a silently wrong URL. */
export function substitutePath(path: string, pathValues: Record<string, string>): string {
  return path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = pathValues[name]
    return value != null && value !== '' ? encodeURIComponent(value) : `{${name}}`
  })
}

export function bodyAllowed(meta: EndpointMeta): boolean {
  return meta.requestBody != null
}

export function buildRequest(meta: EndpointMeta, values: RequestValues, token?: string | null): BuiltRequest {
  const path = substitutePath(meta.path, values.pathValues)
  const query = new URLSearchParams()
  for (const param of meta.params) {
    if (param.in !== 'query') continue
    const value = values.queryValues[param.name]
    if (value != null && value !== '') query.set(param.name, value)
  }
  const qs = query.toString()
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  const hasBody = bodyAllowed(meta) && values.body != null && values.body.trim() !== ''
  const headers: Record<string, string> = {}
  if (hasBody) headers['Content-Type'] = meta.requestBody?.contentType ?? 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  return { url, method: meta.method, headers, body: hasBody ? values.body : undefined }
}

/** Execute the request, returning a normalized result for ANY status (never
 *  throws on a non-2xx) so error bodies (401/404/…) render just like successes. */
export async function executeRequest(req: BuiltRequest): Promise<ApiResult> {
  const start = performance.now()
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const bodyText = await res.text()
  return {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    headers: [...res.headers.entries()],
    contentType: res.headers.get('content-type'),
    bodyText,
    durationMs: Math.round(performance.now() - start),
  }
}

/** Mutating verbs modify real data as the logged-in user — gated behind a confirm. */
export function isMutating(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}
