'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { reportAuthError, reportUnexpectedAuthError } from './report'
import { configureAuth } from './config'
import { hasCapability, type AuthTokens, type AuthUser } from './types'
import { authedJson, exchangeSsoCode, extractErrorMessage, extractErrorCode, AuthHttpError, DEFAULT_EXCHANGE_PATH } from './client'
import { tokensFromResponse, type BackendTokenFields } from './tokens'
import { clearTokens, readTokens, readUser, writeTokens, writeUser } from './tokens'
import {
  completeLoginCode,
  completeLoginPasskey,
  passwordlessPasskeyLogin,
  requestLoginSms,
  type MfaChallenge,
  type MfaCodeMethod,
} from './mfa'
import { invalidateRefresh, refreshAccessToken } from './refresh'
import {
  beginSilentLogin,
  clearSsoChecked,
  markSsoChecked,
  parseInboundSso,
  shouldSilentRestore,
  ssoLogout,
  stripSsoFragment,
} from './sso'

/** True for a local-development hostname (localhost / loopback / *.local /
 *  *.localhost). A generic heuristic, not a site-registry lookup — deliberately
 *  matching the 'local' branch of the adh registry's detectEnv so the silent-SSO
 *  skip below behaves identically whether a host consumes this package directly
 *  or through the @adh-shared/auth shim. */
/** The local-development hostname rule gating the silent-SSO skip. EXPORTED so the adh
 *  monorepo's parity test can pin it against @adh-shared/adh's detectEnv 'local' branch —
 *  the two are deliberate mirrors (this package can't import the host registry), and an
 *  unpinned mirror is how environment-dependent login loops slip in. */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/:\d+$/, '')
  return (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  )
}

export interface AuthContextValue<U extends AuthUser = AuthUser> {
  user: U | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  /** Resolves to the signed-in user, OR to an {@link MfaChallenge} when the account
   *  has an enrolled second factor (HTTP 202). The caller completes the challenge via
   *  sendMfaSms / completeMfa / completeMfaPasskey. */
  login: (email: string, password: string) => Promise<U | MfaChallenge>
  register: (email: string, password: string, name: string) => Promise<U>
  /** Push an SMS login code during a pending MFA challenge. */
  sendMfaSms: (token: string) => Promise<void>
  /** Complete a pending MFA challenge with a typed code (sms / totp / recovery). */
  completeMfa: (token: string, method: MfaCodeMethod, code: string) => Promise<U>
  /** Complete a pending MFA challenge with a passkey / security key (browser ceremony). */
  completeMfaPasskey: (token: string) => Promise<U>
  /** Passwordless passkey sign-in (no password step). */
  loginWithPasskey: (identifier: string) => Promise<U>
  loginWithTokens: (tokens: AuthTokens, user?: U) => Promise<U>
  logout: () => Promise<void>
}

export interface AuthProviderProps<U extends AuthUser> {
  children: ReactNode
  /** OAuth client id ('adh' for brand sites, 'admin' for the console). Selects
   *  the return-origin allow-list the AS validates the post-logout redirect
   *  against (see logout → ssoLogout). */
  clientId: string
  /** localStorage key for this site (default "auth_tokens"). */
  storageKey?: string
  /** When false, `register` rejects (admin). Default true. */
  enableRegister?: boolean
  /** When set, users lacking this capability are rejected + revoked (admin: "admin"). */
  requireCapability?: string
  /** Map the backend user onto the site's user type. Default: identity. */
  mapUser?: (raw: AuthUser) => U
  /** On cold load with no per-site session, silently restore an existing central
   *  session (hint-gated, so anonymous/cross-apex visitors never redirect).
   *  Default true. The AuthCallback's own provider disables it. */
  silentSso?: boolean
  /** The route that owns the dedicated OAuth callback (default '/auth/callback').
   *  On every OTHER page this provider exchanges an inbound `#code` in place so
   *  the header updates with no reload; on the callback route it stands aside and
   *  lets {@link AuthCallback} do the exchange. */
  callbackPath?: string
  /** Same-origin one-time-code exchange endpoint (default the BFF proxy path). */
  exchangePath?: string
}

