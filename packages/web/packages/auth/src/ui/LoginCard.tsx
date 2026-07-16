'use client'

import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { reportAuthError, reportUnexpectedAuthError } from '../report'
import { beginLinkProvider, centralEmailLogin, readCentralParams, PENDING_LINK_KEY } from '../sso'
import type { MfaChallenge } from '../mfa'
import { MfaStep } from './MfaStep'
import {
  linkConfirmTitle,
  linkConfirmBody,
  linkConfirmAction,
  linkFailedTitle,
  linkStartFailedBody,
} from '../labels'
import { GithubIcon } from './GithubIcon'

/** A login result that is a pending second-factor challenge rather than a session. */
function isMfaChallenge(v: unknown): v is MfaChallenge {
  return typeof v === 'object' && v !== null && 'mfaRequired' in v
}

export interface LoginCardProps {
  /** OAuth client id used to build the GitHub start URL. */
  clientId: string
  /**
   * Absolute base URL of the login/OAuth API (e.g.
   * `https://api.agenticdeveloperhub.com`). The GitHub redirect flow's
   * `/start` and `/callback` must share a host (the OAuth state cookie is
   * host-only), so the browser is sent directly here rather than through the
   * same-origin `/api` data proxy. When omitted, falls back to a same-origin
   * relative path (local dev). Typically wired from `NEXT_PUBLIC_AUTH_API_URL`.
   */
  authApiBase?: string
  /** Called with the entered identifier (email, user id/slug, or phone) + password on
   *  submit (wire to useAuth().login — the backend classifies the identifier). */
  onEmailLogin: (identifier: string, password: string) => Promise<unknown>
  /** Optional passwordless passkey sign-in (wire to useAuth().loginWithPasskey). When
   *  provided, a "Sign in with a passkey" button is shown that uses the entered
   *  identifier (email, user id, or phone). */
  onPasskeyLogin?: (identifier: string) => Promise<unknown>
  /** Where to navigate after a successful email login. */
  postLoginRedirect: string
  /** OAuth provider id (default "github"). */
  githubProviderId?: string
  /** Path the OAuth callback returns to (default "/auth/callback"). */
  callbackPath?: string
  /** Show the email/password form (default true). */
  showEmail?: boolean
  /** Show the "Continue with GitHub" button (default true). */
  showGithub?: boolean
  /** Optional explicit list of OAuth providers to render. Each routes through the
   *  same central-AS start with its `id` as the providerId. When provided, this list
   *  REPLACES the single built-in GitHub button, so the host page controls exactly
   *  which providers appear (e.g. gated by feature flags). Backward-compatible:
   *  omit it and the `showGithub` GitHub button renders as before. */
  oauthProviders?: { id: string; label: string; icon?: ReactNode }[]
  /** Optional alert rendered at the top of the card — e.g. a backend-connectivity
   *  problem that will prevent login from completing. Surfaced by the host page so
   *  a misconfigured/unreachable backend shows a clear reason instead of a dead
   *  button. */
  notice?: ReactNode
  /** Show the "Sign up" affordance linking to signupHref (default false). */
  showSignup?: boolean
  /** Target for the Sign up link (default "/signup"). */
  signupHref?: string
  /**
   * Local mode: when set, the GitHub button navigates straight here (e.g. a
   * self-enclosed app's own `/api/auth/github/start`) instead of the central-AS
   * `/oauth/signin/start` flow. Use for apps that are their own OAuth client.
   */
  githubStartHref?: string
  /**
   * What the identifier field accepts. `'email'` (default) is an email-only field:
   * `type="email"` with native browser validation and an "Email" label — the right
   * choice for a site whose backend authenticates by email only. `'identifier'`
   * accepts an email, a user id (slug), OR a verified phone: `type="text"` (native
   * email validation would block a slug/phone before submit), a broader default
   * label, and the identifierHint. A site must opt IN to `'identifier'` — the
   * default never advertises login methods a plain email backend can't accept.
   */
  identifierMode?: 'email' | 'identifier'
  /** Copy overrides. */
  heading?: string
  subheading?: string
  emailButtonLabel?: string
  githubButtonLabel?: string
  dividerLabel?: string
  /** Label for the identifier field. Defaults to "Email" in email mode, or
   *  "Email, user ID, or phone" in identifier mode. */
  emailLabel?: string
  /** Helper text under the identifier field noting the accepted login forms.
   *  Defaults to empty in email mode, or an email/user-id/phone blurb in
   *  identifier mode. Pass an empty string to suppress it. */
  identifierHint?: string
  passwordLabel?: string
  passkeyButtonLabel?: string
  signupPromptLabel?: string
  signupLinkLabel?: string
  /** Label shown inside the submit button while logging in. Default: "Logging in…" */
  loadingLabel?: string
  /** Error shown when passkey sign-in is attempted without an identifier.
   *  Defaults per identifierMode. */
  passkeyEmailRequiredLabel?: string
  /** Error shown when passkey sign-in fails. Default: "Passkey sign-in failed." */
  passkeyFailedLabel?: string
}

