import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context'

// The AuthProvider's cold-load silent SSO runs on EVERY brand site, so its gating
// is safety-critical: it must redirect to the AS ONLY when the hint cookie says a
// central session likely exists — never for anonymous / public visitors.

let savedLocation: PropertyDescriptor | undefined
function stubLocation(): { origin: string; href: string; hash: string; pathname: string } {
  // status.example.com shares the registrable domain (example.com) with the AS host
  // api.example.com below, so these are SAME-apex (hint-gated, no anonymous probe).
  const loc = {
    origin: 'https://status.example.com',
    hostname: 'status.example.com',
    href: '',
    hash: '',
    pathname: '/',
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

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setHint(false)
  process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
  // No per-site session: the bootstrap refresh fails.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response),
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

  it('does NOT redirect when there is no hint (anonymous / cross-apex visitor)', async () => {
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
})
