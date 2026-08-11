'use client'

import { useState, type FormEvent, type ReactElement } from 'react'
import { useOptionalAuth } from '../context'
import type { MfaChallenge, MfaCodeMethod, MfaMethod } from '../mfa'

/**
 * The three wire calls a second-factor step makes. Injected, because a login has two
 * possible outcomes and this step must serve both: satisfying a factor can mint THIS
 * site's own session (the `useAuth` defaults) or the CENTRAL session every other site
 * recognises (sso.ts's central client). The prompts, the throttling and the
 * method-switching are identical either way, so the component is one and only the
 * operations vary.
 */
export interface MfaOperations {
  sendSms: (token: string) => Promise<unknown>
  completeCode: (token: string, method: MfaCodeMethod, code: string) => Promise<unknown>
  completePasskey: (token: string) => Promise<unknown>
}

export interface MfaStepProps {
  /** The challenge returned by login (the pending token + the available methods). */
  challenge: MfaChallenge
  /** Which flavour of completion to run. Omitted ⇒ the AuthProvider's own, which
   *  mint a session for THIS site; a central login must pass its own (see
   *  {@link MfaOperations}). */
  operations?: MfaOperations
  /** Called once a second factor has been satisfied and a session is established. */
  onSuccess: () => void
  /** Called when the user backs out to the password form. */
  onCancel: () => void
}

const LABELS: Record<MfaMethod, string> = {
  totp: 'Authenticator app',
  sms: 'Text message',
  webauthn: 'Passkey or security key',
  recovery: 'Recovery code',
}

// The order we prefer to present factors in (recovery is always the last resort).
const ORDER: MfaMethod[] = ['totp', 'webauthn', 'sms', 'recovery']

function isCodeMethod(m: MfaMethod): m is MfaCodeMethod {
  return m === 'sms' || m === 'totp' || m === 'recovery'
}

/** The default operations come from the AuthProvider; a step rendered without one
 *  and without injected operations has nothing to complete against, and says so at
 *  the click rather than blanking the page at render. */
function requireAuth<T>(auth: T | null): T {
  if (!auth) {
    throw new Error(
      'MfaStep needs either an AuthProvider or an explicit `operations` prop to complete a second factor.',
    )
  }
  return auth
}

export function MfaStep({ challenge, operations, onSuccess, onCancel }: MfaStepProps): ReactElement {
  // useOptionalAuth, not useAuth: with `operations` injected the provider is not
  // needed at all, and a card completing a login centrally may well be rendered
  // outside one. Absent both, the action reports it rather than the render throwing.
  const auth = useOptionalAuth()
  const ops: MfaOperations = operations ?? {
    sendSms: (token) => requireAuth(auth).sendMfaSms(token),
    completeCode: (token, method, code) => requireAuth(auth).completeMfa(token, method, code),
    completePasskey: (token) => requireAuth(auth).completeMfaPasskey(token),
  }
  const available = ORDER.filter((m) => challenge.methods.includes(m))
  const [method, setMethod] = useState<MfaMethod>(available[0] ?? 'totp')
  const [code, setCode] = useState('')
  const [smsSent, setSmsSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchTo(next: MfaMethod) {
    setMethod(next)
    setCode('')
    setError(null)
  }

  async function run(action: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSendSms = () =>
    run(async () => {
      await ops.sendSms(challenge.token)
      setSmsSent(true)
    })

  const handleVerifyCode = (e: FormEvent) => {
    e.preventDefault()
    if (!isCodeMethod(method)) return
    void run(async () => {
      await ops.completeCode(challenge.token, method, code.trim())
      onSuccess()
    })
  }

  const handlePasskey = () =>
    run(async () => {
      await ops.completePasskey(challenge.token)
      onSuccess()
    })

  const codeLabel = method === 'recovery' ? 'Recovery code' : '6-digit code'
  const codePlaceholder = method === 'recovery' ? 'xxxx-xxxx-xxxx-xxxx' : '123456'

  return (
    <div className="auth-card__mfa">
      <h1 className="auth-card__heading">Two-factor authentication</h1>
      <p className="auth-card__subhead">Confirm it’s you with your second factor.</p>

      {error && (
        <div className="auth-card__error" role="alert">
          {error}
        </div>
      )}

      {method === 'webauthn' ? (
        <div className="auth-card__form">
          <p className="auth-card__mfa-hint">
            Use your passkey, Face&nbsp;ID, Touch&nbsp;ID, Windows&nbsp;Hello, or a hardware
            security key.
          </p>
          <button
            type="button"
            onClick={handlePasskey}
            disabled={busy}
            className="auth-card__submit"
          >
            {busy ? 'Waiting for your passkey…' : 'Use your passkey'}
          </button>
        </div>
      ) : method === 'sms' && !smsSent ? (
        <div className="auth-card__form">
          <p className="auth-card__mfa-hint">
            We’ll text a one-time code to your verified phone number.
          </p>
          <button
            type="button"
            onClick={handleSendSms}
            disabled={busy}
            className="auth-card__submit"
          >
            {busy ? 'Sending…' : 'Text me a code'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerifyCode} className="auth-card__form">
          <div className="auth-card__field">
            <label htmlFor="auth-mfa-code" className="auth-card__label">
              {codeLabel}
            </label>
            <input
              id="auth-mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={method === 'recovery' ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              required
              placeholder={codePlaceholder}
              className="auth-card__input"
            />
          </div>
          <button type="submit" disabled={busy || code.trim().length === 0} className="auth-card__submit">
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          {method === 'sms' && (
            <button
              type="button"
              onClick={handleSendSms}
              disabled={busy}
              className="auth-card__mfa-link"
            >
              Resend code
            </button>
          )}
        </form>
      )}

      {available.length > 1 && (
        <div className="auth-card__mfa-methods">
          <span className="auth-card__mfa-methods-label">Use a different method:</span>
          {available
            .filter((m) => m !== method)
            .map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchTo(m)}
                className="auth-card__mfa-link"
                disabled={busy}
              >
                {LABELS[m]}
              </button>
            ))}
        </div>
      )}

      <button type="button" onClick={onCancel} className="auth-card__mfa-link" disabled={busy}>
        ← Back to sign in
      </button>
    </div>
  )
}
