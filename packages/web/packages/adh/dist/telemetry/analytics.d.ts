/** The explicit allowlist of instrumented event names — one source of truth. */
export declare const EVENT_HTTP_REQUEST = "http_request";
/** Property bag for a custom event — scalars only (no nested objects/PII). */
export type EventProps = Record<string, string | number | boolean | null | undefined>;
/** Called by TelemetryProvider once PostHog has been initialized. */
export declare function setPosthogReady(ready: boolean): void;
/**
 * Capture a custom analytics event. No-ops (beyond an optional dev console line) unless
 * PostHog initialized. NEVER throws — telemetry must not affect the instrumented path.
 */
export declare function captureEvent(name: string, props: EventProps): void;
/**
 * Reduce a URL or path to a low-cardinality, PII-free shape for grouping: keep only the
 * pathname (drop origin + query + hash, which can carry tokens), and replace UUIDs and
 * long-numeric runs — including ones embedded in a segment — with `:id`, so
 * `/api/persona/services/<uuid>` and `/api/users/user-123456` both collapse to `:id`.
 * Non-http(s) URLs (data:/mailto:/blob:/javascript:) carry payload/PII in their
 * "pathname", so they never get emitted.
 */
export declare function scrubPath(url: string): string;
export { markRetriedRequest, consumeRetriedFlag } from '@agentic-toolkit/adh/telemetry/retry';
//# sourceMappingURL=analytics.d.ts.map