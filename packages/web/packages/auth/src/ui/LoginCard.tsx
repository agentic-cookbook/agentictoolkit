'use client'

import { useState, type FormEvent, type ReactElement } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export interface LoginCardProps {
  /** OAuth client id used to build the GitHub start URL. */
  clientId: string
  /** Called with credentials on email submit (wire to useAuth().login). */
  onEmailLogin: (email: string, password: string) => Promise<unknown>
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
  /** Show the "Sign up" affordance linking to signupHref (default false). */
  showSignup?: boolean
  /** Target for the Sign up link (default "/signup"). */
  signupHref?: string
  /** Copy overrides. */
  heading?: string
  subheading?: string
  emailButtonLabel?: string
}

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

export function LoginCard({
  clientId,
  onEmailLogin,
  postLoginRedirect,
  githubProviderId = 'github',
  callbackPath = '/auth/callback',
  showEmail = true,
  showGithub = true,
  showSignup = false,
  signupHref = '/signup',
  heading = 'Welcome back.',
  subheading = 'Log in to your account',
  emailButtonLabel = 'Log in with email',
}: LoginCardProps): ReactElement {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleGithub() {
    const ret = `${window.location.origin}${callbackPath}`
    window.location.href = `/api/auth/start?clientId=${encodeURIComponent(clientId)}&providerId=${encodeURIComponent(githubProviderId)}&return=${encodeURIComponent(ret)}`
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onEmailLogin(email, password)
      router.push(postLoginRedirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
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
            <label htmlFor="auth-email" className="auth-card__label">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-card__input"
            />
          </div>
          <div className="auth-card__field">
            <label htmlFor="auth-password" className="auth-card__label">Password</label>
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
            {isSubmitting ? 'Logging in…' : emailButtonLabel}
          </button>
        </form>
      )}

      {showSignup && (
        <p className="auth-card__signup">
          Don&apos;t have an account?{' '}
          <Link href={signupHref} className="auth-card__signup-link">Sign up</Link>
        </p>
      )}
    </div>
  )
}
