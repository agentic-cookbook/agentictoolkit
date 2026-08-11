import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context'

// The AuthProvider's cold-load silent SSO runs on EVERY brand site, so its gating
// is safety-critical. Two independent things have to hold before it navigates: the
// probe must be WORTH it (a hint cookie, or a cross-apex site that cannot read one)
// and it must be SAFE (the AS confirms it will bounce the browser back to this
// origin rather than strand it on the central login page). The second is asked over
// the same-origin /api proxy, which is why the fetch stub below is path-aware.

let savedLocation: PropertyDescriptor | undefined
function stubLocation(
  // status.example.com shares the registrable domain (example.com) with the AS host
  // api.example.com below, so these are SAME-apex (hint-gated, no anonymous probe).
  origin = 'https://status.example.com',
  pathname = '/dashboard',
): { origin: string; href: string; hash: string; pathname: string } {
  const loc = {
    origin,
    hostname: new URL(origin).hostname,
    href: '',
    hash: '',
    pathname,
    search: '',
  }
  savedLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
  return loc
}

function setHint(present: boolean): void {
  document.cookie = present
    ? 'adh_sso_hint=1'
    : 'adh_sso_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

function Probe(): ReactElement {
  const { isLoading, isAuthenticated } = useAuth()
  return <div>{isLoading ? 'loading' : isAuthenticated ? 'user' : 'anon'}</div>
}

/** Whether the stubbed AS says it will return the browser to this origin. Set per
 *  test; the default is the ordinary case of a correctly registered site. */
let preflightAllowed = true

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setHint(false)
  preflightAllowed = true
  process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
  // Path-aware: the preflight is a real request the provider makes before it can
  // navigate, so it needs its own answer. Everything else 401s — no per-site
  // session, so the bootstrap refresh fails and the silent path is reached.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/oauth/signin/preflight')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ allowed: preflightAllowed }),
        } as Response
      }
      return { ok: false, status: 401, json: async () => ({}) } as Response
    }),
  )
})

afterEach(() => {
  if (savedLocation) Object.defineProperty(window, 'location', savedLocation)
  setHint(false)
  vi.unstubAllGlobals()
  delete process.env.NEXT_PUBLIC_AUTH_API_URL
})

describe('AuthProvider cold-load silent SSO', () => {
  it('redirects to /authorize?prompt=none when the hint cookie is present', async () => {
    setHint(true)
    const loc = stubLocation()

    render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(loc.href).not.toBe(''))
    const url = new URL(loc.href)
    expect(url.origin + url.pathname).toBe('https://api.example.com/oauth/signin/authorize')
    expect(url.searchParams.get('prompt')).toBe('none')
  })

  // Same apex as the AS, so the hint cookie is readable and its absence is
  // conclusive: there is no central session to restore, and asking would spend a
  // redirect to learn nothing.
  it('does NOT redirect when there is no hint on a SAME-APEX site', async () => {
    const loc = stubLocation()

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    // Settles to logged-out without ever navigating away.
    await waitFor(() => getByText('anon'))
    expect(loc.href).toBe('')
  })

  // A dev.local suite satellite is a real cross-site SSO client: it shares the
  // `dev.local` registrable domain with the suite's AS, so the hint cookie is readable
  // and the AS allow-lists `https://*.dev.local`. Skipping the restore here is what made
  // a signed-in developer land on a satellite with a logged-out header.
  it('restores on a LOCAL dev.local suite host when the hint cookie is present', async () => {
    setHint(true)
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.dev.local'
    const loc = stubLocation('https://projects.hub-mybranch.dev.local')

    render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(loc.href).not.toBe(''))
    const url = new URL(loc.href)
    expect(url.origin + url.pathname).toBe('https://adh-backend.dev.local/oauth/signin/authorize')
    expect(url.searchParams.get('prompt')).toBe('none')
  })

  // The stranding case, and the reason the probe used to be refused on landing
  // routes and local hosts. A bare `next dev` on localhost:3000 is not on the AS
  // return-origin allow-list, so /authorize would send the browser to the central
  // login page rather than back. The preflight says so, and the provider stays put.
  // Locality is no longer the test — being un-allow-listed is, which is the thing
  // that actually mattered and is true of a newly registered PROD site too.
  it('does NOT redirect when the AS will not return the browser to this origin', async () => {
    preflightAllowed = false
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.dev.local'
    const loc = stubLocation('http://localhost:3000')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => getByText('anon'))
    expect(loc.href).toBe('')
  })

  it('does NOT redirect when silentSso is disabled even with a hint', async () => {
    setHint(true)
    const loc = stubLocation()

    const { getByText } = render(
      <AuthProvider clientId="adh" silentSso={false}>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => getByText('anon'))
    expect(loc.href).toBe('')
  })

  // The landing page is the route this whole mechanism exists for. It is where a
  // typed URL or a bookmark lands, so it is where a signed-in visitor most often
  // arrives with no per-site session — and it used to be the one route that refused
  // to look, which is why the front page of every cross-apex site showed a
  // logged-out header to a signed-in user. It restores like any other route now.
  it('DOES restore from the landing page — that is where a cold visit lands', async () => {
    setHint(true)
    const loc = stubLocation('https://status.example.com', '/')

    render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(loc.href).not.toBe(''))
    expect(new URL(loc.href).searchParams.get('prompt')).toBe('none')
  })

  // …but the risk that justified the old refusal is what is actually gone, so the
  // landing page must still be the safe case when the bounce genuinely cannot
  // complete. This is the pairing that makes the change sound rather than a trade.
  it('does NOT redirect from the landing page when the AS will not return', async () => {
    preflightAllowed = false
    setHint(true)
    const loc = stubLocation('https://status.example.com', '/')

    const { getByText } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => getByText('anon'))
    expect(loc.href).toBe('')
  })
})
