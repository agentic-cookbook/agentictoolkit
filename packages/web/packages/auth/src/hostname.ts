/** True for a local-development hostname (localhost / loopback / *.local /
 *  *.localhost). A generic heuristic, not a site-registry lookup — deliberately
 *  matching the 'local' branch of the adh registry's detectEnv so silent-SSO gating
 *  behaves identically whether a host consumes this package directly or through the
 *  @adh-shared/auth shim.
 *
 *  EXPORTED so the adh monorepo's parity test can pin it against @adh-shared/adh's
 *  detectEnv 'local' branch — the two are deliberate mirrors (this package can't
 *  import the host registry), and an unpinned mirror is how environment-dependent
 *  login loops slip in.
 *
 *  Its own module rather than living in context.tsx: `sso.ts` needs it too, and
 *  context.tsx already imports sso.ts — so keeping it there would make the two
 *  modules circular.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/:\d+$/, '')
  return (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  )
}
