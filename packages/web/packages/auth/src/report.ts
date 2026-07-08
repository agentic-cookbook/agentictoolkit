'use client'

import { AuthHttpError } from './client'

/** Structured context attached to a reported auth error — e.g. the calling hook
 *  or dialog (`{ source: 'useResourceList' }`). */
export interface ErrorContext {
  source?: string
}

/**
 * Report a CAUGHT auth error — but only when it's unexpected. An
 * {@link AuthHttpError} with a 4xx status is an expected user/flow error (wrong
 * password, stale exchange code, email already taken, capability rejection) and
 * is dropped to avoid noise; network errors (not an AuthHttpError) and 5xx
 * backend failures are logged. Fail-safe: never throws.
 */
export function reportUnexpectedAuthError(err: unknown, context?: ErrorContext): void {
  if (err instanceof AuthHttpError && err.status < 500) return
  console.error(err, context)
}
