'use client'

import type { AuthTokens, AuthUser } from './types'
import { authConfig } from './config'

/** Where the cached user identity lives — a sibling of the tokens key, so it's
 *  per-site and cleared in lockstep with the tokens (see clearTokens). */
function userKey(): string {
  return `${authConfig().storageKey}:user`
}

/** Read + JSON-parse a localStorage key. Returns null off-browser (SSR), when
 *  the key is absent, or when the value won't parse. The single home for the
 *  storage-read contract that the tokens and cached-user blobs both share. */
function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export interface BackendTokenFields {
  token?: string
  accessToken?: string
  // The backend also returns refreshToken in the JSON body, but we intentionally
  // don't read or persist it: refresh/revoke are cookie-first against the
  // HttpOnly refresh cookie, so keeping the refresh token out of localStorage
  // avoids exposing it to JS. tokensFromResponse stores refreshToken: '' to
  // satisfy the AuthTokens shape.
}

export function tokensFromResponse(data: BackendTokenFields): AuthTokens {
  const accessToken = data.accessToken ?? data.token
  if (!accessToken) throw new Error('Token response missing token/accessToken')
  return { accessToken, refreshToken: '' }
}

export function readTokens(): AuthTokens | null {
  return readJson<AuthTokens>(authConfig().storageKey)
}

export function writeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(authConfig().storageKey, JSON.stringify(tokens))
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(authConfig().storageKey)
  // The cached identity dies with the session — never leave a user blob behind a
  // dropped token (it'd be inert, since readUser is gated on tokens, but stale).
  window.localStorage.removeItem(userKey())
}

export function readAccessToken(): string | null {
  return readTokens()?.accessToken ?? null
}

/** The last user the backend confirmed for this session, cached so a returning
 *  visitor's signed-in UI can render from it immediately while /api/auth/me
 *  revalidates in the background. Only meaningful alongside readTokens(). */
export function readUser(): AuthUser | null {
  const user = readJson<AuthUser>(userKey())
  // Fail-fast on a malformed / old-schema blob (truncated write, hand-edit): a
  // wrong shape would feed bad identity straight into the optimistic render, so
  // treat it as absent and let the authoritative /api/auth/me bootstrap fill it.
  if (!user || typeof user.id !== 'string' || !Array.isArray(user.capabilities)) return null
  return user
}

export function writeUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(userKey(), JSON.stringify(user))
}
