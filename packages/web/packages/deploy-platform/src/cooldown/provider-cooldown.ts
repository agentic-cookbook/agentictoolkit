// Per-provider 429 cooldown, SHARED ACROSS THREADS.
//
// A rate-limited provider re-hit at the normal cadence never de-escalates: every
// poll burns more quota and extends the throttle — and a throttled provider then
// reads as a permanent outage. After a 429 we leave that provider alone until the
// cooldown lapses, honoring Retry-After when it's sane.
//
// The state must be shared because the two callers are on DIFFERENT THREADS but
// hit the SAME provider token: the monitor cycle runs on the worker thread, while
// /deploy-projects and /integrations enumerate from the API thread. Per-thread
// registries meant a 429 seen by one was invisible to the other, so the other kept
// hammering an already-throttled account — the exact failure this module exists to
// prevent, just moved to the thread boundary. A SharedArrayBuffer is the natural
// fit: one process, two threads, and the reads sit on the fetchers' hot path (so
// they must stay synchronous — no DB round trip).

/** The providers with their own rate limit + token. One slot each. */
export const PROVIDERS = ["vercel", "railway", "cloudflare", "crunchy"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export const DEFAULT_COOLDOWN_MS = 60_000;
/** Cap on what Retry-After can demand — a buggy/hostile header must not blind
 *  the monitor to a provider for a day. */
export const MAX_COOLDOWN_MS = 15 * 60_000;

/** Cooldown expiry (ms epoch) per provider slot; 0 = not cooling down. BigInt64 so
 *  the cross-thread reads/writes can go through Atomics (Float64 is not allowed). */
let slots = new BigInt64Array(new SharedArrayBuffer(PROVIDERS.length * 8));

/** The state to hand a worker thread (workerData), so it shares this registry
 *  rather than starting an empty one of its own. */
export function cooldownState(): SharedArrayBuffer {
  return slots.buffer as SharedArrayBuffer;
}

/** Adopt the state passed from the parent thread. Called once, at worker boot;
 *  without it the worker would silently keep a private registry. */
export function attachCooldownState(buffer: SharedArrayBuffer | undefined): void {
  if (buffer) slots = new BigInt64Array(buffer);
}

/** Parse a Retry-After header: delta-seconds or an HTTP date. Null when absent/garbage. */
function retryAfterMs(header: string | null | undefined, now: number): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  const at = Date.parse(header);
  return Number.isFinite(at) && at > now ? at - now : null;
}

/** Record a 429 from `provider`; returns the cooldown expiry (ms epoch). */
export function noteRateLimited(provider: ProviderName, retryAfter?: string | null, now: number = Date.now()): number {
  const ms = Math.min(retryAfterMs(retryAfter, now) ?? DEFAULT_COOLDOWN_MS, MAX_COOLDOWN_MS);
  const until = BigInt(now + ms);
  const slot = PROVIDERS.indexOf(provider);
  // A name outside the fixed slots (the type is bypassable via a cast, and DB
  // platform strings like "cloudflare-pages" are NOT slot names) must degrade to
  // "note nothing", never throw a RangeError inside the monitor cycle.
  if (slot < 0) {
    console.error(`[cooldown] unknown provider "${provider}" — cooldown not recorded`);
    return now + ms;
  }
  // Never SHORTEN an existing cooldown (a burst of 429s, or the other thread's
  // longer backoff, races this) — keep the furthest expiry.
  const existing = Atomics.load(slots, slot);
  if (until > existing) Atomics.store(slots, slot, until);
  console.error(`[cooldown] ${provider} rate-limited — backing off ${Math.round(ms / 1000)}s`);
  return Number(existing > until ? existing : until);
}

/** Note a 429 response for `provider` (honoring its Retry-After); true iff the
 *  response WAS a 429 — callers use it as "bail out, the provider is throttled". */
export function noteIfRateLimited(provider: ProviderName, res: Response): boolean {
  if (res.status !== 429) return false;
  noteRateLimited(provider, res.headers.get("retry-after"));
  return true;
}

/** The active cooldown expiry for `provider`, or null when it may be polled. */
export function rateLimitedUntil(provider: ProviderName, now: number = Date.now()): number | null {
  const slot = PROVIDERS.indexOf(provider);
  if (slot < 0) return null; // unknown name → treat as never cooling down (see noteRateLimited)
  const until = Number(Atomics.load(slots, slot));
  if (until === 0) return null;
  if (until <= now) {
    Atomics.store(slots, slot, 0n); // lapsed — clear it so the next read is free
    return null;
  }
  return until;
}

/** Test hook — clear all cooldowns. */
export function _resetProviderCooldowns(): void {
  for (let i = 0; i < PROVIDERS.length; i++) Atomics.store(slots, i, 0n);
}
