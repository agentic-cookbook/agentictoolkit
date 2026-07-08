'use client'

import { refreshAccessToken } from './refresh'
import { readAccessToken } from './tokens'

export { tokensFromResponse, readAccessToken, type BackendTokenFields } from './tokens'

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

async function rawFetch(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (init.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...init, headers })
}

async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  let res = await rawFetch(url, init, readAccessToken())

  if (res.status === 401) {
    // One refresh + one retry only. If the retried request also 401s, the
    // session is unrecoverable (the refresh token was rejected too) — fall
    // through to the !res.ok throw below rather than looping on refresh.
    const refreshed = await refreshAccessToken()
    if (refreshed) res = await rawFetch(url, init, refreshed)
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
