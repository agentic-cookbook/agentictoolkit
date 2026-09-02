// websites/shared/auth/src/__tests__/LoginCard.test.tsx
import type { ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
const centralEmailLogin = vi.fn()
const centralPasswordlessPasskey = vi.fn()
const centralCompleteMfaCode = vi.fn()
const centralCompleteMfaPasskey = vi.fn()
const centralSendMfaSms = vi.fn()
const providerSigninUrl = vi.fn((..._args: unknown[]) => 'https://as.example/oauth/signin/start')

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
// The card's whole job is to resolve ONE target and post the central steps against
// it, so the target resolver is the seam these tests drive: a stub standing in for
// both the relayed and the synthesized answer (sso.test.ts owns which is which).
vi.mock('../sso', () => ({
  centralLoginTarget: (opts: { clientId: string; callbackPath?: string; authApiBase?: string; returnTo?: string }) => ({
    clientId: opts.clientId,
    returnUrl: `https://site.example${opts.callbackPath ?? '/auth/callback'}`,
    authApiBase: opts.authApiBase,
  }),
  centralEmailLogin: (...a: unknown[]) => centralEmailLogin(...a),
  centralPasswordlessPasskey: (...a: unknown[]) => centralPasswordlessPasskey(...a),
  centralCompleteMfaCode: (...a: unknown[]) => centralCompleteMfaCode(...a),
  centralCompleteMfaPasskey: (...a: unknown[]) => centralCompleteMfaPasskey(...a),
  centralSendMfaSms: (...a: unknown[]) => centralSendMfaSms(...a),
  providerSigninUrl: (...a: unknown[]) => providerSigninUrl(...a),
}))
// MfaStep reads the AuthProvider through useOptionalAuth; the card renders outside
// one (the builder has no provider at all), so null is the honest answer here.
vi.mock('../context', () => ({ useOptionalAuth: () => null }))

import { LoginCard } from '../ui/LoginCard'

function fillAndSubmit(): void {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } })
  fireEvent.click(screen.getByRole('button', { name: /log in with email/i }))
}

beforeEach(() => {
  push.mockReset()
  centralEmailLogin.mockReset().mockResolvedValue(null)
  centralPasswordlessPasskey.mockReset().mockResolvedValue(null)
  centralCompleteMfaCode.mockReset().mockResolvedValue(null)
  centralCompleteMfaPasskey.mockReset().mockResolvedValue(null)
  centralSendMfaSms.mockReset().mockResolvedValue(undefined)
  providerSigninUrl.mockReset().mockReturnValue('https://as.example/oauth/signin/start')
  window.sessionStorage.clear()
})

describe('LoginCard central credential login', () => {
  // THE regression this branch exists for: a card reached DIRECTLY (no relayed
  // central params) used to call its own onEmailLogin, minting only that site's
  // session — so signing in at the hub left every other site anonymous. There is no
  // longer a direct-visit branch: the AS verifies the password either way.
  it('completes a password login CENTRALLY by default, with no in-site handler at all', async () => {
    render(<LoginCard clientId="adh" authApiBase="https://as.example" postLoginRedirect="/home" />)
    fillAndSubmit()
    await waitFor(() =>
      expect(centralEmailLogin).toHaveBeenCalledWith({
        clientId: 'adh',
        returnUrl: 'https://site.example/auth/callback',
        authApiBase: 'https://as.example',
        identifier: 'a@b.com',
        password: 'pw',
      }),
    )
    // The central step assigns window.location itself; a router.push here would race
    // that navigation and could cancel it.
    expect(push).not.toHaveBeenCalled()
  })

  it('trims the identifier before posting it', async () => {
    render(<LoginCard clientId="adh" postLoginRedirect="/home" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: '  a@b.com  ' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /log in with email/i }))
    await waitFor(() =>
      expect(centralEmailLogin).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'a@b.com' })),
    )
  })

  it('surfaces a failed central login as an error and stays put', async () => {
    centralEmailLogin.mockRejectedValue(new Error('Invalid email or password'))
    render(<LoginCard clientId="adh" postLoginRedirect="/home" />)
    fillAndSubmit()
    await screen.findByText(/Invalid email or password/i)
    expect(push).not.toHaveBeenCalled()
  })

  it('runs the passkey login centrally when showPasskey is set, with no handler', async () => {
    render(<LoginCard clientId="adh" authApiBase="https://as.example" postLoginRedirect="/home" showPasskey />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in with a passkey/i }))
    await waitFor(() =>
      expect(centralPasswordlessPasskey).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'adh', authApiBase: 'https://as.example' }),
        'a@b.com',
      ),
    )
  })

  it('hides the passkey button unless asked for it', () => {
    render(<LoginCard clientId="adh" postLoginRedirect="/home" />)
    expect(screen.queryByRole('button', { name: /sign in with a passkey/i })).toBeNull()
  })
})

