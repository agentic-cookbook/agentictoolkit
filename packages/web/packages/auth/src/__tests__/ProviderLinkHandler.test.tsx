// websites/shared/auth/src/__tests__/ProviderLinkHandler.test.tsx
import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const linkProvider = vi.fn()
let authed = true

vi.mock('../client', () => {
  class AuthHttpError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code?: string,
    ) {
      super(message)
      this.name = 'AuthHttpError'
    }
  }

  return {
    linkProvider: (...a: unknown[]) => linkProvider(...a),
    AuthHttpError,
  }
})
vi.mock('../sso', () => ({
  LINK_NONCE_KEY: 'adh_link_nonce',
  PENDING_LINK_KEY: 'adh_pending_link',
}))
vi.mock('../context', () => ({ useAuth: () => ({ isAuthenticated: authed }) }))
// Render the modal as plain text so this unit test asserts the handler's LOGIC and
// result copy without standing up base-ui's portal/focus machinery in jsdom.
vi.mock('@agentic-toolkit/ui/components/alert-modal', () => ({
  AlertModal: ({ title, description }: { title: string; description?: ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}))
import { ProviderLinkHandler } from '../ProviderLinkHandler'

function setHash(h: string) { Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, hash: h, pathname: '/home', search: '' } }) }

beforeEach(() => { authed = true; linkProvider.mockReset().mockResolvedValue(undefined); window.sessionStorage.clear(); setHash('') })

describe('ProviderLinkHandler', () => {
  it('completes the link from #link_code (with a matching nonce) and shows success', async () => {
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    setHash('#link_code=c1&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n1')
    render(<ProviderLinkHandler />)
    await waitFor(() => expect(linkProvider).toHaveBeenCalledWith({ clientSlug: 'adh', providerSlug: 'github', code: 'c1', redirectUri: 'https://as/cb' }))
    // Success modal: title + "added as a sign-in method" body.
    await screen.findByText(/GitHub connected/i)
    await screen.findByText(/added as a sign-in method/i)
    // The one-time nonce is consumed.
    expect(window.sessionStorage.getItem('adh_link_nonce')).toBeNull()
  })

  it('REFUSES a forged #link_code whose nonce does not match this browser (CSRF)', async () => {
    // No adh_link_nonce stashed: the user never started a link here, so an
    // injected fragment (attacker-supplied code+nonce) must NOT be linked.
    setHash('#link_code=evil&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=attacker')
    render(<ProviderLinkHandler />)
    await Promise.resolve()
    expect(linkProvider).not.toHaveBeenCalled()
  })

  it('REFUSES a #link_code with no nonce at all', async () => {
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    setHash('#link_code=evil&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb')
    render(<ProviderLinkHandler />)
    await Promise.resolve()
    expect(linkProvider).not.toHaveBeenCalled()
  })

  it('does NOT complete a #link_code while unauthenticated, preserving the nonce', async () => {
    authed = false
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    setHash('#link_code=c1&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n1')
    render(<ProviderLinkHandler />)
    await Promise.resolve()
    expect(linkProvider).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('adh_link_nonce')).toBe('n1')
  })

  it('clears any pending intent when it commits to completing the link', async () => {
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    window.sessionStorage.setItem('adh_pending_link', 'github')
    setHash('#link_code=c1&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n1')
    render(<ProviderLinkHandler />)
    await waitFor(() => expect(linkProvider).toHaveBeenCalled())
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
  })

  it('treats a 409 provider_linked_self as idempotent success', async () => {
    const { AuthHttpError } = await import('../client')
    linkProvider.mockRejectedValueOnce(new AuthHttpError(409, 'already linked to your account', 'provider_linked_self'))
    window.sessionStorage.setItem('adh_link_nonce', 'n2')
    window.sessionStorage.setItem('adh_pending_link', 'github')
    setHash('#link_code=c2&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n2')
    render(<ProviderLinkHandler />)
    await waitFor(() => expect(linkProvider).toHaveBeenCalledWith({ clientSlug: 'adh', providerSlug: 'github', code: 'c2', redirectUri: 'https://as/cb' }))
    await screen.findByText(/GitHub is already connected/i)
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
  })

  it('shows an error AND clears the pending intent on a 409 provider_linked_other (no re-link loop)', async () => {
    const { AuthHttpError } = await import('../client')
    linkProvider.mockRejectedValueOnce(new AuthHttpError(409, 'this provider identity is already linked to another account', 'provider_linked_other'))
    window.sessionStorage.setItem('adh_link_nonce', 'n3')
    window.sessionStorage.setItem('adh_pending_link', 'github')
    setHash('#link_code=c3&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n3')
    render(<ProviderLinkHandler />)
    await screen.findByText(/already linked to another account/i)
    // Pending cleared so nothing can re-fire on the next navigation.
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
  })
})
