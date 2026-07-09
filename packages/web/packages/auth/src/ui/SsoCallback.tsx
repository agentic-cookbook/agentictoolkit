'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { exchangeSsoCode } from '../client'
import { takeReturnTo, PENDING_LINK_KEY } from '../sso'
import { oauthErrorMessage, accountExistsLinkBody, accountExistsTitle, loginDisabledTitle, loginDisabledBody } from '../labels'
import { reportUnexpectedAuthError } from '../report'
import type { AuthTokens, AuthUser } from '../types'

export interface SsoCallbackProps<U extends AuthUser = AuthUser> {
  /** From the site's auth context — adopts the exchanged session. */
  loginWithTokens: (tokens: AuthTokens, user?: U) => Promise<U>
  /** From the site's auth context — true once a session is present. */
  isAuthenticated: boolean
  /** Where to land after sign-in (and where `login_required` returns). */
  homeHref: string
  /** OAuth client id, for telemetry tagging ('adh' | 'admin'). */
  clientId: string
  /** Where `account_exists` sends the user to log in + link. Default '/login'. */
  loginHref?: string
  /** Where a `signups_closed` block redirects (hub passes "/signup"), carrying
   *  `?reason=signups_closed&email=`. Omit to show a generic inline message. */
  signupBlockedHref?: string
}

/**
 * The shared OAuth callback page for sites whose AuthProvider is mounted at the app
 * root (hub, admin) — they pass their own `loginWithTokens`/`isAuthenticated` rather
 * than wrapping a fresh {@link AuthProvider} the way the standalone {@link AuthCallback}
 * does. Parses the AS result fragment and: relays `login_required` home; on
 * `account_exists` stashes the pending link + shows the themed acknowledge modal →
 * `/login`; surfaces any other `#error`; otherwise exchanges the `#code`. A successful
 * sign-in redirects to `homeHref` — but NOT out from under the (async) account_exists
 * modal.
 */