describe('LoginCard second factor', () => {
  // The pending token names a user and their factors, deliberately NOT a destination,
  // so the completion has to carry the target the password step used — otherwise the
  // exchange code is delivered to whichever site is being looked at.
  it('completes the challenge against the SAME target the password step used', async () => {
    centralEmailLogin.mockResolvedValue({ mfaRequired: true, token: 't1', methods: ['totp'] })
    render(<LoginCard clientId="admin" authApiBase="https://as.example" postLoginRedirect="/home" />)
    fillAndSubmit()
    await screen.findByText(/Two-factor authentication/i)
    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))
    await waitFor(() =>
      expect(centralCompleteMfaCode).toHaveBeenCalledWith(
        { clientId: 'admin', returnUrl: 'https://site.example/auth/callback', authApiBase: 'https://as.example' },
        't1',
        'totp',
        '123456',
      ),
    )
    // Same reason as the password step: the completion owns the navigation.
    expect(push).not.toHaveBeenCalled()
  })

  it('completes a central challenge with a passkey through the central route', async () => {
    centralEmailLogin.mockResolvedValue({ mfaRequired: true, token: 't2', methods: ['webauthn'] })
    render(<LoginCard clientId="adh" postLoginRedirect="/home" />)
    fillAndSubmit()
    await screen.findByText(/Two-factor authentication/i)
    fireEvent.click(screen.getByRole('button', { name: /use your passkey/i }))
    await waitFor(() => expect(centralCompleteMfaPasskey).toHaveBeenCalledWith(expect.anything(), 't2'))
  })

  it('backs out of the challenge to the password form', async () => {
    centralEmailLogin.mockResolvedValue({ mfaRequired: true, token: 't3', methods: ['totp'] })
    render(<LoginCard clientId="adh" postLoginRedirect="/home" />)
    fillAndSubmit()
    await screen.findByText(/Two-factor authentication/i)
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }))
    await screen.findByRole('button', { name: /log in with email/i })
  })
})

describe('LoginCard in-site mode', () => {
  // The declared exception: an app that IS its own authorization server (the builds
  // and status backends). It must never touch the central client.
  it('calls the app\'s own handler and navigates itself', async () => {
    const onEmailLogin = vi.fn().mockResolvedValue(undefined)
    render(
      <LoginCard clientId="builds" loginMode="in-site" onEmailLogin={onEmailLogin} postLoginRedirect="/overview" />,
    )
    fillAndSubmit()
    await waitFor(() => expect(onEmailLogin).toHaveBeenCalledWith('a@b.com', 'pw'))
    expect(centralEmailLogin).not.toHaveBeenCalled()
    // Nothing assigned window.location here, so the card owes the navigation.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/overview'))
  })

  it('renders the passkey button from the handler alone', () => {
    render(
      <LoginCard
        clientId="builds"
        loginMode="in-site"
        onEmailLogin={vi.fn()}
        onPasskeyLogin={vi.fn()}
        postLoginRedirect="/overview"
      />,
    )
    expect(screen.getByRole('button', { name: /sign in with a passkey/i })).toBeTruthy()
  })

  // Fail fast, and visibly: a mode whose entire job is to call the handler is
  // misconfigured without one, and a button that silently does nothing reads as a
  // network problem.
  it('reports a missing handler instead of appearing to log in', async () => {
    render(<LoginCard clientId="builds" loginMode="in-site" postLoginRedirect="/overview" />)
    fillAndSubmit()
    await screen.findByText(/needs `onEmailLogin`/i)
    expect(centralEmailLogin).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  // Same defect, other button: the message only reaches the visitor if the check runs
  // INSIDE the awaited step, so assert it at both call sites rather than trusting one.
  it('reports a missing passkey handler the same way', async () => {
    render(<LoginCard clientId="builds" loginMode="in-site" onEmailLogin={vi.fn()} showPasskey postLoginRedirect="/overview" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in with a passkey/i }))
    await screen.findByText(/needs `onPasskeyLogin`/i)
    expect(centralPasswordlessPasskey).not.toHaveBeenCalled()
  })
})

