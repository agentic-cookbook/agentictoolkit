'use client'

import { useState, type FormEvent, type ReactElement } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { reportUnexpectedAuthError } from '../report'
import { GithubIcon } from './GithubIcon'

export interface SignupCardProps {
  /** Called with the new account's details on email submit. */
  onSignup: (input: { email: string; password: string; displayName: string }) => Promise<unknown>
  /**
   * Local mode: the GitHub button navigates straight here (e.g. the app's own
   * `/api/auth/github/start`). Mirrors LoginCard so signup + login share a flow.
   */
  githubStartHref?: string
  /**
   * Where to navigate after a successful email signup. Omit to show an in-place
   * confirmation instead (the right choice when new accounts are `pending` and
   * have nowhere authenticated to land yet).
   */
  postSignupRedirect?: string
  /** Target for the "Log in" link (default "/login"). */
  loginHref?: string
  /** Show the email/password form (default true). */
  showEmail?: boolean
  /** Show the "Continue with GitHub" button (default true). */
  showGithub?: boolean
  /** Copy overrides. */
  heading?: string
  subheading?: string
  emailButtonLabel?: string
  successHeading?: string
  successBody?: string
}

export function SignupCard({
  onSignup,
  githubStartHref,
  postSignupRedirect,
  loginHref = '/login',
  showEmail = true,
  showGithub = true,
  heading = 'Create your account',
  subheading = 'Sign up to request access',
  emailButtonLabel = 'Sign up with email',
  successHeading = 'Account created',
  successBody = 'Your account is pending approval. Check back soon.',
}: SignupCardProps): ReactElement {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function handleGithub() {
    if (githubStartHref) window.location.href = githubStartHref
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSignup({ email, password, displayName })
      if (postSignupRedirect) router.push(postSignupRedirect)
      else setDone(true)
    } catch (err) {
      // Report a 5xx/network registration failure; a 4xx (email taken, weak
      // password) is an expected user error and is skipped.
      reportUnexpectedAuthError(err, { feature: 'auth', step: 'signup' })
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1 className="auth-card__heading">{successHeading}</h1>
        <p className="auth-card__subhead">{successBody}</p>
        <p className="auth-card__signup">
          <Link href={loginHref} className="auth-card__signup-link">Back to log in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <h1 className="auth-card__heading">{heading}</h1>
      <p className="auth-card__subhead">{subheading}</p>

      {showGithub && (
        <div className="auth-card__providers">
          <button type="button" onClick={handleGithub} className="auth-card__provider-btn">
            <GithubIcon />
            Continue with GitHub
          </button>
        </div>
      )}

      {showGithub && showEmail && (
        <div className="auth-card__divider">
          <span className="auth-card__divider-line" />
          <span className="auth-card__divider-text">or</span>
          <span className="auth-card__divider-line" />
        </div>
      )}

      {showEmail && (
        <form onSubmit={handleSubmit} className="auth-card__form">
          {error && <div className="auth-card__error">{error}</div>}
          <div className="auth-card__field">
            <label htmlFor="signup-name" className="auth-card__label">Name</label>
            <input id="signup-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="auth-card__input" />
          </div>
          <div className="auth-card__field">
            <label htmlFor="signup-email" className="auth-card__label">Email</label>
            <input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-card__input" />
          </div>
          <div className="auth-card__field">
            <label htmlFor="signup-password" className="auth-card__label">Password</label>
            <input id="signup-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="auth-card__input" />
          </div>
          <button type="submit" disabled={isSubmitting} className="auth-card__submit">
            {isSubmitting ? 'Creating account…' : emailButtonLabel}
          </button>
        </form>
      )}

      <p className="auth-card__signup">
        Already have an account?{' '}
        <Link href={loginHref} className="auth-card__signup-link">Log in</Link>
      </p>
    </div>
  )
}
