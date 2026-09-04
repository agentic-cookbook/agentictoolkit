import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HomeGate } from '../HomeGate'
import { HomeAuthGate } from '../HomeAuthGate'

// Mutable auth state + spies, hoisted so the vi.mock factories below can close
// over them (vi.mock is hoisted above normal top-level declarations).
const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: true },
  replace: vi.fn(),
  pathname: '/home',
  beginLogin: vi.fn(),
  providerSeen: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname,
}))
vi.mock('../context', () => ({
  useAuth: () => mocks.auth,
  // Marker provider: records that it mounted, so the tests below can pin which
  // gate does / does not bring its own AuthProvider.
  AuthProvider: ({ children }: { children: ReactNode }) => {
    mocks.providerSeen()
    return <div data-testid="auth-provider">{children}</div>
  },
}))
// PARTIAL: only `beginLogin` is stood in for. `currentReturnTo` is the real one, because what
// these specs are about is WHICH address survives the round-trip — a stub would have this file
// assert the return address against itself. It reads `window.location` directly, so each spec
// below sets the real address rather than only `mocks.pathname` (which the gate still consults,
// as the dependency that makes the callback stale on a route change).
vi.mock('../sso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sso')>()),
  beginLogin: mocks.beginLogin,
}))

beforeEach(() => {
  mocks.auth = { isAuthenticated: false, isLoading: true }
  mocks.pathname = '/home'
  mocks.replace.mockClear()
  mocks.beginLogin.mockClear()
  mocks.providerSeen.mockClear()
  // Reset the whole address between tests, not just the query. HomeGate's returnTo is
  // `currentReturnTo()`, which is `pathname + search + hash` — so a leaked FRAGMENT pollutes
  // a later spec's assertion exactly as a leaked query does, and the specs below that set a
  // hash are the reason this line has to say so. `replaceState` to '/' clears all three at
  // once; the comment used to name only the query, which read as a promise this reset was
  // narrower than it is.
  window.history.replaceState({}, '', '/')
})

describe('HomeGate', () => {
  it('shows the skeleton while auth resolves — no children, no SSO redirect', () => {
    const { getByRole, queryByText } = render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(getByRole('status')).toBeTruthy()
    expect(queryByText('feature')).toBeNull()
    expect(mocks.beginLogin).not.toHaveBeenCalled()
  })

  it('renders the children once authenticated', () => {
    mocks.auth = { isAuthenticated: true, isLoading: false }
    const { getByText } = render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(getByText('feature')).toBeTruthy()
  })

  it('starts the SSO flow for unauthenticated visitors, returning to the gated path', () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    mocks.pathname = '/home'
    window.history.replaceState({}, '', '/home')
    render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(mocks.beginLogin).toHaveBeenCalledTimes(1)
    expect(mocks.beginLogin).toHaveBeenCalledWith({
      clientId: 'adh',
      authApiBase: undefined,
      returnTo: '/home',
    })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('preserves the query string in the SSO returnTo (not just the pathname)', () => {
    // A shared deep link like /home?q=agents&tag=llm must survive the SSO round-trip.
    // usePathname() alone drops the query; returnTo must carry pathname+search, exactly
    // as makeSmartHeaderAuth's currentPath() does for the same round-trip.
    mocks.auth = { isAuthenticated: false, isLoading: false }
    mocks.pathname = '/home'
    window.history.replaceState({}, '', '/home?q=agents&tag=llm')
    render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(mocks.beginLogin).toHaveBeenCalledWith({
      clientId: 'adh',
      authApiBase: undefined,
      returnTo: '/home?q=agents&tag=llm',
    })
  })

  it('preserves the fragment too, which is where a dialog records that it was open', () => {
    // The integrations console puts `#connections` in the address precisely so a return leg
    // can reopen the dialog, and SSO is a return leg. A returnTo built from pathname+search
    // drops it, and the visitor comes back to a console with everything shut — which reads
    // as the sign-in having lost their place.
    mocks.auth = { isAuthenticated: false, isLoading: false }
    mocks.pathname = '/acme'
    window.history.replaceState({}, '', '/acme?workspace=acme#connections')
    render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(mocks.beginLogin).toHaveBeenCalledWith({
      clientId: 'adh',
      authApiBase: undefined,
      returnTo: '/acme?workspace=acme#connections',
    })
  })

  it('redirects in-site instead of SSO when redirectInsteadOfSso is set', () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    render(
      <HomeGate redirectInsteadOfSso redirectTo="/">
        <div>feature</div>
      </HomeGate>,
    )
    expect(mocks.replace).toHaveBeenCalledWith('/')
    expect(mocks.beginLogin).not.toHaveBeenCalled()
  })

  it('mounts NO AuthProvider of its own — it relies on the site root provider', () => {
    // A nested provider would exchange a bounced single-use SSO #code twice
    // (docs/cross-site-auth.md); this pins the provider-less contract.
    mocks.auth = { isAuthenticated: true, isLoading: false }
    const { queryByTestId } = render(
      <HomeGate>
        <div>feature</div>
      </HomeGate>,
    )
    expect(queryByTestId('auth-provider')).toBeNull()
    expect(mocks.providerSeen).not.toHaveBeenCalled()
  })
})

describe('HomeAuthGate', () => {
  it('is AuthProvider + HomeGate — for sites WITHOUT a root provider', () => {
    mocks.auth = { isAuthenticated: true, isLoading: false }
    const { getByTestId, getByText } = render(
      <HomeAuthGate>
        <div>feature</div>
      </HomeAuthGate>,
    )
    expect(getByTestId('auth-provider')).toBeTruthy()
    expect(mocks.providerSeen).toHaveBeenCalledTimes(1)
    expect(getByText('feature')).toBeTruthy()
  })

  it('forwards the gate config through to HomeGate (SSO with the gated path)', () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    mocks.pathname = '/home/deep'
    window.history.replaceState({}, '', '/home/deep')
    render(
      <HomeAuthGate clientId="acme" authApiBase="https://as.example">
        <div>feature</div>
      </HomeAuthGate>,
    )
    expect(mocks.beginLogin).toHaveBeenCalledWith({
      clientId: 'acme',
      authApiBase: 'https://as.example',
      returnTo: '/home/deep',
    })
  })
})
