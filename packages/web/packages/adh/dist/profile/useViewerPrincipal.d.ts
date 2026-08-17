import type { ProfilePrincipal } from './types';
export interface ViewerPrincipalResult {
    /** The wider body if one arrived, else the seed. Same value the hook returned before. */
    principal: ProfilePrincipal | null;
    /** True while a signed-in viewer's authed lookup is still in flight. False for a
     *  signed-out viewer, for a disabled hook, and once the lookup has settled either way —
     *  so `!principal && !pending` is a real "no, and we asked". */
    pending: boolean;
}
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
 * shift beyond the widened fields appearing — that is still true of `principal`. `pending` is the
 * exception: it exists precisely so ONE caller (`ProfileFallback`) can render a loading state
 * where treating a still-running lookup as a final "no" would be user-visible and wrong.
 */
export declare function useViewerPrincipal(slug: string, seed: ProfilePrincipal | null, enabled?: boolean): ViewerPrincipalResult;
//# sourceMappingURL=useViewerPrincipal.d.ts.map