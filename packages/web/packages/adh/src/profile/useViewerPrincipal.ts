'use client'

import { useEffect, useState } from 'react'
import { useOptionalAuth } from '@agentic-toolkit/auth'
import { authedJson } from '@agentic-toolkit/auth/client'
import { principalFromOrgCard, principalFromUserCard, type OrgCardBody, type UserCardBody } from './normalize'
import type { ProfilePrincipal } from './types'

/**
 * The signed-in half of the profile's two-layer resolution. The server rendered whatever the
 * ANONYMOUS endpoint returned (see `fetchPublicPrincipal`, and the pair doctrine it follows);
 * this asks the authed twin the same question with the viewer's own token and prefers its answer.
 *
 * It is what makes `hub` visibility mean anything on a rendered page: a `hub` profile is a 404 on
 * the public route by design, so `seed` is null for it and only this hook can resolve it. It also
 * widens a profile the server DID resolve — `assembleUserCard` uses the audience mask for
 * per-field privacy grants, not just the page-level gate, so a `public` profile still has
 * hub-audience social links and contact methods that the anonymous body omits.
 *
 * `useOptionalAuth` rather than `useAuth`: this component renders on 41 sites and must not throw
 * on one that mounts no AuthProvider. No provider means no viewer, which means no upgrade — the
 * same outcome as a signed-out visitor, reached without a crash.
 *
 * Returns `seed` until an upgrade lands, so there is no loading state to render and no layout
 * shift beyond the widened fields appearing. A failed upgrade leaves the anonymous view standing,
 * which is a correct page rather than an error.
 */
export function useViewerPrincipal(
  slug: string,
  seed: ProfilePrincipal | null,
): ProfilePrincipal | null {
  const auth = useOptionalAuth()
  const signedIn = auth?.isAuthenticated ?? false
  const [wider, setWider] = useState<ProfilePrincipal | null>(null)

  useEffect(() => {
    // Drop any previous viewer's wider body the moment the session ends, or a sign-out would leave
    // hub-audience fields on screen until navigation.
    if (!signedIn) {
      setWider(null)
      return
    }
    let live = true
    void (async () => {
      const encoded = encodeURIComponent(slug)
      // Users first, then organizations — the same order and the same one-slug-namespace
      // assumption fetchPublicPrincipal makes on the server. The two bodies are differently
      // shaped, so each branch goes through its own normalizer rather than a bare spread.
      try {
        const dto = await authedJson<UserCardBody>(`/api/users/${encoded}`)
        if (live) setWider(principalFromUserCard(dto))
        return
      } catch (err) {
        // authedFetch throws AuthHttpError on ANY non-ok, so a 404 arrives here as an exception
        // and means only "not a user, or not visible to me" — try the other kind. Anything else
        // is a real failure worth seeing in the console, but still not worth replacing a rendered
        // profile with an error: the seed stands.
        if ((err as { status?: number }).status !== 404) {
          console.error(`Profile upgrade failed for ${slug}:`, err)
          return
        }
      }
      try {
        const dto = await authedJson<OrgCardBody>(`/api/orgs/${encoded}`)
        if (live) setWider(principalFromOrgCard(dto))
      } catch (err) {
        if ((err as { status?: number }).status !== 404) {
          console.error(`Profile upgrade failed for ${slug}:`, err)
        }
      }
    })()
    return () => {
      live = false
    }
  }, [slug, signedIn])

  return wider ?? seed
}