export function LoginCard({
  clientId,
  authApiBase,
  onEmailLogin,
  onPasskeyLogin,
  postLoginRedirect,
  notice,
  githubProviderId = 'github',
  callbackPath = '/auth/callback',
  showEmail = true,
  showGithub = true,
  oauthProviders,
  showSignup = false,
  signupHref = '/signup',
  githubStartHref,
  identifierMode = 'email',
  heading = 'Welcome back.',
  subheading = 'Log in to your account',
  emailButtonLabel = 'Log in with email',
  githubButtonLabel = 'Continue with GitHub',
  dividerLabel = 'or',
  emailLabel,
  identifierHint,
  passwordLabel = 'Password',
  passkeyButtonLabel = 'Sign in with a passkey',
  signupPromptLabel = "Don't have an account?",
  signupLinkLabel = 'Sign up',
  loadingLabel = 'Logging in…',
  passkeyEmailRequiredLabel,
  passkeyFailedLabel = 'Passkey sign-in failed.',
}: LoginCardProps): ReactElement {
  // In identifier mode the field also accepts a user id (slug) or phone, so it must
  // be type=text (native email validation would block those) and carry a broader
  // label + hint; the explicit props still override these mode defaults.
  const acceptsAnyIdentifier = identifierMode === 'identifier'
  const resolvedEmailLabel = emailLabel ?? (acceptsAnyIdentifier ? 'Email, user ID, or phone' : 'Email')
  const resolvedHint =
    identifierHint ??
    (acceptsAnyIdentifier
      ? 'You can log in with your email, your user ID, or a verified phone number with country code (e.g. +1…).'
      : '')
  const resolvedPasskeyRequiredLabel =
    passkeyEmailRequiredLabel ??
    (acceptsAnyIdentifier
      ? 'Enter your email, user ID, or phone to sign in with a passkey.'
      : 'Enter your email to sign in with a passkey.')
  const identifierInputType = acceptsAnyIdentifier ? 'text' : 'email'
  const router = useRouter()
  // The login identifier: an email, a user id (slug), or a phone number — the
  // backend classifies it, so this field applies no format validation.
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set when password login returns a 202 second-factor challenge; swaps the card to
  // the MFA step instead of corrupting the session with the pending token.
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  // Reactive account-link UI state — mutually exclusive, so ONE discriminated union
  // (can't accidentally show both): `prompt` = confirm linking after a successful
  // login (the OAuth callback stashed a pending intent); `error` = the link
  // round-trip couldn't even be started. null = nothing to show.
  const [linkState, setLinkState] = useState<{ kind: 'prompt' | 'error'; provider: string } | null>(null)

  function handleProvider(providerId: string) {
    // Local mode (the github self-enclosed app): go straight to its own start route.
    if (providerId === githubProviderId && githubStartHref) {
      window.location.href = githubStartHref
      return
    }
    // When this card is the CENTRAL login page (reached via the AS /authorize for
    // another brand site), the code must go back to THAT site, under the client
    // the AS named — not the hub's own callback. Otherwise it's a plain in-site
    // login: bounce to our own callback under this card's clientId.
    const central = readCentralParams()
    const ret = central ? central.returnUrl : `${window.location.origin}${callbackPath}`
    const cid = central ? central.clientId : clientId
    // Go straight to the login/OAuth API so /start and /callback share a host
    // (the OAuth state cookie is host-only). The backend serves the flow at
    // `/oauth/signin/*` (no `/api` prefix). Without authApiBase, fall back to the
    // same-origin BFF proxy, whose reserved `/api/*` namespace forwards there
    // (local dev / proxied).
    const start = authApiBase
      ? `${authApiBase.replace(/\/+$/, '')}/oauth/signin/start`
      : '/api/oauth/signin/start'
    window.location.href = `${start}?clientId=${encodeURIComponent(cid)}&providerId=${encodeURIComponent(providerId)}&return=${encodeURIComponent(ret)}`
  }

  async function handlePasskey() {
    if (!onPasskeyLogin) return
    setError(null)
    if (!identifier.trim()) {
      setError(resolvedPasskeyRequiredLabel)
      return
    }
    setIsSubmitting(true)
    try {
      await onPasskeyLogin(identifier.trim())
      router.push(postLoginRedirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : passkeyFailedLabel)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      // Trim like the passkey path: a stray leading/trailing space (mobile autofill,
      // copy-paste) would otherwise miss an exact email/slug match server-side. In
      // email mode type=email already trims natively; this keeps identifier mode
      // consistent.
      const trimmedIdentifier = identifier.trim()
      // Central login page → funnel the credential login through the AS so the
      // exchange code returns to the originating brand site and the central
      // session is established (centralEmailLogin navigates away on success).
      // Direct visit → plain in-site login, then route to postLoginRedirect.
      const central = readCentralParams()
      if (central) {
        await centralEmailLogin({
          authApiBase,
          clientId: central.clientId,
          returnUrl: central.returnUrl,
          identifier: trimmedIdentifier,
          password,
        })
        return
      }
      const result = await onEmailLogin(trimmedIdentifier, password)
      // An enrolled second factor: switch to the MFA step rather than navigating.
      // Checked BEFORE account-linking — no session exists until MFA completes.
      if (isMfaChallenge(result)) {
        setChallenge(result)
        return
      }
      // Reactive account-link: if the OAuth callback stashed a provider to connect
      // after sign-in, surface a confirm modal HERE rather than bouncing through
      // postLoginRedirect — the user stays on the (now dimmed) login page and
      // explicitly opts into re-authorizing that provider. The modal owns the next
      // navigation (see declineLink / acceptLink).
      let pendingLink: string | null = null
      try { pendingLink = window.sessionStorage.getItem(PENDING_LINK_KEY) } catch { /* storage blocked */ }
      if (pendingLink) {
        setLinkState({ kind: 'prompt', provider: pendingLink })
        return
      }
      router.push(postLoginRedirect)
    } catch (err) {
      // Report a 5xx/network login failure; a 4xx (wrong password) is expected and
      // skipped. Both the direct (postCredentials) and central (centralEmailLogin)
      // paths now throw AuthHttpError, so the gate can tell them apart.
      reportUnexpectedAuthError(err, { feature: 'auth', step: 'login' })
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearPendingLink(): void {
    try { window.sessionStorage.removeItem(PENDING_LINK_KEY) } catch { /* ignore */ }
  }

  /** "Not now": drop the pending intent and continue to the normal destination. */
  function declineLink(): void {
    clearPendingLink()
    setLinkState(null)
    router.push(postLoginRedirect)
  }

  /** "Continue with <provider>": start the link round-trip (a top-level nav to the
   *  AS). Clear the intent first so a refused/abandoned bounce can't re-trigger;
   *  the returning `#link_code` carries everything the completion needs. */
  function acceptLink(): void {
    const provider = linkState?.kind === 'prompt' ? linkState.provider : null
    if (!provider) return
    clearPendingLink()
    setLinkState(null)
    try {
      const started = beginLinkProvider({ providerId: provider, returnTo: postLoginRedirect, clientId, authApiBase })
      // false => the CSRF nonce couldn't be stashed, so it did NOT navigate.
      if (!started) setLinkState({ kind: 'error', provider })
    } catch (err) {
      // Never swallow a failure to start the link — REPORT it to the error pipeline
      // (GlitchTip) AND surface an error modal, instead of letting an unexpected
      // throw escape the click handler unseen.
      reportAuthError(err, { feature: 'account-linking', step: 'acceptLink', provider })
      setLinkState({ kind: 'error', provider })
    }
  }

  if (challenge) {
    return (
      <div className="auth-card">
        <MfaStep
          challenge={challenge}
          onSuccess={() => router.push(postLoginRedirect)}
          onCancel={() => setChallenge(null)}
        />
      </div>
    )
  }


  return (
    <div className="auth-card">
      <h1 className="auth-card__heading">{heading}</h1>
      <p className="auth-card__subhead">{subheading}</p>

      {notice && <div className="auth-card__error" role="alert">{notice}</div>}

      {oauthProviders && oauthProviders.length > 0 ? (
        <div className="auth-card__providers">
          {oauthProviders.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProvider(p.id)}
              className="auth-card__provider-btn"
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      ) : showGithub ? (
        <div className="auth-card__providers">
          <button type="button" onClick={() => handleProvider(githubProviderId)} className="auth-card__provider-btn">
            <GithubIcon />
            {githubButtonLabel}
          </button>
        </div>
      ) : null}

      {((oauthProviders && oauthProviders.length > 0) || showGithub) && showEmail && (
        <div className="auth-card__divider">
          <span className="auth-card__divider-line" />
          <span className="auth-card__divider-text">{dividerLabel}</span>
          <span className="auth-card__divider-line" />
        </div>
      )}

      {showEmail && (
        <form onSubmit={handleSubmit} className="auth-card__form">
          {error && <div className="auth-card__error">{error}</div>}
          <div className="auth-card__field">
            <label htmlFor="auth-email" className="auth-card__label">{resolvedEmailLabel}</label>
            {/* In identifier mode this is type=text, NOT email: the field also takes a
                user id (slug) or phone, and native email validation would block those
                before submit. autoComplete="username" keeps password managers filling it. */}
            <input
              id="auth-email"
              type={identifierInputType}
              autoComplete={acceptsAnyIdentifier ? 'username' : 'email'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="auth-card__input"
            />
            {resolvedHint && <p className="auth-card__hint">{resolvedHint}</p>}
          </div>
          <div className="auth-card__field">
            <label htmlFor="auth-password" className="auth-card__label">{passwordLabel}</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-card__input"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="auth-card__submit">
            {isSubmitting ? loadingLabel : emailButtonLabel}
          </button>
          {onPasskeyLogin && (
            <button
              type="button"
              onClick={handlePasskey}
              disabled={isSubmitting}
              className="auth-card__mfa-link auth-card__passkey-link"
            >
              {passkeyButtonLabel}
            </button>
          )}
        </form>
      )}

      {showSignup && (
        <p className="auth-card__signup">
          {signupPromptLabel}{' '}
          <Link href={signupHref} className="auth-card__signup-link">{signupLinkLabel}</Link>
        </p>
      )}

      {/* Reactive account-link confirm + error modals. base-ui's Dialog portals to
          <body>, so their position in this tree doesn't affect the card layout. */}
      {linkState?.kind === 'prompt' && (
        <AlertModal
          open
          tone="info"
          title={linkConfirmTitle(linkState.provider)}
          description={linkConfirmBody(linkState.provider)}
          cancelLabel="Not now"
          onCancel={declineLink}
          confirmLabel={linkConfirmAction(linkState.provider)}
          onConfirm={acceptLink}
        />
      )}
      {linkState?.kind === 'error' && (
        <AlertModal
          open
          tone="error"
          title={linkFailedTitle}
          description={linkStartFailedBody(linkState.provider)}
          confirmLabel="OK"
          onConfirm={() => { setLinkState(null); router.push(postLoginRedirect) }}
        />
      )}
    </div>
  )
}
