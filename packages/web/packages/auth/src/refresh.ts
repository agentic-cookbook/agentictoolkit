'use client'

import { reportAuthError } from './report'
import { authConfig } from './config'
import { clearTokens, readTokens, tokensFromResponse, writeTokens, type BackendTokenFields } from './tokens'

let inFlight: Promise<string | null> | null = null
// Bumped by invalidateRefresh() on every login/logout. doRefresh captures the
// generation at start and, if it changed before the response lands, discards
// its result (no writeTokens/clearTokens) — so a refresh racing a fresh login
// can't clobber the tokens that login just adopted, nor clear them on logout.
let generation = 0

// How long a losing concurrent refresh waits — after its own rotated-cookie 401 —
// for the winning refresher's writeTokens to land before it gives up and clears the
// session. Two uncoordinated single-flight mutexes (this copy + the toolkit twin)
// can race over one rotated refresh cookie; without this window the loser can
// clearTokens() a still-valid session the winner is about to (or just did) refresh.
const LOSER_RECHECK_DELAY_MS = 300

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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
      // A concurrent winner may already have written a fresh token — adopt it
      // rather than clearing a session it just renewed.
      const current = readTokens()
      if (current && current.accessToken !== startAccessToken) return current.accessToken
      // Loser-race window: the winning refresher may still be in-flight (its
      // writeTokens hasn't landed yet). Wait briefly and re-read once more before
      // clearing, so a losing 401 doesn't wipe a session the winner is about to
      // refresh. Only clear if the token is STILL the one this refresh started from.
      await delay(LOSER_RECHECK_DELAY_MS)
      const after = readTokens()
      if (after && after.accessToken !== startAccessToken) return after.accessToken
      if (startGen === generation) clearTokens()
      return null
    }
    const next = tokensFromResponse((await res.json()) as BackendTokenFields)
    if (startGen !== generation) return null
    // Session-resurrection guard: only adopt `next` if storage STILL holds the
    // token this refresh started from. If logout cleared it mid-refresh, writing
    // would resurrect the session — skip and return null. If another refresher /
    // a fresh login replaced it, adopt THAT token instead of clobbering it.
    const currentAccess = readTokens()?.accessToken ?? null
    if (currentAccess !== startAccessToken) return currentAccess
    writeTokens(next)
    return next.accessToken
  } catch (err) {
    // Only a network/parse error reaches here — a non-ok HTTP response (incl. an
    // expired-token 401) is handled above without throwing — so this is an
    // unexpected failure worth reporting, not routine session expiry.
    reportAuthError(err, { feature: 'auth', step: 'tokenRefresh' })
    if (startGen === generation) clearTokens()
    return null
  }
}
