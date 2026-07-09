'use client'

import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { readErrorMessage } from './client'
import type { BackendTokenFields } from './tokens'
import type { AuthUser } from './types'

/** A second factor a user can satisfy at login. `webauthn` is a ceremony, not a code. */
export type MfaMethod = 'sms' | 'totp' | 'recovery' | 'webauthn'

/** The non-session result of /auth/login when the account has an enrolled factor:
 *  a short-lived pending token + the methods the user may satisfy. The bearer of
 *  the token can only ATTEMPT a factor — it is not itself a session. */
export interface MfaChallenge {
  mfaRequired: true
  token: string
  methods: MfaMethod[]
}

/** The methods that are completed by typing a code (vs. the WebAuthn ceremony). */
export type MfaCodeMethod = Extract<MfaMethod, 'sms' | 'totp' | 'recovery'>

type BackendAuthResponse = BackendTokenFields & { user: AuthUser }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Push an SMS login code to the challenged account's verified primary phone. */
export async function requestLoginSms(token: string): Promise<void> {
  const res = await fetch('/api/auth/login/mfa/sms/send', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not send a code.'))
}

/** Complete the second-factor step with a typed code (sms / totp / recovery). */
export async function completeLoginCode(
  token: string,
  method: MfaCodeMethod,
  code: string,
): Promise<BackendAuthResponse> {
  const res = await fetch('/api/auth/login/mfa', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token, method, code }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'That code didn’t match.'))
  return (await res.json()) as BackendAuthResponse
}

/** Complete the second factor with a passkey / security key: fetch assertion options
 *  bound to the pending token, run the browser ceremony, then verify the assertion. */
export async function completeLoginPasskey(token: string): Promise<BackendAuthResponse> {
  const optRes = await fetch('/api/auth/login/mfa/webauthn/options', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  })
  if (!optRes.ok) throw new Error(await readErrorMessage(optRes, 'Could not start the passkey check.'))
  const { options, token: nextToken } = (await optRes.json()) as {
    options: PublicKeyCredentialRequestOptionsJSON
    token: string
  }
  const response = await startAuthentication({ optionsJSON: options })
  const res = await fetch('/api/auth/login/mfa/webauthn', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token: nextToken, response }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Passkey verification failed.'))
  return (await res.json()) as BackendAuthResponse
}

/** Passwordless passkey login: no password step. Resolve the account by identifier,
 *  run the assertion ceremony, and mint an aal=2 session if the passkey verifies. */
export async function passwordlessPasskeyLogin(identifier: string): Promise<BackendAuthResponse> {
  const optRes = await fetch('/api/auth/login/webauthn/options', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ identifier }),
  })
  if (!optRes.ok) {
    throw new Error(await readErrorMessage(optRes, 'No passkey is available for this account.'))
  }
  const { options, token } = (await optRes.json()) as {
    options: PublicKeyCredentialRequestOptionsJSON
    token: string
  }
  const response = await startAuthentication({ optionsJSON: options })
  const res = await fetch('/api/auth/login/webauthn', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token, response }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Passkey login failed.'))
  return (await res.json()) as BackendAuthResponse
}
