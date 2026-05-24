'use client'

import { refreshAccessToken } from './refresh'
import { readAccessToken } from './tokens'

export { tokensFromResponse, readAccessToken, type BackendTokenFields } from './tokens'

export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const obj = body as { error?: unknown; message?: unknown; title?: unknown }
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.title === 'string') return obj.title
  }
  return fallback
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
    throw new Error(await readErrorMessage(res, `HTTP ${res.status}`))
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
