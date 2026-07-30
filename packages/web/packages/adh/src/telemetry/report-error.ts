'use client'

// Posthog/Sentry-FREE leaf module (mirrors retry.ts): any module — including a host's
// low-level auth client — imports `captureException` via
// `@agentic-toolkit/adh/telemetry/report-error` to report a HANDLED error to our error pipeline (GlitchTip) WITHOUT pulling
// @sentry/react into its own module graph.
//
// The actual reporter is registered by TelemetryProvider once the Sentry SDK has
// initialized (the same registered-flag pattern as setPosthogReady). UNHANDLED
// errors + promise rejections are auto-captured by the SDK already; this is the
// path for errors we catch in a try/catch and would otherwise swallow from
// observability.

/** Structured context attached to a reported error — scalars only (no PII / bodies / ids). */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>

type Reporter = (error: unknown, context?: ErrorContext) => void

// Registered by TelemetryProvider when the error SDK is live; null = no-op (no DSN
// configured, or before init runs). Explicit indirection rather than importing Sentry
// here, so this stays a dependency-free leaf.
let reporter: Reporter | null = null

/** Wire the concrete reporter (Sentry → GlitchTip). Called once by TelemetryProvider. */
export function setErrorReporter(next: Reporter | null): void {
  reporter = next
}

/**
 * Report a HANDLED error to the error pipeline. Fail-safe: NEVER throws, and no-ops
 * when no reporter is registered (no DSN / pre-init / SSR). Use it in catch blocks for
 * GENUINE failures — not for expected graceful-degradation no-ops (e.g. sessionStorage
 * unavailable), which would only add noise.
 */
export function captureException(error: unknown, context?: ErrorContext): void {
  try {
    reporter?.(error, context)
  } catch {
    /* a telemetry failure must never break the caller */
  }
}

/**
 * Report a HANDLED error UNLESS it's an expected client (4xx) failure. A
 * status-carrying error (e.g. an HTTP error class a fetch wrapper throws on a
 * non-ok response) with a 4xx status is a user/permission error and is dropped;
 * network errors (no numeric `status`) and 5xx backend failures are reported.
 * Duck-types `status` so this leaf stays dependency-free — it imports no HTTP or
 * auth client.
 *
 * A caller whose own package owns that error class should prefer its own reporter,
 * which can gate on `instanceof` (more precise). This duck-typed variant exists for
 * callers that cannot import such a client without a dependency cycle (e.g. the
 * theme editor in this package).
 */
export function reportUnexpectedError(error: unknown, context?: ErrorContext): void {
  const status = (error as { status?: unknown } | null | undefined)?.status
  if (typeof status === 'number' && status < 500) return
  captureException(error, context)
}
