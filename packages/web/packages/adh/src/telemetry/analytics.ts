'use client'

import posthog from 'posthog-js'

// Custom analytics capture, paired with the privacy-first PostHog init in
// TelemetryProvider. Everything here is fail-safe: these run on the fetch hot path
// (see fetch-instrumentation), so a telemetry bug must never throw into a caller and
// nothing private (tokens, bodies, ids) may ride along.

/** The explicit allowlist of instrumented event names — one source of truth. */
export const EVENT_HTTP_REQUEST = 'http_request'

/** Property bag for a custom event — scalars only (no nested objects/PII). */
export type EventProps = Record<string, string | number | boolean | null | undefined>

// Whether posthog.init actually ran (a NEXT_PUBLIC_POSTHOG_KEY was present). Set by
// TelemetryProvider; until then captureEvent only debug-logs. Explicit flag rather
// than poking posthog internals (explicit-over-implicit).
let posthogReady = false

/** Called by TelemetryProvider once PostHog has been initialized. */
export function setPosthogReady(ready: boolean): void {
  posthogReady = ready
}

// Local visibility when PostHog has no key (the local dev suite never sets one): emit
// the same events to the console so a developer can see timings without a deploy.
const debugEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_TELEMETRY_DEBUG === '1'

/**
 * Capture a custom analytics event. No-ops (beyond an optional dev console line) unless
 * PostHog initialized. NEVER throws — telemetry must not affect the instrumented path.
 */
export function captureEvent(name: string, props: EventProps): void {
  try {
    if (posthogReady) posthog.capture(name, props)
    if (debugEnabled) console.debug('[perf]', name, props)
  } catch {
    /* swallow — a telemetry failure must never break the caller */
  }
}

// Applied globally (not anchored) so ids EMBEDDED in a segment are redacted too — e.g.
// `user-123456` or an `order_<uuid>` slug, not just a whole-segment id. Neither pattern
// can span a `/`, so running them over the full pathname is safe. The digit threshold is
// 4 so ordinary low-cardinality numbers (ports, small enums, `/items/42`) survive while
// id-/timestamp-shaped runs collapse.
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const DIGIT_RUN = /\d{4,}/g

/**
 * Reduce a URL or path to a low-cardinality, PII-free shape for grouping: keep only the
 * pathname (drop origin + query + hash, which can carry tokens), and replace UUIDs and
 * long-numeric runs — including ones embedded in a segment — with `:id`, so
 * `/api/persona/services/<uuid>` and `/api/users/user-123456` both collapse to `:id`.
 * Non-http(s) URLs (data:/mailto:/blob:/javascript:) carry payload/PII in their
 * "pathname", so they never get emitted.
 */
export function scrubPath(url: string): string {
  let pathname: string
  try {
    // Base lets this accept both absolute URLs and root-relative paths.
    const u = new URL(url, 'http://_')
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ':non-http'
    pathname = u.pathname
  } catch {
    const cuts = [url.indexOf('?'), url.indexOf('#')].filter((i) => i >= 0)
    pathname = cuts.length ? url.slice(0, Math.min(...cuts)) : url
  }
  return pathname.replace(UUID_ANYWHERE, ':id').replace(DIGIT_RUN, ':id')
}

// The retry marker lives in a posthog-free leaf so the auth client can import it without
// dragging posthog-js in; re-exported here for the barrel + fetch wrapper. Package-path
// specifier, not relative: './retry' is `external` in this package's own tsup.config.ts so
// every entry that reaches the leaf's module-level `retriedInits` WeakSet shares one instance
// instead of each getting its own inlined copy.
export { markRetriedRequest, consumeRetriedFlag } from '@agentic-toolkit/adh/telemetry/retry'
