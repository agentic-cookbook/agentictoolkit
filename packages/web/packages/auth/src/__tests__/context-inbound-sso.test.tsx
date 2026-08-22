import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode, type ReactElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context'

// The AuthProvider exchanges an inbound SSO result (#code / #error) IN PLACE on a
// content page — the same provider the header reads — so a silent-restore bounce
// or a site-switch landing updates only the header, with NO callback bounce and
// NO full-page reload. On the dedicated callback route it stands aside and lets
// AuthCallback own the exchange.

let savedLocation: PropertyDescriptor | undefined

function stubLocation(
  pathname: string,
  hash: string,
): { href: string; replace: ReturnType<typeof vi.fn> } {
  const loc = {
    origin: 'https://cookbook.example.com',
    hostname: 'cookbook.example.com',
    href: `https://cookbook.example.com${pathname}${hash}`,
    pathname,
    search: '',
    hash,
    replace: vi.fn(),
  }
  savedLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
  return loc
}

function Probe(): ReactElement {
  const { isLoading, isAuthenticated } = useAuth()
  return <div>{isLoading ? 'loading' : isAuthenticated ? 'user' : 'anon'}</div>
}

let fetched: string[] = []

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  fetched = []
  // history.replaceState (used to strip the #code) fights the stubbed location —
  // no-op it.
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      fetched.push(url)
      if (url.includes('exchange')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            token: 'access-token',
            refreshToken: 'refresh-token',
            user: { id: 'u1', email: 'a@b.com', name: 'A' },
          }),
        } as Response
      }
      // Any other call (e.g. the bootstrap refresh) → no session.
      return { ok: false, status: 401, json: async () => ({}) } as Response
    }),
  )
})

afterEach(() => {
  if (savedLocation) Object.defineProperty(window, 'location', savedLocation)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AuthProvider inbound SSO (in place)', () => {
  it('exchanges an inbound #code on a content page and logs in WITHOUT navigating', async () => {
    const loc = stubLocation('/home', '#code=abc')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => getByText('user'))
    // Exchanged the code…
    expect(fetched.some((u) => u.includes('exchange'))).toBe(true)
    // …and never navigated away (no callback bounce, no AS redirect).
    expect(loc.href).toBe('https://cookbook.example.com/home#code=abc')
    expect(loc.replace).not.toHaveBeenCalled()
  })

  it('stays anonymous on #error=login_required without navigating', async () => {
    const loc = stubLocation('/home', '#error=login_required')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => getByText('anon'))
    expect(fetched.some((u) => u.includes('exchange'))).toBe(false)
    expect(loc.replace).not.toHaveBeenCalled()
  })

  it('settles anonymous on #error=login_required under React StrictMode', async () => {
    // The sibling test above renders WITHOUT StrictMode, which is why this stayed
    // hidden. StrictMode double-invokes the effect: pass 1 is cancelled by its own
    // cleanup partway through (at the `if (cancelled) return` after the refresh),
    // so it never clears isLoading — and pass 2 must therefore be allowed to run
    // to the end and clear it. A once-guard that bails pass 2 outright strands
    // isLoading at true forever, and every RequireAuth gate below shows its
    // loading skeleton for the rest of the page's life. The guard exists for the
    // single-use `#code`; an `#error` has nothing to consume twice.
    const loc = stubLocation('/home', '#error=login_required')

    const { getByText } = render(
      <StrictMode>
        <AuthProvider clientId="adh">
          <Probe />
        </AuthProvider>
      </StrictMode>,
    )

    await waitFor(() => getByText('anon'))
    expect(fetched.some((u) => u.includes('exchange'))).toBe(false)
    expect(loc.replace).not.toHaveBeenCalled()
  })

  it('keeps an existing session when an inbound #code fails to exchange (stray fragment)', async () => {
    // A logged-in user (valid stored tokens) lands on a content page carrying a
    // stray `#code` that is NOT an SSO landing. The failed exchange must fall
    // through to the normal bootstrap and restore the session — never log out.
    window.localStorage.setItem(
      'auth_tokens',
      JSON.stringify({ accessToken: 'stored', refreshToken: '' }),
    )
    vi.unstubAllGlobals()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        fetched.push(url)
        if (url.includes('exchange')) {
          // The stray code is not a real exchange code → fails.
          return { ok: false, status: 400, json: async () => ({ error: 'bad code' }) } as Response
        }
        if (url.includes('/api/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'u1', email: 'a@b.com', name: 'A' }),
          } as Response
        }
        return { ok: false, status: 401, json: async () => ({}) } as Response
      }),
    )
    stubLocation('/promo', '#code=SAVE20')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    // Falls through to the stored session instead of dropping it.
    await waitFor(() => getByText('user'))
    expect(fetched.some((u) => u.includes('exchange'))).toBe(true)
    expect(window.localStorage.getItem('auth_tokens')).not.toBeNull()
  })

  it('POSTs a one-time code only ONCE under React StrictMode (no double-consume)', async () => {
    // StrictMode double-invokes effects in dev; without a once-guard the second
    // pass re-POSTs the single-use code (the first consumed it) → 401 → anonymous.
    let exchangeCalls = 0
    vi.unstubAllGlobals()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        fetched.push(url)
        if (url.includes('exchange')) {
          exchangeCalls += 1
          if (exchangeCalls > 1) {
            // A real one-time code is already spent → a 2nd POST 401s.
            return { ok: false, status: 401, json: async () => ({}) } as Response
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ token: 'access-token', user: { id: 'u1', email: 'a@b.com', name: 'A' } }),
          } as Response
        }
        return { ok: false, status: 401, json: async () => ({}) } as Response
      }),
    )
    stubLocation('/home', '#code=abc')

    const { getByText } = render(
      <StrictMode>
        <AuthProvider clientId="adh">
          <Probe />
        </AuthProvider>
      </StrictMode>,
    )

    await waitFor(() => getByText('user'))
    expect(exchangeCalls).toBe(1) // the one-time code was exchanged exactly once
  })

  it('does NOT exchange on the dedicated callback route (AuthCallback owns it)', async () => {
    stubLocation('/auth/callback', '#code=abc')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    // Stands aside: falls through to the normal bootstrap, settling anonymous and
    // never trading the code (the callback's own provider would do that).
    await waitFor(() => getByText('anon'))
    expect(fetched.some((u) => u.includes('exchange'))).toBe(false)
  })
})
