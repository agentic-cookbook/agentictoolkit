'use client'

// Posthog-free LEAF module: a host's auth client imports ONLY this (via
// `@agentic-toolkit/adh/telemetry/retry`) to tag its post-refresh retry, so it never pulls posthog-js / @sentry/react into its
// module graph. Identity-keyed WeakSet so a never-consumed init is GC'd.

const retriedInits = new WeakSet<object>()

/**
 * Mark the *exact* RequestInit object that will be handed to `window.fetch` as the auth
 * retry. Must be the post-spread object (the one fetch receives), not an upstream copy.
 */
export function markRetriedRequest(init: object): void {
  retriedInits.add(init)
}

/** Read-and-clear the retry flag for a RequestInit/Request the fetch wrapper is sending. */
export function consumeRetriedFlag(init: unknown): boolean {
  if (!init || typeof init !== 'object') return false
  if (retriedInits.has(init)) {
    retriedInits.delete(init)
    return true
  }
  return false
}
