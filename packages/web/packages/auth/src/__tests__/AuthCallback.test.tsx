import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthCallback } from '../AuthCallback'

// Regression guard for the "two clicks to log in" bug: after the exchange writes
// the session, AuthCallback MUST do a full-page navigation (window.location.replace),
// not a client-side router.replace. The header is rendered by the app-level
// AuthProvider in the root layout — a different instance from the one this page
// mounts — and only a hard navigation remounts the app shell so it boots with the
// freshly-stored session. A client-side nav leaves the header logged-out until the
// next full load.

let savedLocation: PropertyDescriptor | undefined

function stubLocation(replace: () => void, hash = '#code=abc'): void {
  savedLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://status.example.com',
      href: `https://status.example.com/auth/callback${hash}`,
      // A real window.location always carries hostname/host; env detection
      // (detectEnv) reads it, so the stub must too or it throws on undefined.
      hostname: 'status.example.com',
      host: 'status.example.com',
      hash,
      pathname: '/auth/callback',
      replace,
    },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  // history.replaceState (used to strip the #code) is irrelevant here and can
  // fight the stubbed location — no-op it.
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
})

afterEach(() => {
  if (savedLocation) Object.defineProperty(window, 'location', savedLocation)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AuthCallback', () => {
  it('does a FULL-PAGE navigation (not client-side) after a successful exchange', async () => {
    const replace = vi.fn()
    stubLocation(replace)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        // Bootstrap refresh on mount → no session yet.
        if (url.includes('/api/auth/refresh')) {
          return { ok: false, status: 401, json: async () => ({}) } as Response
        }
        // The one-time-code exchange → a real session.
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
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }),
    )

    render(<AuthCallback clientId="adh" redirectTo="/home" />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
  })

  it('shows human copy (not the raw TypeError) when the exchange dies at the network level', async () => {
    const replace = vi.fn()
    stubLocation(replace)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/auth/refresh')) {
          return { ok: false, status: 401, json: async () => ({}) } as Response
        }
        // The exchange POST never completes — connection drop / request blocked.
        if (url.includes('exchange')) {
          throw new TypeError('Failed to fetch')
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }),
    )

    const { queryByText, findByText } = render(<AuthCallback clientId="adh" redirectTo="/home" />)

    // The exchange retries once (short pause) before surfacing the failure.
    await findByText(
      'Could not reach the sign-in service. Check your connection and try again.',
      undefined,
      { timeout: 4000 },
    )
    expect(queryByText('Failed to fetch')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('treats #error=login_required as a silent no-op: returns to the page, no error shown', async () => {
    const replace = vi.fn()
    stubLocation(replace, '#error=login_required')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response),
    )

    const { queryByText } = render(<AuthCallback clientId="adh" redirectTo="/home" />)

    // Quietly navigates back; never surfaces a sign-in error.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(queryByText('Sign-in failed')).toBeNull()
  })
})
