'use client'

import { useEffect, type ReactElement } from 'react'
// Package path, not the relative '../telemetry/report-error': this package bundles with
// tsup `bundle: true, splitting: false`, so a relative specifier would inline a SECOND copy
// of report-error.ts into the `layout` entry, whose module-level `reporter` (written only by
// TelemetryProvider, in the `telemetry` entry) would stay null forever — every error these
// two components report would silently never reach GlitchTip in a production build, while
// next dev / vitest / tsc all stayed green on the `development` (src) condition. The leaf,
// not the `@agentic-toolkit/adh/telemetry` barrel: the barrel is 'use client' and drags
// TelemetryProvider + the analytics surface along. Matching `external` entry required.
import { captureException } from '@agentic-toolkit/adh/telemetry/report-error'
import { CHUNK_UPDATE_COPY, isChunkLoadError, recoverFromChunkError } from './chunk-recovery'
import { ErrorFallback } from './ErrorFallback'

/**
 * Drop-in for a Next App Router `app/error.tsx` (a route-segment boundary, so the
 * shared chrome stays mounted). Reports the error to GlitchTip and shows the themed
 * fallback with a `reset()` retry. Catches SERVER + client render errors below the
 * layout — the gap the client {@link AppErrorBoundary} can't cover. A stale-deploy
 * {@link isChunkLoadError} additionally triggers a guarded hard reload.
 */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactElement {
  const chunk = isChunkLoadError(error)
  useEffect(() => {
    captureException(error, { boundary: 'route-error', digest: error.digest ?? null })
    recoverFromChunkError(error)
  }, [error])
  if (chunk) {
    return <ErrorFallback onRetry={() => window.location.reload()} {...CHUNK_UPDATE_COPY} />
  }
  return <ErrorFallback onRetry={reset} />
}