describe('LoginCard provider buttons', () => {
  // The card builds no URL of its own: it hands the /start contract to the shared
  // builder, which is the same one the hub's signup page calls — that is what keeps
  // the two pages from drifting on the query.
  it('starts the provider leg through the shared builder, forwarding the AS base', () => {
    render(
      <LoginCard
        clientId="adh"
        authApiBase="https://as.example"
        postLoginRedirect="/home"
        showGithub={false}
        oauthProviders={[{ id: 'google', label: 'Continue with Google' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(providerSigninUrl).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'adh', providerId: 'google', authApiBase: 'https://as.example' }),
    )
  })

  // With the prop omitted the card passes `undefined` STRAIGHT THROUGH rather than
  // pinning the same-origin proxy itself — so the builder's own rule applies (the env
  // var, then the proxy). See the prop's doc comment and sso.test.ts.
  it('forwards an omitted base as undefined, leaving the fallback to the builder', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        showGithub={false}
        oauthProviders={[{ id: 'google', label: 'Continue with Google' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(providerSigninUrl).toHaveBeenCalledWith(expect.objectContaining({ authApiBase: undefined }))
  })

  // The provider leg and the credential leg resolve the destination the SAME way, so
  // a relayed login can't send its code to one site through the password form and
  // another through the GitHub button.
  it('sends the provider leg to the same target the credential leg resolves', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        showGithub={false}
        callbackPath="/cb"
        oauthProviders={[{ id: 'google', label: 'Continue with Google' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(providerSigninUrl).toHaveBeenCalledWith(
      expect.objectContaining({ returnUrl: 'https://site.example/cb' }),
    )
  })

  // A self-enclosed app's own start route wins outright — it is not an AS client.
  it('uses githubStartHref verbatim when given one', () => {
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, set href(v: string) { assign(v) } } })
    render(
      <LoginCard clientId="builds" loginMode="in-site" onEmailLogin={vi.fn()} postLoginRedirect="/overview" githubStartHref="/api/auth/github/start" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }))
    expect(assign).toHaveBeenCalledWith('/api/auth/github/start')
    expect(providerSigninUrl).not.toHaveBeenCalled()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })
})

// Every method on this card is a GATE, so a host whose feature flags are still in
// flight hands down the same "hidden" answer as a host that has them all switched
// off — and on THIS card the gated methods are the entire body. Rendered as a bare
// heading over an empty card, that reads as "there is no way to log in", which is
// the report `methodsPending` exists to answer.
describe('LoginCard while the sign-in methods are still unknown', () => {
  it('says it is still loading rather than rendering an empty card', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        methodsPending
        showGithub={false}
        showEmail={false}
        oauthProviders={[]}
      />,
    )
    // role=status, not alert: it stands in for content a screen reader is waiting on.
    expect(screen.getByRole('status').textContent).toMatch(/loading sign-in options/i)
  })

  it('renders no method while pending, even with every one switched on', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        methodsPending
        oauthProviders={[{ id: 'google', label: 'Continue with Google' }]}
      />,
    )
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /continue with github/i })).toBeNull()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /log in with email/i })).toBeNull()
  })

  it('takes the pending copy from the host', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        methodsPending
        methodsPendingLabel="Checking what you can sign in with…"
        oauthProviders={[]}
      />,
    )
    expect(screen.getByRole('status').textContent).toBe('Checking what you can sign in with…')
  })

  // The state is opt-in: a host that knows its methods up front (every self-enclosed
  // app in the fleet) must render exactly as it did before the prop existed.
  it('is off by default, leaving the ordinary render untouched', () => {
    render(
      <LoginCard
        clientId="adh"
        postLoginRedirect="/home"
        oauthProviders={[{ id: 'google', label: 'Continue with Google' }]}
      />,
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /log in with email/i })).toBeTruthy()
  })
})
