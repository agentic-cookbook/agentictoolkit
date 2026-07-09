'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './context'
import { RequireAuthSkeleton } from './RequireAuthSkeleton'

export type RequireAuthProps = {
  children: ReactNode
  /** Where to send unauthenticated visitors. Default: '/'. Ignored when
   *  `onUnauthenticated` is provided. */
  redirectTo?: string
  /** Run instead of the `redirectTo` navigation when the visitor is
   *  unauthenticated — used by HomeAuthGate to kick off the SSO flow
   *  (`beginLogin`) rather than a plain in-site redirect. */
  onUnauthenticated?: () => void
  /** Shown while auth resolves / before the redirect. */
  fallback?: ReactNode
}

/**
 * Client-side guard for auth-gated routes (e.g. /home). Renders children only
 * when authenticated; otherwise shows a fallback and redirects (or runs
 * `onUnauthenticated`). Must be used within an AuthProvider.
 */
export function RequireAuth({
  children,
  redirectTo = '/',
  onUnauthenticated,
  fallback,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) return
    if (onUnauthenticated) onUnauthenticated()
    else router.replace(redirectTo)
  }, [isLoading, isAuthenticated, redirectTo, onUnauthenticated, router])

  if (isLoading || !isAuthenticated) {
    return <>{fallback ?? <RequireAuthSkeleton />}</>
  }

  return <>{children}</>
}
