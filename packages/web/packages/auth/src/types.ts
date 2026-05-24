export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// authMethods/attributes are returned by the backend but not read by either
// site; typed as open records to avoid guessing field names we don't consume.
export type UserAuthMethod = Record<string, unknown>
export type UserAttribute = Record<string, unknown>

/** Canonical user from the temporal backend (`shared/model/User.kt`). */
export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string
  capabilities: string[]
  authMethods: UserAuthMethod[]
  attributes: UserAttribute[]
}

export function hasCapability(user: Pick<AuthUser, 'capabilities'> | null | undefined, capability: string): boolean {
  return !!user?.capabilities?.includes(capability)
}

export function isAdmin(user: Pick<AuthUser, 'capabilities'> | null | undefined): boolean {
  return hasCapability(user, 'admin')
}
