'use client'

import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { reportUnexpectedAuthError } from '../report'
import {
  centralCompleteMfaCode,
  centralCompleteMfaPasskey,
  centralEmailLogin,
  centralLoginTarget,
  centralPasswordlessPasskey,
  centralSendMfaSms,
  providerSigninUrl,
  type CentralLoginTarget,
} from '../sso'
import type { MfaChallenge } from '../mfa'
import { MfaStep, type MfaOperations } from './MfaStep'
import { GithubIcon } from './GithubIcon'

/** A login result that is a pending second-factor challenge rather than a session. */
function isMfaChallenge(v: unknown): v is MfaChallenge {
  return typeof v === 'object' && v !== null && 'mfaRequired' in v
}

/**
 * How a credential login COMPLETES.
 *
 * `'central'` (the default, and the only correct value for a site in the fleet)
 * posts the authorization server, which sets the central session cookie on its own
 * host and hands back a one-time exchange code for the callback. That central
 * session is the entire reason a visitor who signs in on one site is recognised on
 * the next one; a login that skips it is signed in exactly once, wherever it
 * happened, and anonymous everywhere else.
 *
 * `'in-site'` calls {@link LoginCardProps.onEmailLogin} instead and mints only the
 * calling app's own session. It exists for an app that IS its own authorization
 * server — the builder, which has its own credentials, its own OAuth client and no
 * relationship to the central session — and is a DECLARED exception, spelled out at
 * the one call site that wants it, never a mode a page falls into by accident.
 */
export type LoginMode = 'central' | 'in-site'

export interface LoginCardProps {
  /** OAuth client id used to build the GitHub start URL. */
  clientId: string
  /**
   * Absolute base URL of the login/OAuth API (e.g.
   * `https://api.agenticdeveloperhub.com`). The GitHub redirect flow's
   * `/start` and `/callback` must share a host (the OAuth state cookie is
   * host-only), so the browser is sent directly here rather than through the
   * same-origin `/api` data proxy. Typically wired from `NEXT_PUBLIC_AUTH_API_URL`.
   *
   * When omitted the resolution is the package-wide one (`asEndpoint`): that same
   * env var, then a same-origin relative path (local dev). It is NOT prop-only —
   * an omitted prop in a build that inlined `NEXT_PUBLIC_AUTH_API_URL` sends the
   * browser to the AS host, not to `/api`. That is deliberate: every other AS call
   * in this package (`beginLogin`, `ssoSwitchUrl`, `centralEmailLogin`) already
   * resolves that way, and a card that disagreed would split `/start` from
   * `/callback` across two hosts — which the host-only OAuth state cookie cannot
   * survive. Pass the prop explicitly to be unambiguous.
   */
  authApiBase?: string
  /** Where a credential login is completed — see {@link LoginMode}. Default 'central'. */
  loginMode?: LoginMode
  /** IN-SITE MODE ONLY: called with the entered identifier (email, user id/slug, or
   *  phone) + password on submit (wire to useAuth().login — the backend classifies the
   *  identifier). Unused in central mode, where the authorization server verifies the
   *  credentials; required in in-site mode, which throws without it rather than
   *  appearing to log in. */
  onEmailLogin?: (identifier: string, password: string) => Promise<unknown>
  /** IN-SITE MODE ONLY: passwordless passkey sign-in (wire to useAuth().loginWithPasskey).
   *  Central mode runs the same ceremony against the AS instead, so it needs no handler —
   *  use {@link LoginCardProps.showPasskey} to show the button there. */
  onPasskeyLogin?: (identifier: string) => Promise<unknown>
  /** Show the "Sign in with a passkey" button. Defaults to `Boolean(onPasskeyLogin)`,
   *  which is the whole story in in-site mode; central mode has no handler to infer it
   *  from, so a site gating passkeys behind a feature flag passes the flag's answer
   *  here. */
  showPasskey?: boolean
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
  loginMode = 'central',
  onEmailLogin,
  onPasskeyLogin,
  showPasskey,
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
  // The target the PASSWORD step used, kept for the completion. A pending token names
  // a user and their enrolled factors — deliberately not a destination — so the AS
  // re-validates clientId + return on every step, and a completion that re-derived
  // them would deliver the exchange code to whichever site is being LOOKED at rather
  // than the one that started the login. null in in-site mode, which has no target.
  const [challengeTarget, setChallengeTarget] = useState<CentralLoginTarget | null>(null)

  const isCentral = loginMode === 'central'
  // In in-site mode the handler IS the passkey button's reason to exist; in central
  // mode there is no handler to infer from, so the host says (a site gating passkeys
  // behind a feature flag passes the flag's answer).
  const passkeyVisible = showPasskey ?? Boolean(onPasskeyLogin)

  /** The brand site this login owes its exchange code to — the AS's own parameters
   *  when it relayed another site's login here, otherwise the ones it would have
   *  supplied for a login begun on this page. */
  function resolveCentralTarget(): CentralLoginTarget {
    return centralLoginTarget({ clientId, callbackPath, authApiBase, returnTo: postLoginRedirect })
  }

