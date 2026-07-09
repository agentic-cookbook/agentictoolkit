'use client'

import { useState, type FormEvent, type ReactElement } from 'react'
import { useAuth } from '../context'
import type { MfaChallenge, MfaCodeMethod, MfaMethod } from '../mfa'

export interface MfaStepProps {
  /** The challenge returned by login (the pending token + the available methods). */
  challenge: MfaChallenge
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

export function MfaStep({ challenge, onSuccess, onCancel }: MfaStepProps): ReactElement {
  const { sendMfaSms, completeMfa, completeMfaPasskey } = useAuth()
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
      await sendMfaSms(challenge.token)
      setSmsSent(true)
    })

  const handleVerifyCode = (e: FormEvent) => {
    e.preventDefault()
    if (!isCodeMethod(method)) return
    void run(async () => {
      await completeMfa(challenge.token, method, code.trim())
      onSuccess()
    })
  }

  const handlePasskey = () =>
    run(async () => {
      await completeMfaPasskey(challenge.token)
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
