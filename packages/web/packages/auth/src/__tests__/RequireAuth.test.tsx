import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RequireAuth } from '../RequireAuth'
import { RequireAuthSkeleton } from '../RequireAuthSkeleton'

// Mutable auth state + router spy, hoisted so the vi.mock factories below can
// close over them (vi.mock is hoisted above normal top-level declarations).
const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: true },
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('../context', () => ({ useAuth: () => mocks.auth }))

beforeEach(() => {
  mocks.auth = { isAuthenticated: false, isLoading: true }
  mocks.replace.mockClear()
})

describe('RequireAuth', () => {
  it('shows the skeleton fallback (role=status) while auth is resolving — not the children, no redirect', () => {
    mocks.auth = { isAuthenticated: false, isLoading: true }
    const { getByRole, queryByText } = render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    const status = getByRole('status')
    expect(status.className).toContain('adh-auth-skeleton')
    // role=status is a live region; its (SR-only) "Loading…" text is announced.
    expect(queryByText(/loading/i)).not.toBeNull()
    expect(queryByText('secret')).toBeNull()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('renders the children once authenticated', () => {
    mocks.auth = { isAuthenticated: true, isLoading: false }
    const { getByText } = render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(getByText('secret')).toBeTruthy()
  })

  it('uses a custom fallback when provided, overriding the skeleton', () => {
    mocks.auth = { isAuthenticated: false, isLoading: true }
    const { getByText, queryByRole } = render(
      <RequireAuth fallback={<div>custom-loading</div>}>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(getByText('custom-loading')).toBeTruthy()
    expect(queryByRole('status')).toBeNull()
  })

  it('redirects unauthenticated visitors once auth has resolved', () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    render(
      <RequireAuth redirectTo="/login">
        <div>secret</div>
      </RequireAuth>,
    )
    expect(mocks.replace).toHaveBeenCalledWith('/login')
  })

  it('runs onUnauthenticated instead of redirecting when provided', () => {
    mocks.auth = { isAuthenticated: false, isLoading: false }
    const onUnauthenticated = vi.fn()
    render(
      <RequireAuth onUnauthenticated={onUnauthenticated}>
        <div>secret</div>
      </RequireAuth>,
    )
    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

describe('RequireAuthSkeleton', () => {
  it('exposes a "Loading" status region and hides the decorative blocks from assistive tech', () => {
    const { getByRole, getByText, container } = render(<RequireAuthSkeleton />)
    // role=status is a live region; its (SR-only) "Loading…" text is what
    // assistive tech announces when the skeleton appears.
    expect(getByRole('status')).toBeTruthy()
    expect(getByText(/loading/i)).toBeTruthy()
    // Decorative grid + cards are out of the a11y tree (no "six empty boxes").
    expect(container.querySelector('.adh-auth-skeleton__grid')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('.adh-auth-skeleton__card')).toHaveLength(6)
  })
})
