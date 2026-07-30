'use client'

import { ErrorBoundary } from '@sentry/react'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { CHUNK_UPDATE_COPY, isChunkLoadError, recoverFromChunkError } from './chunk-recovery'
import { ErrorFallback } from './ErrorFallback'

// Themed fallback shown when a client render error crashes the subtree. The error
// itself is auto-reported to GlitchTip by Sentry's ErrorBoundary (when a DSN is
// configured) — this just gives the user a graceful recovery instead of a blank
// page or React's dev overlay. A stale-deploy ChunkLoadError additionally triggers a
// guarded hard reload so the client transparently lands on the current deployment.
function Fallback({ error }: { error: unknown }): ReactElement {
  useEffect(() => {
    recoverFromChunkError(error)
  }, [error])
  if (isChunkLoadError(error)) {
    return <ErrorFallback onRetry={() => window.location.reload()} {...CHUNK_UPDATE_COPY} />
  }
  return <ErrorFallback onRetry={() => window.location.reload()} retryLabel="Reload" />
}

/**
 * App-wide CLIENT error boundary, mounted once in {@link AdhAppShell} so every chrome
 * site gets graceful recovery + automatic GlitchTip reporting for an otherwise-fatal
 * React render crash. (Unhandled async errors / promise rejections are already
 * auto-captured by the Sentry SDK; React render errors have no boundary otherwise.)
 */
export function AppErrorBoundary({ children }: { children: ReactNode }): ReactElement {
  return <ErrorBoundary fallback={({ error }) => <Fallback error={error} />}>{children}</ErrorBoundary>
}
