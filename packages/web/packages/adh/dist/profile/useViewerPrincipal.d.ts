import type { ProfilePrincipal } from './types';
/**
 * The signed-in half of the profile's two-layer resolution. The server rendered whatever the
 * ANONYMOUS endpoint returned (see `fetchPublicPrincipal`, and the pair doctrine it follows);
 * this asks the authed twin the same question with the viewer's own token and prefers its answer.
 *
 * It is what makes `hub` visibility mean anything on a rendered page: a `hub` profile is a 404 on
 * the public route by design, so `seed` is null for it and only this hook can resolve it. It also
 * widens a profile the server DID resolve — `assembleUserCard` uses the audience mask for
 * per-field privacy grants, not just the page-level gate, so a `public` profile still has
 * hub-audience social links and contact methods that the anonymous body omits.
 *
 * `useOptionalAuth` rather than `useAuth`: this component renders on 41 sites and must not throw
 * on one that mounts no AuthProvider. No provider means no viewer, which means no upgrade — the
 * same outcome as a signed-out visitor, reached without a crash.
 *
 * Returns `seed` until an upgrade lands, so there is no loading state to render and no layout
 * shift beyond the widened fields appearing. A failed upgrade leaves the anonymous view standing,
 * which is a correct page rather than an error.
 */
export declare function useViewerPrincipal(slug: string, seed: ProfilePrincipal | null): ProfilePrincipal | null;
//# sourceMappingURL=useViewerPrincipal.d.ts.map