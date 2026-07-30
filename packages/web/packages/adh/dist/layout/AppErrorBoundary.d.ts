import { type ReactElement, type ReactNode } from 'react';
/**
 * App-wide CLIENT error boundary, mounted once in {@link AdhAppShell} so every chrome
 * site gets graceful recovery + automatic GlitchTip reporting for an otherwise-fatal
 * React render crash. (Unhandled async errors / promise rejections are already
 * auto-captured by the Sentry SDK; React render errors have no boundary otherwise.)
 */
export declare function AppErrorBoundary({ children }: {
    children: ReactNode;
}): ReactElement;
//# sourceMappingURL=AppErrorBoundary.d.ts.map