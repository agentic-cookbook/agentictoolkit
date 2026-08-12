// websites/shared/auth/src/__tests__/ProviderLinkHandler.test.tsx
import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const linkProvider = vi.fn()
const beginLinkProvider = vi.fn((..._args: unknown[]) => true)
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
  beginLinkProvider: (...a: unknown[]) => beginLinkProvider(...a),
}))
vi.mock('../context', () => ({ useAuth: () => ({ isAuthenticated: authed }) }))
// Render the modal as plain text plus its actionable buttons, so this unit test
// asserts the handler's LOGIC and result copy — and can drive the forward leg's
// Continue / Not now — without standing up base-ui's portal/focus machinery in jsdom.
vi.mock('@agentic-toolkit/ui/components/alert-modal', () => ({
  AlertModal: ({
    title,
    description,
    confirmLabel,
    onConfirm,
    cancelLabel,
    onCancel,
  }: {
    title: string
    description?: ReactNode
    confirmLabel?: string
    onConfirm?: () => void
    cancelLabel?: string
    onCancel?: () => void
  }) => (
    <div role="dialog" aria-label={title}>
      <p>{title}</p>
      <p>{description}</p>
      {cancelLabel && <button type="button" onClick={onCancel}>{cancelLabel}</button>}
      {confirmLabel && <button type="button" onClick={onConfirm}>{confirmLabel}</button>}
    </div>
  ),
}))
import { ProviderLinkHandler } from '../ProviderLinkHandler'

function setHash(h: string) { Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, hash: h, pathname: '/home', search: '' } }) }

beforeEach(() => {
  authed = true
  linkProvider.mockReset().mockResolvedValue(undefined)
  beginLinkProvider.mockReset().mockReturnValue(true)
  window.sessionStorage.clear()
  setHash('')
})

describe('ProviderLinkHandler', () => {
  it('completes the link from #link_code (with a matching nonce) and shows success', async () => {
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    setHash('#link_code=c1&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n1')
    render(<ProviderLinkHandler />)
    await waitFor(() =>
      expect(linkProvider).toHaveBeenCalledWith(
        { clientSlug: 'adh', providerSlug: 'github', code: 'c1', redirectUri: 'https://as/cb' },
        // The AS base travels beside the body, never inside it: the body is POSTed
        // verbatim, so a base folded into it would be sent to the server.
        { authApiBase: undefined },
      ),
    )
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
    await waitFor(() =>
      expect(linkProvider).toHaveBeenCalledWith(
        { clientSlug: 'adh', providerSlug: 'github', code: 'c2', redirectUri: 'https://as/cb' },
        { authApiBase: undefined },
      ),
    )
    await screen.findByText(/GitHub is already connected/i)
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
  })

  it('never asks about a pending intent while an inbound #link_code is being completed', async () => {
    window.sessionStorage.setItem('adh_link_nonce', 'n1')
    window.sessionStorage.setItem('adh_pending_link', 'github')
    setHash('#link_code=c1&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n1')
    render(<ProviderLinkHandler />)
    await waitFor(() => expect(linkProvider).toHaveBeenCalled())
    // The RETURN leg wins: it must not re-ask for the link it is already completing.
    expect(beginLinkProvider).not.toHaveBeenCalled()
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

// The FORWARD leg: an OAuth attempt that hit an existing account stashed a provider
// to connect, and this asks the now-signed-in visitor whether to connect it. These
// assertions used to live on LoginCard, keyed to that card's own password login —
// which made them unreachable for every other way of arriving signed in, and
// unreachable there at all now that a credential login navigates to the callback.
describe('ProviderLinkHandler forward leg (pending intent)', () => {
  it('shows nothing when there is no pending intent', async () => {
    render(<ProviderLinkHandler />)
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(beginLinkProvider).not.toHaveBeenCalled()
  })

  it('asks whether to connect the provider when an intent is pending', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler />)
    await screen.findByText(/Add GitHub to your account\?/i)
    // Asking is not linking: nothing starts until the visitor says so.
    expect(beginLinkProvider).not.toHaveBeenCalled()
    // And the intent survives the question, so a reload can still answer it.
    expect(window.sessionStorage.getItem('adh_pending_link')).toBe('github')
  })

  it('does NOT ask while unauthenticated, preserving the intent', async () => {
    authed = false
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler />)
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.sessionStorage.getItem('adh_pending_link')).toBe('github')
  })

  it('"Continue" starts the link round-trip, returning to the current page, and clears the intent', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler />)
    const dialog = await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    expect(dialog).toBeTruthy()
    // returnTo is where the visitor IS, not a login page's postLoginRedirect: the
    // handler mounts in the authenticated shell, so the round-trip comes back here.
    expect(beginLinkProvider).toHaveBeenCalledWith({
      providerId: 'github',
      returnTo: '/home',
      clientId: 'adh',
    })
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
  })

  // Both legs, in one test, because the failure mode is the two disagreeing: the
  // forward leg starts the OAuth round-trip at one server and the return leg redeems
  // its code at another, which owns neither the pending flow nor the account rows.
  it('sends an explicit AS base to BOTH legs of the link', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler authApiBase="https://as.example.com" />)
    await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    expect(beginLinkProvider).toHaveBeenCalledWith(
      expect.objectContaining({ authApiBase: 'https://as.example.com' }),
    )

    cleanup()
    window.sessionStorage.setItem('adh_link_nonce', 'n9')
    setHash('#link_code=c9&link_provider=github&redirect_uri=https%3A%2F%2Fas%2Fcb&link_nonce=n9')
    render(<ProviderLinkHandler authApiBase="https://as.example.com" />)
    await waitFor(() =>
      expect(linkProvider).toHaveBeenCalledWith(expect.anything(), {
        authApiBase: 'https://as.example.com',
      }),
    )
  })

  it('"Not now" clears the intent and dismisses without linking', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler />)
    await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(screen.getByRole('button', { name: /Not now/i }))
    expect(beginLinkProvider).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('surfaces an error if the link round-trip cannot be started', async () => {
    beginLinkProvider.mockReturnValue(false)
    window.sessionStorage.setItem('adh_pending_link', 'github')
    render(<ProviderLinkHandler />)
    await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    await screen.findByText(/Couldn't connect account/i)
  })
})
