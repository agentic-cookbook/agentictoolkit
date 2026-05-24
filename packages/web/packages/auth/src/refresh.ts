'use client'

import { authConfig } from './config'
import { clearTokens, readTokens, tokensFromResponse, writeTokens, type BackendTokenFields } from './tokens'

let inFlight: Promise<string | null> | null = null
// Bumped by invalidateRefresh() on every login/logout. doRefresh captures the
// generation at start and, if it changed before the response lands, discards
// its result (no writeTokens/clearTokens) — so a refresh racing a fresh login
// can't clobber the tokens that login just adopted, nor clear them on logout.
let generation = 0

export function invalidateRefresh(): void {
  generation += 1
  inFlight = null
}

export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight
  const startGen = generation
  const promise = doRefresh(startGen).finally(() => {
    if (inFlight === promise) inFlight = null
  })
  inFlight = promise
  return promise
}

async function doRefresh(startGen: number): Promise<string | null> {
  const startAccessToken = readTokens()?.accessToken ?? null
  try {
    const res = await fetch(authConfig().refreshPath, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) {
      const current = readTokens()
      if (current && current.accessToken !== startAccessToken) return current.accessToken
      if (startGen === generation) clearTokens()
      return null
    }
    const next = tokensFromResponse((await res.json()) as BackendTokenFields)
    if (startGen !== generation) return null
    writeTokens(next)
    return next.accessToken
  } catch (err) {
    console.error('Token refresh failed', err)
    if (startGen === generation) clearTokens()
    return null
  }
}
