/**
 * Non-alarming fallback copy for the stale-deploy case — shown for the frame before
 * the auto-reload fires, and as the resting state if the reload is cooldown-blocked
 * (manual Reload still works). A version skew isn't an error from the user's side.
 */
export declare const CHUNK_UPDATE_COPY: {
    readonly title: "Updating to the latest version";
    readonly description: "A newer version of the site is available. Reloading now…";
    readonly retryLabel: "Reload now";
};
/**
 * True for the stale-deploy chunk / dynamic-import load failure that a reload fixes.
 * Matches Turbopack/webpack `ChunkLoadError` plus the equivalent native ESM
 * dynamic-import failures, by error name or message (duck-typed — no bundler import).
 */
export declare function isChunkLoadError(error: unknown): boolean;
/**
 * If `error` is a stale-deploy {@link isChunkLoadError}, force ONE hard reload so the
 * client picks up the current deployment's assets, and return `true`. Guarded by a
 * short {@link RELOAD_COOLDOWN_MS} sessionStorage cooldown so a chunk that's genuinely
 * missing can't loop. Returns `false` (no side effect) for any other error. SSR-safe.
 */
export declare function recoverFromChunkError(error: unknown): boolean;
//# sourceMappingURL=chunk-recovery.d.ts.map