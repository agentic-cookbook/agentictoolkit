'use client'

import type { ReactElement, ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@agentic-toolkit/auth'
import { ProfileFallback } from '../profile/ProfileFallback'
import { useSiteId } from '../site/site-id'

/**
 * The family's gate for `/<workspace>`: the workspace for a caller who can reach it, that
 * principal's PROFILE for one who cannot.
 *
 * It replaces `HomeGate` on this mount, and the difference is the whole feature. HomeGate sends
 * an unauthenticated visitor out through the cross-site SSO flow — correct for `/home`, which is
 * an app, and wrong for `/<slug>`, which is a person's address. A visitor who follows a link to
 * `agenticdeveloperprojects.com/mikefullerton` is not trying to sign in; they are trying to look
 * at Mike.
 *
 * Signed in, this renders `children` and defers to `SiteHomeShell`, which makes the narrower
 * judgement — the caller is authenticated but is not a MEMBER of this workspace — and lands in
 * the same place. Two checks rather than one because they are answerable at different times: a
 * session is known immediately, membership only after the workspace list resolves.
 */
export function WorkspaceOrProfileGate({ children }: { children: ReactNode }): ReactElement | null {
  const { isAuthenticated, isLoading } = useAuth()
  const params = useParams<{ workspace?: string }>()
  const slug = params?.workspace
  const siteId = useSiteId()

  // Nothing while auth settles. Not a spinner: both outcomes paint immediately after, and a
  // flash of "signing you in…" ahead of a public profile is worse than a beat of nothing.
  if (isLoading) return null
  if (!isAuthenticated) {
    return slug ? <ProfileFallback slug={slug} siteId={siteId} /> : null
  }
  return <>{children}</>
}
