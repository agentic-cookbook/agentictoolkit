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

/**
 * Drop-in for a Next App Router `app/global-error.tsx` — the ROOT boundary, which
 * replaces the root layout when it (or a render below it) crashes. Because the app's
 * stylesheet may not be present at that point, it renders its OWN `<html>`/`<body>`
 * with minimal, color-free inline styles (browser defaults) rather than `apt-*`
 * classes. Reports the error to GlitchTip; a stale-deploy {@link isChunkLoadError}
 * additionally triggers a guarded hard reload.
 */
export function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactElement {
  const chunk = isChunkLoadError(error)
  useEffect(() => {
    captureException(error, { boundary: 'global-error', digest: error.digest ?? null })
    recoverFromChunkError(error)
  }, [error])
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
          {chunk ? CHUNK_UPDATE_COPY.title : 'Something went wrong'}
        </h1>
        <p style={{ fontSize: '0.875rem', margin: 0, maxWidth: 420 }}>
          {chunk
            ? CHUNK_UPDATE_COPY.description
            : 'An unexpected error occurred and has been reported to our team.'}
        </p>
        <button
          type="button"
          onClick={chunk ? () => window.location.reload() : reset}
          style={{ marginTop: 4, padding: '6px 12px', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          {chunk ? CHUNK_UPDATE_COPY.retryLabel : 'Try again'}
        </button>
      </body>
    </html>
  )
}
