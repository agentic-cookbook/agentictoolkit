'use client'

import { useCallback, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { RequireAuth } from './RequireAuth'
import { beginLogin } from './sso'

export type HomeGateProps = {
  children: ReactNode
  /** OAuth client id (default 'adh'). */
  clientId?: string
  /**
   * Absolute base URL of the login/OAuth API (the authorization-server host).
   * Defaults to `NEXT_PUBLIC_AUTH_API_URL` (resolved inside beginLogin). Sites
   * that can't rely on env inlining can pass it explicitly.
   */
  authApiBase?: string
  /** Opt out of cross-site SSO: redirect unauthenticated visitors to
   *  `redirectTo` instead of starting the SSO flow. */
  redirectInsteadOfSso?: boolean
  /** Where to send unauthenticated visitors when SSO is disabled (default '/'). */
  redirectTo?: string
}

/**
 * Provider-less auth boundary for a site's `/home` subtree: RequireAuth wired
 * to the cross-site SSO flow ({@link beginLogin}), for sites whose root layout
 * ALREADY mounts an AuthProvider (the marketing family's `MarketingRootHtml`).
 * Unauthenticated visitors are sent through a top-level navigation to the AS
 * /authorize — silently signed in when they hold a central session on any other
 * brand site — and returned to where they were.
 *
 * Deliberately mounts NO AuthProvider of its own: a nested provider would
 * capture the same `window.location.hash` as the root one and exchange a
 * bounced single-use SSO `#code` twice (see docs/cross-site-auth.md). Sites
 * without a root provider use {@link HomeAuthGate}, which wraps this in one.
 *
 * A gated site's `app/home/layout.tsx` is just:
 *
 *   export { HomeGate as default } from '@adh-shared/auth'
 */
export function HomeGate({
  children,
  clientId = 'adh',
  authApiBase,
  redirectInsteadOfSso = false,
  redirectTo = '/',
}: HomeGateProps) {
  const pathname = usePathname()
  const onUnauthenticated = useCallback(() => {
    // Preserve pathname + query so a shared deep link (e.g. /home?q=agents&tag=llm)
    // survives the SSO round-trip — usePathname() drops the query. Read the search
    // at click time, SSR-guarded exactly as makeSmartHeaderAuth's currentPath() does.
    const search = typeof window === 'undefined' ? '' : window.location.search
    const returnTo = pathname ? `${pathname}${search}` : undefined
    beginLogin({ clientId, authApiBase, returnTo })
  }, [clientId, authApiBase, pathname])

  return (
    <RequireAuth
      redirectTo={redirectTo}
      onUnauthenticated={redirectInsteadOfSso ? undefined : onUnauthenticated}
    >
      {children}
    </RequireAuth>
  )
}
