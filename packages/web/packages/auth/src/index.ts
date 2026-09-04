'use client'

export { AuthProvider, useAuth, useOptionalAuth } from './context'
export type { AuthContextValue, AuthProviderProps } from './context'
export type { MfaChallenge, MfaMethod, MfaCodeMethod } from './mfa'
export { RequireAuth } from './RequireAuth'
export type { RequireAuthProps } from './RequireAuth'
export { RequireAuthSkeleton } from './RequireAuthSkeleton'
export { HomeAuthGate } from './HomeAuthGate'
export type { HomeAuthGateProps } from './HomeAuthGate'
export { HomeGate } from './HomeGate'
export type { HomeGateProps } from './HomeGate'
export { AuthCallback } from './AuthCallback'
export type { AuthCallbackProps } from './AuthCallback'
export { SsoCallback } from './ui/SsoCallback'
export type { SsoCallbackProps } from './ui/SsoCallback'
export {
  beginLogin,
  beginLinkProvider,
  providerSigninUrl,
  ssoLogout,
  ssoSwitchUrl,
  stashReturnTo,
  takeReturnTo,
  safeReturnTo,
  currentReturnTo,
  centralLoginTarget,
  centralEmailLogin,
  centralSendMfaSms,
  centralCompleteMfaCode,
  centralCompleteMfaPasskey,
  centralPasswordlessPasskey,
  readCentralParams,
  PENDING_LINK_KEY,
} from './sso'
export type {
  BeginLoginOptions,
  BeginLinkProviderOptions,
  SsoLogoutOptions,
  CentralParams,
  CentralLoginTarget,
  CentralEmailLoginParams,
} from './sso'
export { isAdmin, hasCapability } from './types'
export type { AuthUser, AuthTokens, UserAuthMethod, UserAttribute } from './types'
export { configureAuth, authConfig } from './config'
export type { AuthRuntimeConfig } from './config'
export { ProviderLinkHandler } from './ProviderLinkHandler'
export type { ProviderLinkHandlerProps } from './ProviderLinkHandler'
export { providerLabel, oauthErrorMessage, accountExistsLinkBody, accountExistsTitle } from './labels'
export { AuthHttpError, setAuthRetryMarker } from './client'
export { reportUnexpectedAuthError, reportAuthError, setAuthErrorReporter } from './report'
export {
  getMfaStatus,
  enrollTotp,
  confirmTotp,
  removeTotp,
  listWebauthn,
  registerWebauthn,
  removeWebauthn,
  regenerateRecoveryCodes,
  setPreferredMethod,
} from './account-security'
export type { MfaStatus, WebauthnCredential, PreferredMethod, TotpEnrollment } from './account-security'
