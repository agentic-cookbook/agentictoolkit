// Server-side BFF proxy for sites that forward `/api/*` and `/auth/*` to the
// shared backend through a Next Route Handler rather than next.config rewrites.
//
// Route Handlers are required where rewrites can't preserve auth: OpenNext on
// Cloudflare Workers calls fetch with `redirect: "follow"` by default, which
// silently follows the backend's OAuth 302 and discards its Set-Cookie. Here we
// force `redirect: "manual"` so 302s and Set-Cookie reach the browser verbatim.
// Vercel sites that proxy via next.config rewrites don't need this.

const PROD_DATA_API = 'https://api.agenticdeveloperhub.com'

/** Resolve the backend base URL: `API_BACKEND_URL`, else the shared data API in
 *  production / localhost in dev. */
export function resolveBackendUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.API_BACKEND_URL) return env.API_BACKEND_URL
  return env.NODE_ENV === 'production' ? PROD_DATA_API : 'http://localhost:3000'
}

/**
 * Forward one request to the backend. The browser-facing `/api/*` BFF namespace
 * maps to the backend root (the backend dropped its `/api` route prefix); the
 * `/auth/*` namespace (Hydra OIDC) maps 1:1.
 */
export async function proxyToBackend(
  req: Request,
  prefix: 'auth' | 'api',
  path: string[],
): Promise<Response> {
  const backend = resolveBackendUrl()
  const forwardPrefix = prefix === 'api' ? '' : `${prefix}/`
  const target = `${backend}/${forwardPrefix}${path.join('/')}${new URL(req.url).search}`
  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('content-length')
  const init: RequestInit = { method: req.method, headers, redirect: 'manual' }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }
  return fetch(target, init)
}

type RouteContext = { params: Promise<{ path: string[] }> }
type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>

/**
 * Build the `{ GET, POST, PUT, PATCH, DELETE }` handlers for a catch-all
 * `app/<prefix>/[...path]/route.ts`. A site's route file is then just:
 *
 *   import { makeProxyHandlers } from '@agentic-toolkit/auth/server'
 *   export const dynamic = 'force-dynamic'
 *   export const { GET, POST, PUT, PATCH, DELETE } = makeProxyHandlers('api')
 */
export function makeProxyHandlers(
  prefix: 'auth' | 'api',
): Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RouteHandler> {
  const handle: RouteHandler = async (req, ctx) => {
    const { path } = await ctx.params
    return proxyToBackend(req, prefix, path)
  }
  return { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle }
}
