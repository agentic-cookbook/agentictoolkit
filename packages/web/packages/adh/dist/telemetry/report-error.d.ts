/** Structured context attached to a reported error — scalars only (no PII / bodies / ids). */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>;
type Reporter = (error: unknown, context?: ErrorContext) => void;
/** Wire the concrete reporter (Sentry → GlitchTip). Called once by TelemetryProvider. */
export declare function setErrorReporter(next: Reporter | null): void;
/**
 * Report a HANDLED error to the error pipeline. Fail-safe: NEVER throws, and no-ops
 * when no reporter is registered (no DSN / pre-init / SSR). Use it in catch blocks for
 * GENUINE failures — not for expected graceful-degradation no-ops (e.g. sessionStorage
 * unavailable), which would only add noise.
 */
export declare function captureException(error: unknown, context?: ErrorContext): void;
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
export declare function reportUnexpectedError(error: unknown, context?: ErrorContext): void;
export {};
//# sourceMappingURL=report-error.d.ts.map