  /** An in-site-mode handler that the call site failed to supply. Throwing beats
   *  returning: a login button that quietly does nothing looks like a network
   *  problem, and a mode whose whole job is to call this handler is misconfigured
   *  without it (fail-fast). Call it from INSIDE the step runLogin awaits, never
   *  before — outside that try the throw is an unhandled rejection, which leaves the
   *  button doing exactly the silent nothing this is meant to prevent. */
  function requireHandler<T>(handler: T | undefined, name: string): T {
    if (!handler) {
      throw new Error(
        `LoginCard loginMode="in-site" needs \`${name}\` — in-site mode completes the login ` +
          'against the calling app itself, so there is nothing to call without it.',
      )
    }
    return handler
  }

  function handleProvider(providerId: string) {
    // Local mode (the github self-enclosed app): go straight to its own start route.
    if (providerId === githubProviderId && githubStartHref) {
      window.location.href = githubStartHref
      return
    }
    // Same resolver as the credential path, so a provider login and a password login
    // agree on where the code goes: back to the site the AS named when it relayed a
    // login here, else this site's own callback (with postLoginRedirect stashed).
    const target = resolveCentralTarget()
    // providerSigninUrl goes straight to the login/OAuth API so /start and
    // /callback share a host (the OAuth state cookie is host-only), falling back
    // to the same-origin BFF proxy when no base is configured (local dev).
    window.location.href = providerSigninUrl({
      clientId: target.clientId,
      providerId,
      returnUrl: target.returnUrl,
      authApiBase,
    })
  }

  /** Run a login step, showing its MFA challenge or navigating on success. Shared by
   *  the password and passkey paths so both treat a 202 the same way. */
  async function runLogin(
    step: () => Promise<unknown>,
    target: CentralLoginTarget | null,
    failureLabel: string,
  ): Promise<void> {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await step()
      // An enrolled second factor: switch to the MFA step rather than navigating —
      // no session exists until it completes.
      if (isMfaChallenge(result)) {
        setChallengeTarget(target)
        setChallenge(result)
        return
      }
      // A central step has already assigned window.location; only an in-site one
      // still owes the user a navigation.
      if (!target) router.push(postLoginRedirect)
    } catch (err) {
      // Report a 5xx/network login failure; a 4xx (wrong password) is expected and
      // skipped. Both the in-site (postCredentials) and central (centralLoginStep)
      // paths throw AuthHttpError, so the gate can tell them apart.
      reportUnexpectedAuthError(err, { feature: 'auth', step: 'login' })
      setError(err instanceof Error ? err.message : failureLabel)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasskey() {
    if (!identifier.trim()) {
      setError(resolvedPasskeyRequiredLabel)
      return
    }
    const trimmedIdentifier = identifier.trim()
    if (!isCentral) {
      await runLogin(
        () => requireHandler(onPasskeyLogin, 'onPasskeyLogin')(trimmedIdentifier),
        null,
        passkeyFailedLabel,
      )
      return
    }
    const target = resolveCentralTarget()
    await runLogin(
      () => centralPasswordlessPasskey(target, trimmedIdentifier),
      target,
      passkeyFailedLabel,
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Trim like the passkey path: a stray leading/trailing space (mobile autofill,
    // copy-paste) would otherwise miss an exact email/slug match server-side. In
    // email mode type=email already trims natively; this keeps identifier mode
    // consistent.
    const trimmedIdentifier = identifier.trim()
    if (!isCentral) {
      await runLogin(
        () => requireHandler(onEmailLogin, 'onEmailLogin')(trimmedIdentifier, password),
        null,
        'Login failed',
      )
      return
    }
    // The ONLY credential path for a site in the fleet: the AS verifies the password,
    // sets the central session on its own host, and hands back a one-time code for
    // the target's callback. That central session is what makes a visitor who signed
    // in here signed in on the other forty sites too.
    const target = resolveCentralTarget()
    await runLogin(
      () => centralEmailLogin({ ...target, identifier: trimmedIdentifier, password }),
      target,
      'Login failed',
    )
  }

  if (challenge) {
    // Central completions, when the password step was central: only these mint the
    // central session, and finishing a central challenge on the site's own
    // /api/auth/login/mfa is how a login ends up half-done. Omitted in in-site mode,
    // where MfaStep's AuthProvider defaults are correct.
    const operations: MfaOperations | undefined = challengeTarget
      ? {
          sendSms: (token) => centralSendMfaSms(challengeTarget, token),
          completeCode: (token, method, code) =>
            centralCompleteMfaCode(challengeTarget, token, method, code),
          completePasskey: (token) => centralCompleteMfaPasskey(challengeTarget, token),
        }
      : undefined
    return (
      <div className="auth-card">
        <MfaStep
          challenge={challenge}
          operations={operations}
          // Deliberately nothing to do in central mode: the completion has already
          // assigned window.location to the brand site's callback, and a competing
          // router.push here can cancel that navigation — which would strand the
          // site that started the login signed OUT, holding a code it never
          // received. Load-bearing, not an oversight.
          onSuccess={challengeTarget ? () => {} : () => router.push(postLoginRedirect)}
          onCancel={() => {
            setChallenge(null)
            setChallengeTarget(null)
          }}
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
            {/* The one field on this card that WANTS a password manager. It says so with
                the standard token, which is also the fleet's single declaration of intent:
                everything built on the shared Input opts managers OUT unless a real
                autofill token is named (see @agentic-toolkit/ui lib/autofill). */}
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-card__input"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="auth-card__submit">
            {isSubmitting ? loadingLabel : emailButtonLabel}
          </button>
          {passkeyVisible && (
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
    </div>
  )
}
