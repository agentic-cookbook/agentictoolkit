import { type ReactElement } from 'react';
import type { SiteId } from '@agentic-toolkit/adh-registry';
export interface ProfileFallbackProps {
    slug: string;
    siteId: SiteId;
}
/**
 * The profile, fetched on the CLIENT for a slug the caller could not open as a workspace.
 *
 * This is the `/<slug>` half of the feature, and it is client-side for a reason the server half
 * is not: whether a caller can reach a workspace is only known after the workspace list resolves
 * in the browser, so the decision to show a profile instead happens well after the server
 * response has been sent. The `/<slug>/profile` route, which needs no such decision, fetches on
 * the server and gets real metadata out of it (see the route's page.tsx).
 *
 * Three outcomes on the anonymous layer, and they are deliberately not two:
 *   - 404 → the not-found page with its search. "No such principal" and "not visible to you" are
 *     the same answer on purpose; telling an anonymous caller that a slug exists but is hidden is
 *     itself the disclosure the visibility switch exists to prevent.
 *   - any other failure → an error, NOT the not-found page. A not-found page invites a search
 *     that would fail exactly the same way, which reads as "you typed it wrong" when the truth is
 *     "we are down".
 *
 * The signed-in layer sits ABOVE all three. `useViewerPrincipal(slug, null)` asks the authed
 * twins the same question with the viewer's own token, and its answer wins whenever it arrives —
 * that is the path a `hub` profile takes for the people it is meant for, and without it this
 * component would render "Profile not found" to exactly the audience the `hub` setting exists to
 * admit. The public 404 is only final for a viewer the authed twin also refuses.
 *
 * That "only final" is why the render order below holds `missing` and `error` back with
 * `viewerPending`: the anonymous pair and the authed pair are two independent requests racing
 * each other, the authed one usually slower (it may need a token refresh first), so a `hub`
 * profile's expected FIRST answer is the public miss — for exactly the viewers the setting exists
 * to admit. Rendering that miss before the authed pair settles is the flash this component exists
 * to avoid. A resolved `found` state does not wait: it is already a correct render, and holding it
 * back for a widening that may only add fields would delay a page that is already right.
 *
 * `ProfileView` runs the same hook internally (it is where the widening lives for all six
 * consumers), so a `hub` profile reached through here costs one duplicate GET to the authed twin.
 * That is the price of keeping the widening a property of the view rather than of every caller;
 * it happens on one code path, for signed-in viewers only, and never on the anonymous render.
 */
export declare function ProfileFallback({ slug, siteId }: ProfileFallbackProps): ReactElement | null;
//# sourceMappingURL=ProfileFallback.d.ts.map