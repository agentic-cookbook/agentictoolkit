/**
 * Patch `window.fetch` once to emit an `http_request` event per call. Idempotent and
 * browser-only; requests to telemetry-ingestion hosts are skipped. Safe to call from a
 * React effect on every site that mounts the shared chrome.
 */
export declare function instrumentFetch(): void;
//# sourceMappingURL=fetch-instrumentation.d.ts.map