'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { configureAuth } from './config'
import { hasCapability, type AuthTokens, type AuthUser } from './types'
import { authedJson, readErrorMessage } from './client'
import { tokensFromResponse, type BackendTokenFields } from './tokens'
import { clearTokens, readTokens, writeTokens } from './tokens'
import { invalidateRefresh, refreshAccessToken } from './refresh'

export interface AuthContextValue<U extends AuthUser = AuthUser> {
  user: U | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  login: (email: string, password: string) => Promise<U>
  register: (email: string, password: string, name: string) => Promise<U>
  loginWithTokens: (tokens: AuthTokens, user?: U) => Promise<U>
  logout: () => Promise<void>
}

export interface AuthProviderProps<U extends AuthUser> {
  children: ReactNode
  /** OAuth client id; reserved for future use by the provider. */
  clientId: string
  /** localStorage key for this site (default "auth_tokens"). */
  storageKey?: string
  /** When false, `register` rejects (admin). Default true. */
  enableRegister?: boolean
  /** When set, users lacking this capability are rejected + revoked (admin: "admin"). */
  requireCapability?: string
  /** Map the backend user onto the site's user type. Default: identity. */
  mapUser?: (raw: AuthUser) => U
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
    console.error('/api/auth/revoke network error', err)
  }
}

export function AuthProvider<U extends AuthUser = AuthUser>({
  children,
  storageKey = 'auth_tokens',
  enableRegister = true,
  requireCapability,
  mapUser,
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

  const toUser = useCallback((raw: AuthUser): U => (mapUser ? mapUser(raw) : (raw as U)), [mapUser])

  // The bootstrap effect must run once on mount. Read the latest mapping via a
  // ref so an inline `mapUser` prop (a fresh identity each render) can't land in
  // the effect's dep array and retrigger /api/auth/me on every render.
  const toUserRef = useRef(toUser)
  toUserRef.current = toUser

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

  const dropTokens = useCallback(() => {
    invalidateRefresh()
    clearTokens()
    setUser(null)
    setAccessToken(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!readTokens()) {
        const refreshed = await refreshAccessToken()
        if (cancelled) return
        if (!refreshed) {
          setIsLoading(false)
          return
        }
      }

      try {
        const me = await authedJson<AuthUser>('/api/auth/me')
        if (cancelled) return
        await ensureAllowed(me)
        if (cancelled) return
        setUser(toUserRef.current(me))
        setAccessToken(readTokens()?.accessToken ?? null)
      } catch {
        if (cancelled) return
        dropTokens()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dropTokens, ensureAllowed])

  const postCredentials = useCallback(
    async (path: string, body: object, failMsg: string): Promise<U> => {
      // Discard any in-flight refresh from a prior session so its late
      // completion can't overwrite the tokens this login is about to adopt.
      invalidateRefresh()
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // Surface server (5xx) failures as such instead of the generic
        // credential message — a 500 means the server is broken, not that the
        // password is wrong. readErrorMessage still prefers a JSON
        // error/message/title from the body when one is present.
        const fallback = res.status >= 500 ? `Server error (${res.status})` : failMsg
        throw new Error(await readErrorMessage(res, fallback))
      }
      const data = (await res.json()) as BackendAuthResponse
      // Gate on capability BEFORE persisting tokens, so a rejected user never
      // leaves an access token in localStorage. ensureAllowed revokes the
      // server session and throws when the capability is missing.
      await ensureAllowed(data.user)
      adoptTokens(tokensFromResponse(data))
      const mapped = toUser(data.user)
      setUser(mapped)
      return mapped
    },
    [adoptTokens, ensureAllowed, toUser],
  )

  const login = useCallback(
    (email: string, password: string) => postCredentials('/api/auth/login', { email, password }, 'Login failed'),
    [postCredentials],
  )

  const register = useCallback(
    (email: string, password: string, name: string): Promise<U> => {
      if (!enableRegister) return Promise.reject(new Error('Registration is disabled.'))
      return postCredentials('/api/auth/register', { email, password, name }, 'Registration failed')
    },
    [enableRegister, postCredentials],
  )

  const loginWithTokens = useCallback(
    async (tokens: AuthTokens, knownUser?: U): Promise<U> => {
      // Discard any in-flight refresh (e.g. the mount bootstrap on the OAuth
      // callback page) so its late completion can't overwrite the tokens this
      // login adopts.
      invalidateRefresh()
      // When the caller already knows the user, gate on capability BEFORE
      // persisting tokens, so a rejected user never leaves an access token in
      // localStorage — same ordering as postCredentials.
      if (knownUser) {
        await ensureAllowed(knownUser)
        adoptTokens(tokens)
        const mapped = toUser(knownUser)
        setUser(mapped)
        return mapped
      }
      // Without a known user we must adopt first: the /api/auth/me fetch needs
      // the Bearer token in storage. dropTokens() on throw cleans up that path.
      adoptTokens(tokens)
      try {
        const raw = await authedJson<AuthUser>('/api/auth/me')
        await ensureAllowed(raw)
        const mapped = toUser(raw)
        setUser(mapped)
        return mapped
      } catch (err) {
        dropTokens()
        throw err
      }
    },
    [adoptTokens, dropTokens, ensureAllowed, toUser],
  )

  const logout = useCallback(async () => {
    dropTokens()
    await revokeSession()
  }, [dropTokens])

  const value = useMemo<AuthContextValue<AuthUser>>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      accessToken,
      login: login as AuthContextValue['login'],
      register: register as AuthContextValue['register'],
      loginWithTokens: loginWithTokens as AuthContextValue['loginWithTokens'],
      logout,
    }),
    [user, isLoading, accessToken, login, register, loginWithTokens, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth<U extends AuthUser = AuthUser>(): AuthContextValue<U> {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx as unknown as AuthContextValue<U>
}
