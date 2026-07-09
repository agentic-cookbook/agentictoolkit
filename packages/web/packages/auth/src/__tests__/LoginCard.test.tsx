// websites/shared/auth/src/__tests__/LoginCard.test.tsx
import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const push = vi.fn()
const beginLinkProvider = vi.fn((..._args: unknown[]) => true)
const centralEmailLogin = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('../sso', () => ({
  // Direct (non-central) login path: readCentralParams returns null.
  readCentralParams: () => null,
  centralEmailLogin: (...a: unknown[]) => centralEmailLogin(...a),
  beginLinkProvider: (...a: unknown[]) => beginLinkProvider(...a),
  PENDING_LINK_KEY: 'adh_pending_link',
}))
// Render the modal's actionable buttons so the test can drive Continue / Not now.
vi.mock('@agentic-toolkit/ui/components/alert-modal', () => ({
  AlertModal: ({ title, confirmLabel, onConfirm, cancelLabel, onCancel }: { title: string; confirmLabel?: string; onConfirm: () => void; cancelLabel?: string; onCancel?: () => void }) => (
    <div role="dialog" aria-label={title}>
      <p>{title}</p>
      {cancelLabel && <button type="button" onClick={onCancel}>{cancelLabel}</button>}
      <button type="button" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ),
}))

import { LoginCard } from '../ui/LoginCard'

function fillAndSubmit(): void {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } })
  fireEvent.click(screen.getByRole('button', { name: /log in with email/i }))
}

function renderCard(onEmailLogin = vi.fn().mockResolvedValue(undefined)) {
  render(
    <LoginCard clientId="adh" authApiBase="https://as.example" onEmailLogin={onEmailLogin} postLoginRedirect="/home" />,
  )
  return onEmailLogin
}

beforeEach(() => {
  push.mockReset()
  beginLinkProvider.mockReset().mockReturnValue(true)
  centralEmailLogin.mockReset()
  window.sessionStorage.clear()
})

describe('LoginCard reactive account-link', () => {
  it('routes straight to postLoginRedirect when there is NO pending link', async () => {
    renderCard()
    fillAndSubmit()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the confirm modal (and does NOT navigate) when a link is pending', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    renderCard()
    fillAndSubmit()
    await screen.findByText(/Add GitHub to your account\?/i)
    // Crucially: no bounce to /home — the user stays on the dimmed login page.
    expect(push).not.toHaveBeenCalled()
  })

  it('"Continue" starts the link round-trip and clears the pending intent', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    renderCard()
    fillAndSubmit()
    // Scope to the modal: the login card itself also has a "Continue with GitHub"
    // OAuth button, so disambiguate by querying within the dialog.
    const dialog = await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /Continue with GitHub/i }))
    expect(beginLinkProvider).toHaveBeenCalledWith({ providerId: 'github', returnTo: '/home', clientId: 'adh', authApiBase: 'https://as.example' })
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
    // beginLinkProvider owns the navigation (a top-level redirect), not router.push.
    expect(push).not.toHaveBeenCalled()
  })

  it('"Not now" clears the intent and continues to postLoginRedirect', async () => {
    window.sessionStorage.setItem('adh_pending_link', 'github')
    renderCard()
    fillAndSubmit()
    const dialog = await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /Not now/i }))
    expect(beginLinkProvider).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('adh_pending_link')).toBeNull()
    expect(push).toHaveBeenCalledWith('/home')
  })

  it('surfaces an error if the link round-trip cannot be started', async () => {
    beginLinkProvider.mockReturnValue(false)
    window.sessionStorage.setItem('adh_pending_link', 'github')
    renderCard()
    fillAndSubmit()
    const dialog = await screen.findByRole('dialog', { name: /Add GitHub to your account/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /Continue with GitHub/i }))
    await screen.findByText(/Couldn't connect account/i)
  })
})
