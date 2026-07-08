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

// How long the LOSER of a concurrent refresh waits for the winner's writeTokens
// to land before giving up and clearing tokens. Narrows the window where the
// rotated-refresh-cookie 401 handed to the losing refresher would log out a
// session the winner just refreshed.
const RACE_RECHECK_MS = 300

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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
      // First, immediate attempt: a concurrent refresher may ALREADY have written
      // a fresh token — adopt it rather than clearing a now-valid session.
      const current = readTokens()
      if (current && current.accessToken !== startAccessToken) return current.accessToken
      // Loser-race window: the WINNER's writeTokens can land shortly AFTER our
      // rotated-cookie 401. Wait briefly and re-read ONCE more before clearing,
      // adopting a token that changed; only clear if it is still unchanged.
      await delay(RACE_RECHECK_MS)
      const after = readTokens()
      if (after && after.accessToken !== startAccessToken) return after.accessToken
      if (startGen === generation) clearTokens()
      return null
    }
    const next = tokensFromResponse((await res.json()) as BackendTokenFields)
    if (startGen !== generation) return null
    // Compare-and-swap: only claim the write if the stored token is STILL the one
    // this refresh started from. A hub logout clears the shared key WITHOUT bumping
    // our generation, so without this a success landing after logout would
    // resurrect the session. If storage was cleared (current === null → not equal)
    // skip the write and return null; if a concurrent refresher / fresh login wrote
    // a DIFFERENT token, adopt it instead of clobbering.
    const current = readTokens()?.accessToken ?? null
    if (current === startAccessToken) {
      writeTokens(next)
      return next.accessToken
    }
    return current
  } catch (err) {
    console.error('Token refresh failed', err)
    if (startGen === generation) clearTokens()
    return null
  }
}
