'use client'

import type { AuthTokens } from './types'
import { authConfig } from './config'

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
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(authConfig().storageKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthTokens
  } catch {
    return null
  }
}

export function writeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(authConfig().storageKey, JSON.stringify(tokens))
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(authConfig().storageKey)
}

export function readAccessToken(): string | null {
  return readTokens()?.accessToken ?? null
}
