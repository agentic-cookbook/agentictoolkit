'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from './context'
import { HomeGate } from './HomeGate'

export type HomeAuthGateProps = {
  children: ReactNode
  /** OAuth client id (default 'adh'). */
  clientId?: string
  /** localStorage key for tokens (default 'auth_tokens'). */
  storageKey?: string
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
 * Standard auth boundary for a site's `/home` subtree WHEN the site has no
 * root-level AuthProvider: an AuthProvider wrapping {@link HomeGate} (the
 * provider-less gate) with the shared defaults.
 *
 * Sites whose root layout already mounts an AuthProvider — the marketing
 * family via `MarketingRootHtml` — must use {@link HomeGate} directly instead:
 * a second provider here would exchange a bounced single-use SSO `#code`
 * twice (see docs/cross-site-auth.md). Sites that need different auth wiring
 * (e.g. hub/admin with their own context) keep their own layout.
 */
export function HomeAuthGate({
  children,
  clientId = 'adh',
  storageKey = 'auth_tokens',
  authApiBase,
  redirectInsteadOfSso = false,
  redirectTo = '/',
}: HomeAuthGateProps) {
  return (
    <AuthProvider clientId={clientId} storageKey={storageKey}>
      <HomeGate
        clientId={clientId}
        authApiBase={authApiBase}
        redirectInsteadOfSso={redirectInsteadOfSso}
        redirectTo={redirectTo}
      >
        {children}
      </HomeGate>
    </AuthProvider>
  )
}