export function SsoCallback<U extends AuthUser = AuthUser>({
  loginWithTokens,
  isAuthenticated,
  homeHref,
  clientId,
  loginHref = '/login',
  signupBlockedHref,
}: SsoCallbackProps<U>): ReactElement {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // Provider slug for the reactive `account_exists` modal (replaces window.alert).
  const [accountExistsProvider, setAccountExistsProvider] = useState<string | null>(null)
  const [loginDisabled, setLoginDisabled] = useState(false)
  const startedRef = useRef(false)
  // Set the instant the fragment-parsing effect decides to show a blocking modal
  // (account_exists or login_disabled). The redirect effect below reads it LIVE
  // (unlike the closure-captured `loginDisabled`/`accountExistsProvider` state),
  // so an already-authenticated session is held on the notice even on the FIRST
  // commit — before those setState calls have re-rendered.
  const holdHomeRedirectRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const params = new URLSearchParams(fragment)
    const code = params.get('code')
    const oauthError = params.get('error')
    // The AS appends the result in the URL fragment; clear it once we have a result
    // to act on. Don't strip before the no-result branch — that keeps it visible
    // for diagnosis.
    const stripFragment = () => window.history.replaceState(null, '', window.location.pathname)

    // A silent prompt=none check that found no central session — NOT a failure.
    if (oauthError === 'login_required') {
      stripFragment()
      router.replace(takeReturnTo() ?? homeHref)
      return
    }
    // account_exists + link_provider: stash the intent FIRST so it survives the
    // acknowledgement, strip the fragment, then show a themed modal disclosing that
    // signing in will connect this provider. The /login redirect waits for the
    // acknowledgement (modal onConfirm).
    if (oauthError === 'account_exists') {
      const provider = params.get('link_provider')
      if (provider) {
        try { window.sessionStorage.setItem(PENDING_LINK_KEY, provider) } catch { /* ignore */ }
        stripFragment()
        holdHomeRedirectRef.current = true // hold before the redirect effect can fire
        // adh-ui-allow: react-hooks/set-state-in-effect — one-shot reaction to the parsed OAuth callback fragment (a client-only window.location read, guarded by startedRef); opens the modal, it does not sync state; approved by Mike Fullerton 2026-06-22
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see adh-ui-allow above
        setAccountExistsProvider(provider)
        return
      }
    }
    // user_login_disabled gate: the AS refused to mint a session because logins
    // are turned off. Show the themed "not open yet" modal (shared hub + admin).
    if (oauthError === 'login_disabled') {
      stripFragment()
      holdHomeRedirectRef.current = true // hold before the redirect effect can fire
      // adh-ui-allow: react-hooks/set-state-in-effect — one-shot reaction to the parsed callback fragment (client-only window.location read, guarded by startedRef)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see adh-ui-allow above
      setLoginDisabled(true)
      return
    }
    // signups_closed gate: a NEW user tried to sign up while signups are closed.
    // The hub hands off to its invitation/signup page (carrying the attempted
    // email); a site without one (admin) shows a generic inline message instead.
    if (oauthError === 'signups_closed') {
      stripFragment()
      // Hold the auto-home redirect before it can fire: like the sibling branches
      // above, an optimistically-restored session must NOT bounce to /home and
      // override the /signup handoff (or the inline message) below.
      holdHomeRedirectRef.current = true
      const blockedEmail = params.get('email') ?? ''
      if (signupBlockedHref) {
        const q = blockedEmail
          ? `?reason=signups_closed&email=${encodeURIComponent(blockedEmail)}`
          : '?reason=signups_closed'
        router.replace(`${signupBlockedHref}${q}`)
      } else {
        setError(oauthErrorMessage('signups_closed'))
      }
      return
    }
    // Any other backend OAuth error must be shown (was previously masked as the
    // misleading "Missing exchange code" because the page only read `code`).
    if (oauthError) {
      stripFragment()
      setError(oauthErrorMessage(oauthError))
      return
    }
    if (!code) {
      setError(
        fragment
          ? `Missing exchange code — callback returned: ${fragment}`
          : 'Missing exchange code — the callback URL had no #code or #error',
      )
      return
    }
    stripFragment()

    void (async () => {
      try {
        const { tokens, user } = await exchangeSsoCode(code)
        // exchangeSsoCode returns the raw backend user; loginWithTokens maps it.
        await loginWithTokens(tokens, user as U)
      } catch (err) {
        // Report a genuine 5xx/network failure; skip an expected 4xx (stale code).
        reportUnexpectedAuthError(err, { feature: 'auth', step: 'callbackExchange', client: clientId })
        setError(err instanceof Error ? err.message : 'Sign-in failed')
      }
    })()
  }, [loginWithTokens, router, homeHref, clientId, signupBlockedHref])

  useEffect(() => {
    // Don't redirect out from under the account_exists modal: it renders
    // asynchronously (unlike the old blocking window.alert), so an optimistically
    // restored session must NOT bounce home before the user acknowledges it —
    // otherwise the modal never shows and the pending link is stranded.
    // Also stay put when a login_disabled block is showing its modal, so an
    // optimistically restored session can't bounce the user home past the notice.
    // `holdHomeRedirectRef` closes the first-commit race: the state flags above are
    // still their initial `false` when this effect first runs (their setState in the
    // sibling effect hasn't re-rendered yet), but the ref is set synchronously there.
    if (isAuthenticated && !accountExistsProvider && !loginDisabled && !holdHomeRedirectRef.current) {
      router.replace(homeHref)
    }
  }, [isAuthenticated, router, accountExistsProvider, homeHref, loginDisabled])

  return (
    <div className="flex-1 flex items-center justify-center bg-apt-bg text-apt-text-muted">
      {error ? (
        <div className="text-center">
          <p className="mb-3 text-apt-red">{error}</p>
          <a href={loginHref} className="text-apt-gold">Back to login</a>
        </div>
      ) : (
        <p>Signing you in…</p>
      )}
      {accountExistsProvider && (
        <AlertModal
          open
          tone="info"
          title={accountExistsTitle}
          description={accountExistsLinkBody(accountExistsProvider)}
          confirmLabel="Continue"
          onConfirm={() => router.replace(loginHref)}
        />
      )}
      {loginDisabled && (
        <AlertModal
          open
          tone="info"
          title={loginDisabledTitle}
          description={loginDisabledBody}
          confirmLabel="OK"
          onConfirm={() => router.replace(loginHref)}
        />
      )}
    </div>
  )
}
