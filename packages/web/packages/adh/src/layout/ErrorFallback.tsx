'use client'

import type { ReactElement } from 'react'

import { Button } from '@agentic-toolkit/ui/components/button'

/**
 * Themed "something went wrong" fallback region — shared by the client
 * {@link AppErrorBoundary} and the route-segment {@link RouteError} so they look
 * identical. Uses `apt-*` tokens (the app stylesheet is present in both cases; the
 * root-replacing global-error uses its own inline-styled fallback instead).
 */
export function ErrorFallback({
  onRetry,
  retryLabel = 'Try again',
  title = 'Something went wrong',
  description = 'An unexpected error occurred and has been reported to our team. Reloading the page usually fixes it.',
}: {
  onRetry: () => void
  retryLabel?: string
  title?: string
  description?: string
}): ReactElement {
  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h1 className="text-lg font-semibold text-apt-text">{title}</h1>
      <p className="max-w-md text-sm text-apt-text-muted">{description}</p>
      <Button variant="outline" onClick={onRetry} className="mt-1">
        {retryLabel}
      </Button>
    </div>
  )
}
