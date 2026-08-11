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

/**
 * The login paths that PREPARE a factor rather than satisfy one: push an SMS, or
 * hand out WebAuthn assertion options. Exported because the CENTRAL login client
 * (sso.ts) calls the very same three — they mint no session, so there is one of
 * each rather than a site/central pair, and only a MINT needs a central twin (see
 * backend routes/oauthRedirect.ts). Naming them once keeps the two callers from
 * drifting on a path that only fails at runtime.
 */
export const LOGIN_SMS_PATH = '/auth/login/mfa/sms/send'
export const MFA_WEBAUTHN_OPTIONS_PATH = '/auth/login/mfa/webauthn/options'
export const PASSKEY_OPTIONS_PATH = '/auth/login/webauthn/options'

/** A finished WebAuthn ceremony: the opaque assertion, plus the pending token the
 *  options step re-signed for it. Exactly what a verify route consumes — the site's
 *  and the central one alike, which is why the ceremony is shared and only the
 *  verify POST differs. */
export interface WebauthnAssertion {
  token: string
  response: Record<string, unknown>
}

/**
 * Fetch assertion options from `optionsUrl` and run the browser ceremony.
 *
 * The one piece of a WebAuthn login that is genuinely identical whichever session
 * the success mints: the authenticator interaction. Kept single so a site login and
 * a central login cannot come to run different ceremonies — a difference there
 * (user-verification prompts, credential filtering) is invisible until a real
 * authenticator refuses one of them.
 */
async function runAssertion(
  optionsUrl: string,
  body: Record<string, unknown>,
  optionsError: string,
): Promise<WebauthnAssertion> {
  const optRes = await fetch(optionsUrl, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  if (!optRes.ok) throw new Error(await readErrorMessage(optRes, optionsError))
  const { options, token } = (await optRes.json()) as {
    options: PublicKeyCredentialRequestOptionsJSON
    token: string
  }
  const response = await startAuthentication({ optionsJSON: options })
  return { token, response: response as unknown as Record<string, unknown> }
}

/** Run the SECOND-factor assertion for a pending login (after a password). */
export function assertSecondFactor(
  token: string,
  optionsUrl: string,
): Promise<WebauthnAssertion> {
  return runAssertion(optionsUrl, { token }, 'Could not start the passkey check.')
}

/** Run the PASSWORDLESS assertion for an account named by identifier (no password
 *  step — the assertion is the only factor). */
export function assertPasswordlessPasskey(
  identifier: string,
  optionsUrl: string,
): Promise<WebauthnAssertion> {
  return runAssertion(optionsUrl, { identifier }, 'No passkey is available for this account.')
}

/** Push an SMS login code to the challenged account's verified primary phone. */
export async function requestLoginSms(token: string): Promise<void> {
  const res = await fetch(`/api${LOGIN_SMS_PATH}`, {
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

/** Complete the second factor with a passkey / security key: run the assertion
 *  ceremony bound to the pending token, then verify it for THIS site's session. */
export async function completeLoginPasskey(token: string): Promise<BackendAuthResponse> {
  const assertion = await assertSecondFactor(token, `/api${MFA_WEBAUTHN_OPTIONS_PATH}`)
  const res = await fetch('/api/auth/login/mfa/webauthn', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(assertion),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Passkey verification failed.'))
  return (await res.json()) as BackendAuthResponse
}

/** Passwordless passkey login: no password step. Resolve the account by identifier,
 *  run the assertion ceremony, and mint an aal=2 session if the passkey verifies. */
export async function passwordlessPasskeyLogin(identifier: string): Promise<BackendAuthResponse> {
  const assertion = await assertPasswordlessPasskey(identifier, `/api${PASSKEY_OPTIONS_PATH}`)
  const res = await fetch('/api/auth/login/webauthn', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(assertion),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Passkey login failed.'))
  return (await res.json()) as BackendAuthResponse
}
