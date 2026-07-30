'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { reportUnexpectedAuthError } from './report'
import { AuthProvider, useAuth } from './context'
import { exchangeSsoCode } from './client'
import { beginLogin, takeReturnTo } from './sso'

export interface AuthCallbackProps {
  /** OAuth client id for the wrapping AuthProvider (default 'adh'). */
  clientId?: string
  /** localStorage key for tokens (default 'auth_tokens'). */
  storageKey?: string
  /** Where to go after a successful exchange when no in-site returnTo was
   *  stashed by beginLogin (default '/home'). */
  redirectTo?: string
  /** Same-origin exchange endpoint (default '/api/oauth/signin/exchange'). */
  exchangePath?: string
}

function AuthCallbackInner({
  clientId = 'adh',
  redirectTo = '/home',
  exchangePath = '/api/oauth/signin/exchange',
}: Pick<AuthCallbackProps, 'clientId' | 'redirectTo' | 'exchangePath'>): ReactElement {
  const { loginWithTokens, isAuthenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const destRef = useRef<string>(redirectTo)
  const startedRef = useRef(false)

  // Exchange the one-time code for tokens, exactly once. The AS appends it as a
  // URL fragment (`#code=…`) so it never reaches a server log; we strip it from
  // the address bar before doing anything else.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const params = new URLSearchParams(fragment)
    const code = params.get('code')
    const oauthError = params.get('error')
    window.history.replaceState(null, '', window.location.pathname)

    if (oauthError === 'login_required') {
      // The silent cold-load check (prompt=none) found no central session — this
      // is NOT a failure. Quietly return to where the user was; the page stays
      // anonymous (the once-per-tab guard keeps it from re-checking).
      window.location.replace(takeReturnTo() ?? redirectTo)
      return
    }
    if (oauthError) {
      setError(oauthError === 'user_not_found' ? 'Your account could not be found.' : 'Sign-in failed')
      return
    }
    if (!code) {
      setError('Missing exchange code')
      return
    }
    destRef.current = takeReturnTo() ?? redirectTo

    ;(async () => {
      try {
        const { tokens, user } = await exchangeSsoCode(code, exchangePath)
        await loginWithTokens(tokens, user)
      } catch (err) {
        // A real SSO landing (login_required/user_not_found are handled before this).
        // Report a genuine 5xx/network failure; skip a 4xx (a stale/expired code).
        reportUnexpectedAuthError(err, { feature: 'auth', step: 'callbackExchange' })
        // An AuthHttpError carries the backend's human message and a plain Error
        // (e.g. the capability rejection) is already written for people — but a
        // network-level fetch rejection is a raw TypeError whose "Failed to
        // fetch" means nothing to a visitor, so translate that one.
        setError(
          err instanceof TypeError
            ? 'Could not reach the sign-in service. Check your connection and try again.'
            : err instanceof Error
              ? err.message
              : 'Sign-in failed',
        )
      }
    })()
  }, [loginWithTokens, redirectTo, exchangePath])

  useEffect(() => {
    if (!isAuthenticated) return
    // FULL-PAGE navigation, NOT a client-side router.replace. The exchange just
    // wrote the session via THIS page's AuthProvider, but the header is rendered
    // by the app-level AuthProvider in the root layout — a separate instance
    // whose one-shot bootstrap already ran (logged-out, before tokens existed)
    // and won't re-read storage on a client-side nav. A hard navigation remounts
    // the app shell so it boots with the freshly-stored session. Without it the
    // header stays logged-out until the next full load — the "two clicks to log
    // in" bug.
    window.location.replace(destRef.current)
  }, [isAuthenticated])

  return (
    <div className="adh-auth-callback" role="status">
      {error ? (
        <div className="adh-auth-callback__error">
          <p>{error}</p>
          {/* Restart the SSO flow at the central authorization server. Under
              cross-site SSO there is no per-site /login page to fall back to (a
              hard link there would 404 on every brand site), so re-navigate to
              the AS via beginLogin instead. */}
          <button type="button" onClick={() => beginLogin({ clientId })}>
            Try signing in again
          </button>
        </div>
      ) : (
        <p>Signing you in…</p>
      )}
    </div>
  )
}

/**
 * Drop-in OAuth/SSO callback page. Mounts its own AuthProvider, exchanges the
 * one-time `#code` the authorization server hands back for a session, then
 * redirects to the stashed returnTo (or `redirectTo`). A site's
 * `app/auth/callback/page.tsx` is just:
 *
 *   import { AuthCallback } from '@agentic-toolkit/auth'
 *   export default function Page() { return <AuthCallback /> }
 */
export function AuthCallback({
  clientId = 'adh',
  storageKey = 'auth_tokens',
  redirectTo = '/home',
  exchangePath = '/api/oauth/signin/exchange',
}: AuthCallbackProps): ReactElement {
  return (
    <AuthProvider clientId={clientId} storageKey={storageKey} silentSso={false}>
      <AuthCallbackInner clientId={clientId} redirectTo={redirectTo} exchangePath={exchangePath} />
    </AuthProvider>
  )
}
