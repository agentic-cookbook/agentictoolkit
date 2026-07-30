'use client'

// Stale-deployment recovery. When a new build ships, the HTML a client already
// loaded points at chunk URLs stamped with the OLD deployment id (e.g.
// `…/chunk.css?dpl=dpl_…`). The host only serves the CURRENT deployment's
// `/_next/static/*`, so the next lazy `import()` 404s and the bundler throws a
// `ChunkLoadError`. A single hard reload pulls the new HTML + assets and fixes
// it — this module detects that error and performs exactly one guarded reload.

/**
 * Non-alarming fallback copy for the stale-deploy case — shown for the frame before
 * the auto-reload fires, and as the resting state if the reload is cooldown-blocked
 * (manual Reload still works). A version skew isn't an error from the user's side.
 */
export const CHUNK_UPDATE_COPY = {
  title: 'Updating to the latest version',
  description: 'A newer version of the site is available. Reloading now…',
  retryLabel: 'Reload now',
} as const

const RELOAD_GUARD_KEY = 'adh:chunk-reload-at'
// Only auto-reload if we haven't already in this window. If the chunk is GENUINELY
// gone (not just stale) the reload won't help, so the guard stops a reload loop and
// lets the boundary's fallback (with a manual Reload button) take over instead.
const RELOAD_COOLDOWN_MS = 10_000

/**
 * True for the stale-deploy chunk / dynamic-import load failure that a reload fixes.
 * Matches Turbopack/webpack `ChunkLoadError` plus the equivalent native ESM
 * dynamic-import failures, by error name or message (duck-typed — no bundler import).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === 'ChunkLoadError') return true
  // webpack ("Loading chunk N failed") + Turbopack ("Failed to load chunk …") phrasings.
  // Deliberately NOT the generic "…dynamically imported module" / "Importing a module
  // script failed" messages: those also fire when the user is simply offline, where a
  // reload doesn't help and would only burn the one allowed attempt.
  return typeof message === 'string' && /Loading (CSS )?chunk|Failed to load chunk/i.test(message)
}

/**
 * If `error` is a stale-deploy {@link isChunkLoadError}, force ONE hard reload so the
 * client picks up the current deployment's assets, and return `true`. Guarded by a
 * short {@link RELOAD_COOLDOWN_MS} sessionStorage cooldown so a chunk that's genuinely
 * missing can't loop. Returns `false` (no side effect) for any other error. SSR-safe.
 */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false
  // Record the attempt BEFORE reloading. If sessionStorage is unavailable (Safari
  // private mode throws), we can't persist the cooldown across the reload — so we
  // decline to auto-reload rather than risk an unbreakable reload loop. The fallback's
  // manual button still recovers the user.
  try {
    const now = Date.now()
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY))
    if (now - last < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
