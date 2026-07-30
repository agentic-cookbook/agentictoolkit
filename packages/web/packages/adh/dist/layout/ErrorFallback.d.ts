import type { ReactElement } from 'react';
/**
 * Themed "something went wrong" fallback region — shared by the client
 * {@link AppErrorBoundary} and the route-segment {@link RouteError} so they look
 * identical. Uses `apt-*` tokens (the app stylesheet is present in both cases; the
 * root-replacing global-error uses its own inline-styled fallback instead).
 */
export declare function ErrorFallback({ onRetry, retryLabel, title, description, }: {
    onRetry: () => void;
    retryLabel?: string;
    title?: string;
    description?: string;
}): ReactElement;
//# sourceMappingURL=ErrorFallback.d.ts.map