const AuthContext = createContext<AuthContextValue<AuthUser> | null>(null)

type BackendAuthResponse = BackendTokenFields & { user: AuthUser }

async function revokeSession(): Promise<void> {
  try {
    const res = await fetch('/api/auth/revoke', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      keepalive: true,
    })
    if (!res.ok) console.error(`/api/auth/revoke failed: HTTP ${res.status}`)
  } catch (err) {
    // Network failure logging out — the central session may not be invalidated
    // server-side, so this is worth surfacing.
    console.error('/api/auth/revoke network error', err)
    reportAuthError(err, { feature: 'auth', step: 'revokeSession' })
  }
}

export function AuthProvider<U extends AuthUser = AuthUser>({
  children,
  clientId,
  storageKey = 'auth_tokens',
  enableRegister = true,
  requireCapability,
  mapUser,
  silentSso = true,
  callbackPath = '/auth/callback',
  exchangePath = DEFAULT_EXCHANGE_PATH,
}: AuthProviderProps<U>): ReactElement {
  // Set per-site runtime config exactly once, synchronously, before any child
  // effect can call authedJson/refresh.
  useState(() => {
    configureAuth({ storageKey })
    return null
  })

  const [user, setUser] = useState<U | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Captured at first render — before any child effect (AuthCallback) can strip
  // the callback's #code/#error — so the cold-load silent check can tell it is
  // mid-flow on the callback page and must not re-trigger.
  const [initialHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash : '',
  )

  const toUser = useCallback((raw: AuthUser): U => (mapUser ? mapUser(raw) : (raw as U)), [mapUser])

  // The bootstrap effect must run once on mount. Read the latest mapping via a
  // ref so an inline `mapUser` prop (a fresh identity each render) can't land in
  // the effect's dep array and retrigger /api/auth/me on every render.
  const toUserRef = useRef(toUser)
  toUserRef.current = toUser

  // Guards the one-time inbound-code exchange so it runs at most once per provider
  // instance — a 2nd effect pass (React StrictMode in dev, or a remount) must not
  // re-POST a single-use code. Mirrors AuthCallback's startedRef.
  const inboundStartedRef = useRef(false)

  const ensureAllowed = useCallback(
    async (raw: AuthUser): Promise<void> => {
      if (requireCapability && !hasCapability(raw, requireCapability)) {
        await revokeSession()
        throw new Error('You do not have access to this application.')
      }
    },
    [requireCapability],
  )

  const adoptTokens = useCallback((tokens: AuthTokens) => {
    writeTokens(tokens)
    setAccessToken(tokens.accessToken)
  }, [])

  // Single seam for "render this backend-confirmed user AND persist it for the
  // next cold load's optimistic restore": setUser and writeUser always move
  // together here, so the cache can't drift from what's on screen. Every trusted
  // set-user path (credential login, in-place SSO exchange, loginWithTokens, the
  // /api/auth/me revalidation) goes through this — a future set-user site that
  // forgets to cache is the bug this prevents. The optimistic READ deliberately
  // does NOT use this (it only reads the cache, nothing to re-persist).
  const applyUser = useCallback((raw: AuthUser): U => {
    writeUser(raw)
    const mapped = toUserRef.current(raw)
    setUser(mapped)
    return mapped
  }, [])

  // Single source for "trust this raw backend user + tokens": gate capability
  // BEFORE persisting (so a rejected user never leaves a token behind), persist,
  // then set the mapped user. Both credential login and the in-place SSO-code
  // exchange go through here so the security ordering can't drift between them.
  const commitRawSession = useCallback(
    async (raw: AuthUser, tokens: AuthTokens): Promise<U> => {
      await ensureAllowed(raw)
      adoptTokens(tokens)
      return applyUser(raw)
    },
    [ensureAllowed, adoptTokens, applyUser],
  )

  const dropTokens = useCallback(() => {
    invalidateRefresh()
    clearTokens()
    setUser(null)
    setAccessToken(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    // An inbound SSO result delivered to THIS content page — a silent-restore
    // bounce-back or a site-switch landing (return = this page). Exchange the
    // `#code` in place so only the header updates; no callback bounce, no full
    // reload. Gated to the app provider (silentSso) and off the dedicated
    // callback route, so neither AuthCallback's own provider nor the root
    // provider ON the callback page races AuthCallback for the one-time code.
    const onCallbackRoute =
      typeof window !== 'undefined' && window.location.pathname === callbackPath
    const inbound = silentSso && !onCallbackRoute ? parseInboundSso(initialHash) : null

    // Optimistic restore: a returning visitor already holds this site's tokens
    // and a cached user from a prior visit. Render the signed-in UI immediately
    // from that cache and let the /api/auth/me check below revalidate in the
    // background — so auth-gated content no longer waits out a backend
    // round-trip behind a "Loading…" gate. Skipped when an inbound SSO code is
    // about to swap the session, and on capability-gated sites (admin), where a
    // stale cache must never flash privileged UI to a since-revoked user.
    if (!requireCapability && !inbound) {
      const cachedTokens = readTokens()
      const cachedUser = cachedTokens ? readUser() : null
      if (cachedTokens && cachedUser) {
        setUser(toUserRef.current(cachedUser))
        setAccessToken(cachedTokens.accessToken)
        setIsLoading(false)
      }
    }

    ;(async () => {
      if (inbound) {
        // One-time code: a 2nd effect pass (StrictMode / remount) must NOT re-POST
        // it. Set the guard synchronously, before any await, so the second pass
        // bails here while the first pass's exchange (below) still resolves and
        // applies — hence no `cancelled` discard on the success path.
        if (inboundStartedRef.current) return
        inboundStartedRef.current = true
        // Strip the SSO `code`/`error` from the address bar but KEEP any other
        // fragment the page carried — the `#site-switch` up-walk marker (the AS
        // appends `&code=…` to it) or a scroll anchor.
        try {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search + stripSsoFragment(window.location.hash),
          )
        } catch {
          /* history unavailable (e.g. stubbed in tests) — harmless */
        }
        // Mark the tab checked up front so any fall-through below can't re-trigger
        // a silent probe loop.
        markSsoChecked()
        if (inbound.code) {
          try {
            // Discard any in-flight refresh so its late completion can't clobber
            // the tokens this exchange adopts (same guard as loginWithTokens).
            invalidateRefresh()
            const { tokens, user: raw } = await exchangeSsoCode(inbound.code, exchangePath)
            await commitRawSession(raw, tokens)
            setIsLoading(false)
            return // signed in via the inbound code
          } catch (err) {
            // A failed exchange must NOT drop an existing session: the `#code`
            // may be a stray fragment on a content page, not an SSO landing.
            // Fall through to the normal bootstrap so stored tokens still
            // restore the header. Report only a genuine 5xx/network failure — a
            // 4xx (a stray/expired code) is the expected stray-fragment case.
            console.error('SSO code exchange failed', err)
            reportUnexpectedAuthError(err, { feature: 'auth', step: 'inPlaceExchange' })
          }
        }
        // An `#error` (login_required from a silent check, or otherwise) or a
        // failed `#code`: don't force anonymous — fall through so any stored
        // per-site session still restores. markSsoChecked above stops the
        // fall-through from looping back into a fresh silent probe.
      }

      if (!readTokens()) {
        const refreshed = await refreshAccessToken()
        if (cancelled) return
        if (!refreshed) {
          // No per-site session. If a central session likely exists (readable
          // hint cookie ⇒ same-apex + signed in) and we haven't checked this tab,
          // silently restore it so the header reflects the login with no click.
          // Gated so anonymous / cross-apex / public visitors never redirect. The
          // bounced #code returns to THIS page and is exchanged in place above.
          //
          // This restore is a TOP-LEVEL navigation to the AS (the central session
          // cookie is host-only + SameSite=Lax, so a background fetch/iframe can't
          // read it) — it briefly yanks the whole page. In LOCAL dev the AS is a
          // remote host, so that's a remote round-trip on every cold load, usually
          // while anonymous, for nothing. Skip it locally: the page has already
          // rendered and the header settles to the login controls (the switcher
          // still restores on an explicit switch). Prod keeps the silent restore,
          // where it's a same-region edge round-trip.
          // Detect the env from the live hostname rather than a build-time
          // NEXT_PUBLIC_* literal — this shared package is built once and consumed
          // by every site, so the deployment env is a runtime property of where
          // it's served, not of how the package was compiled. (Inside a post-mount
          // effect, so `window` is available.)
          const isLocalDev = isLocalHostname(window.location.hostname)
          if (!isLocalDev && silentSso && shouldSilentRestore(initialHash)) {
            beginSilentLogin({ clientId })
            return // navigating away; keep isLoading true across the redirect
          }
          setIsLoading(false)
          return
        }
      }

      try {
        const me = await authedJson<AuthUser>('/api/auth/me')
        if (cancelled) return
        await ensureAllowed(me)
        if (cancelled) return
        applyUser(me)
        setAccessToken(readTokens()?.accessToken ?? null)
      } catch (err) {
        if (cancelled) return
        // Evict only on a definitive failure. authedFetch already did one
        // refresh+retry, so a surfaced 401 means the session is truly dead, and a
        // capability rejection (ensureAllowed throws a plain Error) clears too. A
        // transient backend error (5xx) — e.g. a cold-starting backend, the very
        // latency this optimistic path exists to hide — must NOT log out a valid,
        // already-rendered session: keep it and revalidate on the next load.
        const transient = err instanceof AuthHttpError && err.status >= 500
        if (transient) {
          // Backend 5xx during revalidation — report it (we keep the session). A
          // 401 / capability rejection is expected session death, so it's NOT
          // reported; it just evicts the tokens.
          reportAuthError(err, { feature: 'auth', step: 'meRevalidate' })
        } else {
          dropTokens()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    applyUser,
    commitRawSession,
    dropTokens,
    ensureAllowed,
    requireCapability,
    silentSso,
    clientId,
    initialHash,
    callbackPath,
    exchangePath,
  ])

  const postCredentials = useCallback(
    async (path: string, body: object, failMsg: string): Promise<U | MfaChallenge> => {
      // Discard any in-flight refresh from a prior session so its late
      // completion can't overwrite the tokens this login is about to adopt.
      invalidateRefresh()
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // Surface server (5xx) failures WITH the status (AuthHttpError) so callers
        // can tell them from a 4xx user error (wrong password / email taken) and
        // report only the former. Still prefers a JSON error/message/title from the
        // body. AuthHttpError extends Error, so existing `.message` consumers work.
        const errBody = await res.json().catch(() => null)
        const fallback = res.status >= 500 ? `Server error (${res.status})` : failMsg
        throw new AuthHttpError(res.status, extractErrorMessage(errBody, fallback), extractErrorCode(errBody))
      }
      const data = (await res.json()) as BackendAuthResponse & Partial<MfaChallenge>
      // A 202 with `mfaRequired` is NOT a session — the account owes a second factor.
      // Hand the challenge back to the caller (do NOT adopt the pending token as an
      // access token); the login UI completes it via sendMfaSms / completeMfa*.
      if (res.status === 202 && data.mfaRequired) {
        return { mfaRequired: true, token: data.token ?? '', methods: data.methods ?? [] }
      }
      // Gate capability BEFORE persisting tokens (so a rejected user never leaves
      // an access token in localStorage), then persist + set the user — the same
      // ordering the in-place SSO exchange uses, via the shared commitRawSession.
      return commitRawSession(data.user, tokensFromResponse(data))
    },
    [commitRawSession],
  )

  const login = useCallback(
    (email: string, password: string) => postCredentials('/api/auth/login', { email, password }, 'Login failed'),
    [postCredentials],
  )

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<U> => {
      if (!enableRegister) throw new Error('Registration is disabled.')
      const out = await postCredentials('/api/auth/register', { email, password, name }, 'Registration failed')
      // Registration never gates on MFA (the account has no factor yet).
      if ('mfaRequired' in out) throw new Error('Unexpected second-factor challenge during registration')
      return out
    },
    [enableRegister, postCredentials],
  )

  // --- Second-factor completion (used by the LoginCard MFA step) ---------------
  const sendMfaSms = useCallback((token: string) => requestLoginSms(token), [])

  const completeMfa = useCallback(
    async (token: string, method: MfaCodeMethod, code: string): Promise<U> => {
      invalidateRefresh()
      const data = await completeLoginCode(token, method, code)
      return commitRawSession(data.user, tokensFromResponse(data))
    },
    [commitRawSession],
  )

  const completeMfaPasskey = useCallback(
    async (token: string): Promise<U> => {
      invalidateRefresh()
      const data = await completeLoginPasskey(token)
      return commitRawSession(data.user, tokensFromResponse(data))
    },
    [commitRawSession],
  )

  const loginWithPasskey = useCallback(
    async (identifier: string): Promise<U> => {
      invalidateRefresh()
      const data = await passwordlessPasskeyLogin(identifier)
      return commitRawSession(data.user, tokensFromResponse(data))
    },
    [commitRawSession],
  )

  const loginWithTokens = useCallback(
    async (tokens: AuthTokens, knownUser?: U): Promise<U> => {
      // Discard any in-flight refresh (e.g. the mount bootstrap on the OAuth
      // callback page) so its late completion can't overwrite the tokens this
      // login adopts.
      invalidateRefresh()
      // When the caller already knows the user, gate-before-persist via the same
      // commitRawSession the credential + SSO-exchange paths use, so the ordering
      // can't drift across the three "trust this user" sites.
      if (knownUser) return commitRawSession(knownUser, tokens)
      // Without a known user we must adopt first: the /api/auth/me fetch needs
      // the Bearer token in storage. dropTokens() on throw cleans up that path.
      // (This branch gates AFTER adopting, so it can't use commitRawSession.)
      adoptTokens(tokens)
      try {
        const raw = await authedJson<AuthUser>('/api/auth/me')
        await ensureAllowed(raw)
        return applyUser(raw)
      } catch (err) {
        dropTokens()
        throw err
      }
    },
    [adoptTokens, applyUser, commitRawSession, dropTokens, ensureAllowed],
  )

  const logout = useCallback(async () => {
    dropTokens()
    // Re-arm the cold-load check so a later sign-in is auto-detected this tab.
    clearSsoChecked()
    // Revoke this site's first-party session, then end the central SSO session so
    // the next beginLogin can't silently log the user back in (revokeSession alone
    // leaves the central adh_sso cookie live). revokeSession is keepalive, so it
    // completes across the top-level navigation ssoLogout starts.
    void revokeSession()
    ssoLogout({ clientId })
  }, [dropTokens, clientId])

  const value = useMemo<AuthContextValue<AuthUser>>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      accessToken,
      login: login as AuthContextValue['login'],
      register: register as AuthContextValue['register'],
      sendMfaSms,
      completeMfa: completeMfa as AuthContextValue['completeMfa'],
      completeMfaPasskey: completeMfaPasskey as AuthContextValue['completeMfaPasskey'],
      loginWithPasskey: loginWithPasskey as AuthContextValue['loginWithPasskey'],
      loginWithTokens: loginWithTokens as AuthContextValue['loginWithTokens'],
      logout,
    }),
    [
      user,
      isLoading,
      accessToken,
      login,
      register,
      sendMfaSms,
      completeMfa,
      completeMfaPasskey,
      loginWithPasskey,
      loginWithTokens,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth<U extends AuthUser = AuthUser>(): AuthContextValue<U> {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx as unknown as AuthContextValue<U>
}
