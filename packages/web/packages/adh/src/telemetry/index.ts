'use client'

// Telemetry subpath — a light entry point (no UI barrel) so low-level packages like a host's
// auth client can import the capture helpers (via @agentic-toolkit/adh/telemetry) without
// dragging in the chrome components from the top-level `.` export.

export {
  EVENT_HTTP_REQUEST,
  captureEvent,
  scrubPath,
  markRetriedRequest,
  consumeRetriedFlag,
  setPosthogReady,
  type EventProps,
} from './analytics'
export { instrumentFetch } from './fetch-instrumentation'
export { TelemetryProvider } from './TelemetryProvider'
// Package-path specifier, not relative: this leaf is `external` in this package's own
// tsup.config.ts (module-level `reporter` state must stay a single instance across every entry
// that reaches it) — see the comment beside '@agentic-toolkit/adh/telemetry/report-error' there.
export {
  setErrorReporter,
  captureException,
  reportUnexpectedError,
  type ErrorContext,
} from '@agentic-toolkit/adh/telemetry/report-error'

// adh's registry-aware telemetry wrapper, merged in from the former `@adh/chrome/telemetry`.
// Renamed from
// that source's `TelemetryProvider` — this barrel already publishes a `TelemetryProvider` (the
// registry-free primitive above, which SiteTelemetryProvider wraps); the two are unrelated
// components that happened to share a name.
export { SiteTelemetryProvider } from './SiteTelemetryProvider'
