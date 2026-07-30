import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MarketingSiteHeader } from '../marketing/MarketingSiteHeader'

// Mutable auth state + spies, hoisted for the vi.mock factories below.
const mocks = vi.hoisted(() => ({
  auth: {
    user: null as { email?: string; name?: string | null; avatarUrl?: string } | null,
    isLoading: false,
    logout: vi.fn(async () => {}),
  },
  beginLogin: vi.fn(),
  ssoSwitchUrl: vi.fn((href: string) => `sso:${href}`),
}))

// header-auth consumes the toolkit barrel since the auth convergence — mock the
// symbols it pulls (useAuth / beginLogin / ssoSwitchUrl / isAdmin). isAdmin mirrors the
// real impl (capability check) so a test that sets an admin-capable user would see
// userIsAdmin flip; the marketing user has none.
//
// The BARE SPECIFIER is correct now, and only now. While this file lived in the former `@adh/chrome`
// it had to name the toolkit submodule's source path instead: nothing in chrome imported
// the auth package directly — `header-auth` did, from across a workspace boundary, out of
// the TOOLKIT workspace's own node_modules — so a bare-specifier mock registered under an
// id nothing resolved to and silently did not apply (the real useAuth then threw "useAuth
// must be used within an AuthProvider"). Inside the toolkit that boundary is gone: this
// file and `@agentic-toolkit/adh/header-auth` resolve `@agentic-toolkit/auth` to the same
// workspace package, so the mock binds. Do not reintroduce a path form — it would pin the
// mock to one submodule layout and break the moment the package is consumed standalone.
vi.mock('@agentic-toolkit/auth', () => ({
  useAuth: () => mocks.auth,
  beginLogin: mocks.beginLogin,
  ssoSwitchUrl: mocks.ssoSwitchUrl,
  isAdmin: (u: { capabilities?: readonly string[] } | null | undefined) =>
    !!u?.capabilities?.includes('admin'),
}))
// Probe header: renders just enough of the site header's auth slice to assert what the
// smart source produced — the real header is not under test here. The specifier follows
// the component: MarketingSiteHeader renders the header barrel's `SiteHeader` (the
// registry-bound half), not the registry-free `AdhHeader` the same barrel also publishes.
// It matches the SUT's own specifier exactly — MarketingSiteHeader.tsx imports SiteHeader
// by this package path, never relatively, because `header/index` is its own tsup entry.
//
// Since Task 6.2 the probe must INVOKE `useAuthSource` itself. That component absorbed
// the auth-source wrapper, so the source is no longer run on this side of the boundary
// and handed over as resolved props — MarketingSiteHeader now passes the hook down and
// SiteHeader calls it. Calling it here (in a component body, unconditionally) is what
// keeps this file testing the SOURCE rather than the mock.
vi.mock('@agentic-toolkit/adh/header', () => ({
  SiteHeader: ({
    useAuthSource,
    ...rest
  }: {
    useAuthSource: (opts: Record<string, unknown>) => {
      user: { name: string } | null
      authLoading?: boolean
      onLogin?: () => void
      onSignup?: () => void
      onLogout?: () => void
      resolveSwitchHref?: (href: string) => string
    }
    clientId?: string
    onAfterLogout?: () => void
  }) => {
    const props = useAuthSource({ clientId: rest.clientId, onAfterLogout: rest.onAfterLogout })
    return (
      <div>
        <span data-testid="user">{props.user ? props.user.name : 'anonymous'}</span>
        <span data-testid="loading">{props.authLoading ? 'yes' : 'no'}</span>
        <span data-testid="switch">{props.resolveSwitchHref ? props.resolveSwitchHref('/x') : 'none'}</span>
        <button onClick={props.onLogin}>Login</button>
        <button onClick={props.onSignup}>Sign up</button>
      </div>
    )
  },
}))

beforeEach(() => {
  mocks.auth = { user: null, isLoading: false, logout: vi.fn(async () => {}) }
  mocks.beginLogin.mockClear()
  window.history.replaceState({}, '', '/')
})

describe('MarketingSiteHeader', () => {
  it('signed out: Login and Sign up both run the SSO flow returning to the current page', () => {
    window.history.replaceState({}, '', '/details/pricing?plan=pro')
    const { getByText, getByTestId } = render(<MarketingSiteHeader siteId="academy" />)
    expect(getByTestId('user').textContent).toBe('anonymous')
    // Signed out: site switches don't ride the silent-SSO bounce.
    expect(getByTestId('switch').textContent).toBe('none')

    fireEvent.click(getByText('Login'))
    expect(mocks.beginLogin).toHaveBeenCalledWith({
      clientId: 'adh',
      returnTo: '/details/pricing?plan=pro',
    })
    fireEvent.click(getByText('Sign up'))
    expect(mocks.beginLogin).toHaveBeenCalledTimes(2)
    expect(mocks.beginLogin).toHaveBeenLastCalledWith({
      clientId: 'adh',
      returnTo: '/details/pricing?plan=pro',
    })
  })

  it('signed in: shows the avatar user and routes site switches through silent SSO', () => {
    mocks.auth.user = { email: 'dev@example.com', name: 'Dev' }
    const { getByTestId } = render(<MarketingSiteHeader siteId="academy" />)
    expect(getByTestId('user').textContent).toBe('Dev')
    expect(getByTestId('switch').textContent).toBe('sso:/x')
  })

  it('reports authLoading while the session resolves (spinner, not a signed-out flash)', () => {
    mocks.auth.isLoading = true
    const { getByTestId } = render(<MarketingSiteHeader siteId="academy" />)
    expect(getByTestId('loading').textContent).toBe('yes')
  })

  it('survives re-render across auth-state changes (module-scope source, stable hook order)', () => {
    const { rerender, getByTestId } = render(<MarketingSiteHeader siteId="academy" />)
    expect(getByTestId('user').textContent).toBe('anonymous')
    mocks.auth.user = { email: 'dev@example.com', name: 'Dev' }
    rerender(<MarketingSiteHeader siteId="academy" />)
    expect(getByTestId('user').textContent).toBe('Dev')
  })
})
