/**
 * TTL cache + single-flight around an expensive build — the ONE implementation.
 *
 * Two properties, and both matter:
 *  - TTL: a repeat caller inside the window reuses the last value.
 *  - SINGLE-FLIGHT: concurrent MISSES share one build instead of each starting
 *    their own. Without it a burst on a cold/expired cache multiplies exactly the
 *    work the cache was added to avoid — which is what the unauthenticated
 *    /public/status-summary did before this was shared: every anonymous request
 *    in the miss window ran its own snapshot build.
 *
 * `fresh` bypasses the TTL but still JOINS an in-flight build (a build started
 * moments ago IS fresh — starting a second one buys nothing). A failed build is
 * never cached: the in-flight promise is cleared, so the next caller retries
 * rather than inheriting a poisoned entry.
 *
 * Per-instance (created inside a route factory), so tests and parallel app
 * instances don't share state through a module-level singleton.
 */
export function cachedSingleFlight<T>(ttlMs: number, build: () => Promise<T>): (fresh?: boolean) => Promise<T> {
  let cached: { value: T; at: number } | null = null;
  let inFlight: Promise<T> | null = null;

  return async (fresh = false) => {
    if (!fresh && cached && Date.now() - cached.at < ttlMs) return cached.value;
    inFlight ??= build()
      .then((value) => {
        cached = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
