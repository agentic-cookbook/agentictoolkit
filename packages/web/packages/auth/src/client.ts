'use client'

import { refreshAccessToken } from './refresh'
import { readAccessToken, tokensFromResponse, type BackendTokenFields } from './tokens'
import type { AuthTokens, AuthUser } from './types'

export { tokensFromResponse, readAccessToken, type BackendTokenFields } from './tokens'

// Injected by the host so its telemetry fetch-wrapper can tag the physical
// RequestInit this client retries after a refresh (or the exchange retry after a
// network drop). The marker and its consumer must share one identity-keyed
// WeakSet, so the host's function is injected rather than reimplemented here —
// the same registered-hook pattern as report.ts's setAuthErrorReporter. No-op
// until a host wires it; untagged telemetry is the only cost.
let retryMarker: ((init: object) => void) | null = null

/** Wire the host's retried-request marker (e.g. @adh-shared/adh's
 *  `markRetriedRequest`). Pass null to unregister. */
export function setAuthRetryMarker(fn: ((init: object) => void) | null): void {
  retryMarker = fn
}

function markRetriedRequest(init: object): void {
  retryMarker?.(init)
}

/** Default same-origin exchange endpoint (the BFF proxy → backend). */
export const DEFAULT_EXCHANGE_PATH = '/api/oauth/signin/exchange'

/** Pause before the single network-failure retry in {@link exchangeSsoCode} —
 *  long enough for a dropped connection to re-establish, short enough that the
 *  callback page doesn't feel hung (and well inside the exchange code's TTL). */
const EXCHANGE_NETWORK_RETRY_DELAY_MS = 750

/** Thrown by authedFetch on a non-ok HTTP response, carrying the status so
 *  callers can tell a dead session (401, after the one refresh+retry) from a
 *  transient backend failure (5xx) and react differently — e.g. the bootstrap
 *  revalidation keeps a session on a 5xx but drops it on a 401. Extends Error,
 *  so existing `catch`/`.message` consumers are unaffected. */
export class AuthHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Machine-readable error code from the backend body (`error.code` or
     *  top-level `code`), when present — so callers can branch on a stable code
     *  instead of matching the human message. */
    readonly code?: string,
  ) {
    super(message)
    this.name = 'AuthHttpError'
  }
}

/**
 * Trade a one-time SSO exchange `code` (handed back by the authorization server
 * in the callback fragment) for a session. The single place both the dedicated
 * {@link AuthCallback} page and the in-place AuthProvider handler exchange a
 * code, so the request shape lives once. Throws {@link AuthHttpError} (carrying the
 * status + machine code) on failure, so callers can tell an expected 4xx (a stale /
 * invalid code) from a 5xx backend failure worth reporting.
 */
export async function exchangeSsoCode(
  code: string,
  exchangePath: string = DEFAULT_EXCHANGE_PATH,
): Promise<{ tokens: AuthTokens; user: AuthUser }> {
  const attempt = (retried: boolean): Promise<Response> => {
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }
    if (retried) markRetriedRequest(init)
    return fetch(exchangePath, init)
  }
  let res: Response
  try {
    res = await attempt(false)
  } catch {
    // Network-level failure: fetch rejected, so no HTTP response ever arrived and
    // the one-time code was NOT consumed by a request that reached the backend —
    // a single short-pause retry can still redeem it. If the first request DID
    // reach the backend and only its response was lost, the retry 401s
    // ("invalid or expired exchange code"), which is the same dead end the user
    // hit without a retry — so this can only improve the outcome, never mint a
    // second session. An HTTP error (the `!res.ok` below) is never retried: the
    // code is spent and a re-POST cannot help.
    await new Promise((r) => setTimeout(r, EXCHANGE_NETWORK_RETRY_DELAY_MS))
    res = await attempt(true)
  }
  if (!res.ok) {
    // Read the body once for both the message and the machine code (see authedFetch).
    const body = await res.json().catch(() => null)
    throw new AuthHttpError(res.status, extractErrorMessage(body, 'Sign-in failed'), extractErrorCode(body))
  }
  const data = (await res.json()) as BackendTokenFields & { user: AuthUser }
  return { tokens: tokensFromResponse(data), user: data.user }
}

export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const obj = body as { error?: unknown; message?: unknown; title?: unknown }
    if (typeof obj.error === 'string') return obj.error
    // Nested { error: { message } } (the backend's structured error shape).
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as { message?: unknown }
      if (typeof nested.message === 'string') return nested.message
    }
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.title === 'string') return obj.title
  }
  return fallback
}

/** Pull a machine error code from `{ error: { code } }` or a top-level `code`. */
export function extractErrorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const obj = body as { error?: unknown; code?: unknown }
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as { code?: unknown }
      if (typeof nested.code === 'string') return nested.code
    }
    if (typeof obj.code === 'string') return obj.code
  }
  return undefined
}

export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return extractErrorMessage(body, fallback)
}

async function rawFetch(
  url: string,
  init: RequestInit,
  token: string | null,
  retried = false,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (init.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  // Build the final init here, so mark the *exact* object handed to fetch (the spread
  // makes a fresh object) — lets the telemetry fetch wrapper tag this physical request
  // as the post-refresh retry that paid the auth waterfall.
  const finalInit: RequestInit = { ...init, headers }
  if (retried) markRetriedRequest(finalInit)
  return fetch(url, finalInit)
}

/**
 * The Bearer-authed fetch the JSON helpers are built on, exposed for callers
 * that need the raw {@link Response} rather than a parsed body — e.g. consuming
 * a streaming `text/event-stream` body via `res.body.getReader()`. Carries the
 * same one-refresh-then-retry-on-401 waterfall, so a long-lived stream survives
 * an access-token expiry on (re)connect. Throws {@link AuthHttpError} on a
 * non-ok response (its body is read once to build the message), so a 200 SSE
 * response is returned with its body untouched and ready to stream.
 */
export async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  let res = await rawFetch(url, init, readAccessToken())

  if (res.status === 401) {
    // One refresh + one retry only. If the retried request also 401s, the
    // session is unrecoverable (the refresh token was rejected too) — fall
    // through to the !res.ok throw below rather than looping on refresh.
    const refreshed = await refreshAccessToken()
    if (refreshed) res = await rawFetch(url, init, refreshed, true)
  }

  if (!res.ok) {
    // Read the body once so the message AND the machine code come from the same
    // parse (a Response body can only be consumed once).
    const body = await res.json().catch(() => null)
    throw new AuthHttpError(
      res.status,
      extractErrorMessage(body, `HTTP ${res.status}`),
      extractErrorCode(body),
    )
  }
  return res
}

export async function authedJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(url, init)
  if (res.status === 204) throw new Error('Unexpected empty response (204 No Content); use authedRequest for endpoints with no body')
  return (await res.json()) as T
}

export async function authedRequest(url: string, init: RequestInit = {}): Promise<void> {
  await authedFetch(url, init)
}

export interface LinkProviderInput {
  clientSlug: string
  providerSlug: string
  code: string
  redirectUri: string
}

/** Attach an OAuth identity (obtained via the link-mode redirect) to the
 *  authenticated user. POSTs to the JWT-gated /auth/link-provider; resolves on
 *  success, throws AuthHttpError (carrying the backend message) on conflict. */
export async function linkProvider(input: LinkProviderInput): Promise<void> {
  await authedRequest('/api/auth/link-provider', { method: 'POST', body: JSON.stringify(input) })
}
