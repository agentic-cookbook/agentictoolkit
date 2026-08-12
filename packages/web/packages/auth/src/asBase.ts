/** Where the authorization server lives, for every module that has to ask it
 *  something. Deliberately import-free: `sso.ts` and `client.ts` both need this and
 *  `sso.ts` already imports `client.ts`, so a home in either one would be a cycle —
 *  and the cycle is what made the second copy (a hard-coded `/api/auth/link-provider`)
 *  look reasonable. One module, one answer, no cycle.
 */

/** The configured AS base, trimmed of trailing slashes, or undefined. */
export function authApiBaseOrEnv(explicit?: string): string | undefined {
  const base = explicit ?? process.env.NEXT_PUBLIC_AUTH_API_URL
  return base ? base.replace(/\/+$/, '') : undefined
}

/** Resolve an AS endpoint path against the configured AS base, falling back to
 *  the same-origin BFF proxy (`/api…`) when no base is set (local dev). The one
 *  place the base-vs-proxy choice is made.
 *
 *  Every path passed here is one only the AS can answer — a login step, an authorize
 *  navigation, the redemption of a code the AS itself minted. The fallback is the
 *  historical local-dev shape (this origin's proxy, which forwards to a backend that
 *  used to BE the AS); it is right for a path whose worst case is a refusal, and
 *  callers whose worst case is a half-done write refuse instead (see
 *  `centralLoginStep`). */
export function asEndpoint(path: string, authApiBase?: string): string {
  const base = authApiBaseOrEnv(authApiBase)
  return base ? `${base}${path}` : `/api${path}`
}
