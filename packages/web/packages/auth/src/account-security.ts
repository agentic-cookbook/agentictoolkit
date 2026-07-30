'use client'

// Self-serve account-security API: second-factor management (TOTP, WebAuthn,
// recovery codes) + preferred method, over /account/mfa/*. Backs the Security
// settings workspace. Lives in this package (not @agentic-toolkit/data)
// because the WebAuthn registration ceremony shares @simplewebauthn/browser
// with the login-time MFA completion in ./mfa.ts — enrollment and challenge
// are two halves of one factor lifecycle.
//
// The response types are authored locally (mirroring the backend's
// /account/mfa OpenAPI schemas) — the hub's generated @agentic-toolkit/adh-api-types
// is a monorepo coupling this package can't take.
import { startRegistration } from '@simplewebauthn/browser'
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { authedJson, authedRequest } from './client'

/** Factor status — mirrors `GET /account/mfa`. */
export interface MfaStatus {
  sms: boolean
  totp: boolean
  webauthn: boolean
  /** A TOTP enrollment awaits confirmation. */
  totpPending: boolean
  /** Unused recovery codes. */
  recoveryRemaining: number
  preferredMethod: 'sms' | 'totp' | 'webauthn' | null
}

/** One registered credential — mirrors `GET /account/mfa/webauthn` items. */
export interface WebauthnCredential {
  id: string
  name: string
  kind: 'passkey' | 'security_key'
  createdAt: string
  lastUsedAt?: string | null
}

export type PreferredMethod = 'sms' | 'totp' | 'webauthn'

export function getMfaStatus(): Promise<MfaStatus> {
  return authedJson<MfaStatus>('/api/account/mfa')
}

// --- TOTP -------------------------------------------------------------------

/** Mirrors `POST /account/mfa/totp/enroll`. */
export interface TotpEnrollment {
  /** Base32 secret (for manual entry). */
  secret: string
  /** otpauth:// URI to render as a QR code. */
  otpauthUri: string
}

export function enrollTotp(): Promise<TotpEnrollment> {
  return authedJson<TotpEnrollment>('/api/account/mfa/totp/enroll', { method: 'POST' })
}
export function confirmTotp(code: string): Promise<void> {
  return authedJson('/api/account/mfa/totp/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}
export async function removeTotp(): Promise<void> {
  await authedRequest('/api/account/mfa/totp', { method: 'DELETE' })
}

// --- WebAuthn (passkeys / security keys) ------------------------------------

export function listWebauthn(): Promise<{ items: WebauthnCredential[] }> {
  return authedJson<{ items: WebauthnCredential[] }>('/api/account/mfa/webauthn')
}

/** Run the full browser registration ceremony for a passkey or security key. */
export async function registerWebauthn(kind: 'passkey' | 'security_key', name: string): Promise<void> {
  const { options, token } = await authedJson<{
    options: PublicKeyCredentialCreationOptionsJSON
    token: string
  }>('/api/account/mfa/webauthn/register/options', {
    method: 'POST',
    body: JSON.stringify({ kind }),
  })
  const response = await startRegistration({ optionsJSON: options })
  await authedJson('/api/account/mfa/webauthn/register/verify', {
    method: 'POST',
    body: JSON.stringify({ token, response, name }),
  })
}
export async function removeWebauthn(id: string): Promise<void> {
  await authedRequest(`/api/account/mfa/webauthn/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// --- Recovery codes + preference --------------------------------------------

export function regenerateRecoveryCodes(): Promise<{ codes: string[] }> {
  return authedJson<{ codes: string[] }>('/api/account/mfa/recovery/regenerate', { method: 'POST' })
}
export function setPreferredMethod(method: PreferredMethod): Promise<{ preferredMethod: PreferredMethod }> {
  return authedJson<{ preferredMethod: PreferredMethod }>('/api/account/mfa/preference', {
    method: 'PUT',
    body: JSON.stringify({ method }),
  })
}
