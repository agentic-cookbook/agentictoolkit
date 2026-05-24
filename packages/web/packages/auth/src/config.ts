export interface AuthRuntimeConfig {
  /** localStorage key holding the serialized AuthTokens bundle (per site). */
  storageKey: string
  /** Relative path for the cookie-first refresh call. */
  refreshPath: string
}

let config: AuthRuntimeConfig = {
  storageKey: 'auth_tokens',
  refreshPath: '/api/auth/refresh',
}

export function configureAuth(partial: Partial<AuthRuntimeConfig>): void {
  config = { ...config, ...partial }
}

export function authConfig(): AuthRuntimeConfig {
  return config
}
