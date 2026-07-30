import { type ReactElement } from 'react';
/**
 * Drop-in for a Next App Router `app/error.tsx` (a route-segment boundary, so the
 * shared chrome stays mounted). Reports the error to GlitchTip and shows the themed
 * fallback with a `reset()` retry. Catches SERVER + client render errors below the
 * layout — the gap the client {@link AppErrorBoundary} can't cover. A stale-deploy
 * {@link isChunkLoadError} additionally triggers a guarded hard reload.
 */
export declare function RouteError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}): ReactElement;
//# sourceMappingURL=RouteError.d.ts.map