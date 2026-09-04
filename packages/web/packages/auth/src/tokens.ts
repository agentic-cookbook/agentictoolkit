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

const sessionListeners = new Set<() => void>()

// Copy before iterating: a listener may unsubscribe itself (or another) from inside the callback,
// and mutating a Set mid-iteration silently skips entries.
function announceSessionChange(): void {
  for (const fn of [...sessionListeners]) fn()
}

/**
 * Run `fn` whenever the stored tokens are written or cleared — a sign-in, a sign-out, a refresh.
 * Returns an unsubscribe.
 *
 * Exists because the session is a PROCESS-WIDE fact that outlives any one React tree, and things
 * that cache per-principal data at module scope (`@agentic-toolkit/data`'s query client) have to
 * hear about a change without being reachable from a component. Announced from here — the only
 * two writers of the storage key — rather than from the AuthProvider, so a refresh that swaps the
 * session from `refresh.ts` is heard just as loudly as a login.
 *
 * The direction matters: `data` already depends on `auth`, so `auth` cannot import `data` to push
 * at it. A listener seam is the only way across that keeps the dependency one-way.
 *
 * Listeners are told THAT the session moved, never what it moved to — the storage is right there,
 * and a payload would only invite a listener to trust a stale copy of it. Note that a refresh
 * fires this with the SAME principal, so a listener that does something expensive must compare
 * (e.g. {@link readTokenSubject}) before acting.
 */
export function onSessionChange(fn: () => void): () => void {
  sessionListeners.add(fn)
  return () => {
    sessionListeners.delete(fn)
  }
}

export function readTokens(): AuthTokens | null {
  return readJson<AuthTokens>(authConfig().storageKey)
}

export function writeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(authConfig().storageKey, JSON.stringify(tokens))
  announceSessionChange()
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(authConfig().storageKey)
  // The cached identity dies with the session — never leave a user blob behind a
  // dropped token (it'd be inert, since readUser is gated on tokens, but stale).
  window.localStorage.removeItem(userKey())
  announceSessionChange()
}

export function readAccessToken(): string | null {
  return readTokens()?.accessToken ?? null
}

/**
 * Decode a base64url-encoded JSON segment — a JWT payload, or the claims half of the
 * self-describing state token the backend mints for an OAuth round-trip. Returns null for
 * anything that is not decodable JSON, which is the one answer every caller has a screen for.
 *
 * THE UTF-8 STEP IS THE WHOLE POINT. `atob` yields a binary string with one code unit per
 * BYTE, so `JSON.parse(atob(...))` reads every multi-byte character as its separate bytes: a
 * name, a workspace slug or a provider label with an accent in it comes back mojibake, and a
 * byte pair that happens to land on a quote or a backslash makes the parse throw outright —
 * which each caller then reports as a malformed token, i.e. as a sign-out or an
 * expired-link screen for a token that was perfectly valid. Decoding the bytes as UTF-8
 * first is the fix, and `fatal: true` refuses an invalid sequence rather than substituting
 * U+FFFD: these segments are covered by a signature computed over the original bytes, so a
 * claim silently rewritten to replacement characters is a value nothing ever signed.
 *
 * It lives HERE, in the package with no `@agentic-toolkit` dependency of its own, because
 * three copies of this decode existed in two packages and all three had the same bug — the
 * shape of a defect that is fixed once and returns in the copies nobody grepped for.
 */
export function decodeBase64UrlJson(segment: string): unknown {
  try {
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch {
    return null
  }
}

/** The current access token's `sub` claim — the signed-in principal — or null when
 *  signed out / the token is malformed. Parsed locally WITHOUT verification: this is
 *  identity for CACHE SCOPING (keying react-query data to the tenant so an account
 *  switch in another tab can never serve the previous account's rows), never for
 *  authorization. Provider-agnostic: it reads the same storage `authedJson` sends
 *  from, so it works under any host's auth context. */
export function readTokenSubject(): string | null {
  const token = readAccessToken()
  const payload = token?.split('.')[1]
  if (!payload) return null
  const claims = decodeBase64UrlJson(payload) as { sub?: unknown } | null
  return typeof claims?.sub === 'string' ? claims.sub : null
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
