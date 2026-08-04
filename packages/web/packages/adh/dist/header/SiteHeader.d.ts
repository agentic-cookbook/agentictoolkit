import { type ReactElement } from 'react';
import { type AdhHeaderAuthProps, type HeaderBadge, type NavLink, type RouteSection } from '@agentic-toolkit/adh/header';
import { type HeaderAuthSource } from '@agentic-toolkit/adh/header-auth';
import { type SiteId } from '@agentic-toolkit/adh-registry';
import type { ReactNode } from 'react';
/**
 * Everything the auth SOURCE owns is Omitted from the public props, so a caller can
 * never clobber it: `user`, `onLogin`, `onLogout`, `resolveSwitchHref` and
 * `authLoading` come from `useAuthSource` and nowhere else. The remaining auth fields
 * (`loginHref`, `signupHref`, `onSignup`, `userIsAdmin`, `settingsHref`, `onSettings`)
 * stay settable per site and WIN over a same-named field the source returns — the
 * precedence the two-component version got from `{...auth} {...rest}`.
 */
export type SiteHeaderProps = Omit<AdhHeaderAuthProps, 'user' | 'onLogin' | 'onLogout' | 'resolveSwitchHref' | 'authLoading'> & {
    /** Which site this header belongs to. The display name + the site-switcher's
     *  contents come from the shared sites registry. */
    siteId: SiteId;
    /** Optional page/section title, shown centered in the bar. */
    pageTitle?: string;
    /** Optional interactive content centered in the bar (e.g. the status site's live
     *  indicator + refresh). Unlike `pageTitle` it accepts arbitrary nodes and stays
     *  clickable. When set it occupies the centre slot in place of `pageTitle`. */
    center?: ReactNode;
    /** Badges shown under the site name. None by default — the family's preview
     *  notice is the strip the toolkit header draws above the bar, not a badge. */
    badges?: HeaderBadge[];
    /** Site-specific controls injected at the start (left) of the right-hand cluster,
     *  before the nav links + auth. Used for functional controls a site needs in the
     *  bar (e.g. cookbook's search/sidebar/theme). */
    leadingActions?: ReactNode;
    /** Static nav links, or a builder given the signed-in flag — resolved AFTER the auth
     *  source runs, so a site can vary its nav by auth state without reading auth itself
     *  (which keeps the page's own header component hook-free). */
    navLinks?: NavLink[] | ((signedIn: boolean) => NavLink[]);
    trailingNavLinks?: NavLink[];
    /** Curated route map, forwarded straight through to the site-menu's "Routes"
     *  flyout (see SiteMenu's devToolsSection) for quick in-app jumping. The flyout
     *  shows only in local/testing/staging or to a signed-in adh admin (any env); when
     *  a site passes none it falls back to the generated per-site route map. */
    routes?: RouteSection[];
    /** The signed-in user's personal workspace slug, forwarded to the site-switcher as
     *  the in-hub slug fallback on the slug-less workspace shell routes (`/home`,
     *  `/home/settings`, …). The hub's header passes the signed-in `user.slug`;
     *  harmless (and ignored) off the hub. */
    personalSlug?: string;
    /** OAuth client id for the login redirect (default 'adh', the shared brand-site
     *  client). Forwarded to the auth source, which decides what to do with it. */
    clientId?: string;
    /** Called after a successful logout — e.g. to navigate away from a gated page.
     *  Consumed only by sources that own a logout; the built-in non-adh sources
     *  receive it via opts and ignore it. */
    onAfterLogout?: () => void;
    /**
     * Inject a different auth source — a hook returning `HeaderAuthState`. Defaults to
     * the anonymous public-site source (a fixed logged-out bar that never reads the
     * session), so a site with no adh AuthProvider above it — the status board — renders
     * fine. The hub and admin pass their own session-reading sources; the
     * marketing/feature-site family passes the shared smart SSO one.
     *
     * Named with the `use` prefix because this component invokes it AS a hook,
     * unconditionally at the top of its body: pass a STABLE, top-level hook, never an
     * inline-redefined function, or hook order breaks between renders.
     */
    useAuthSource?: HeaderAuthSource;
};
/**
 * adh's header: the toolkit's registry-free {@link AdhHeader} plus everything that
 * needs the adh site registry.
 *
 * The split is the point. `@agentic-toolkit/adh`'s header knows about a bar, slots,
 * badges and an auth cluster and nothing else — it resolves no site ids and holds no
 * site list, so a non-adh consumer can use it. Everything registry-shaped lives
 * HERE: the site's display name, the env-aware hub login/signup/settings hrefs, the
 * concept-site "Details" affordance, and adh's real {@link SiteMenuSwitcher} (the
 * marketing/workspace menu taxonomy with its recents, workspaces and dev-tools
 * flyouts), injected through the header's `siteSwitcher` slot.
 *
 * The AUTH wiring is injected too, and for the same reason the switcher is: which
 * session a site reads is the site's business, not the header's. Task 6.2 folded the
 * @adh-shared auth-shim wrapper that used to supply it into this component, so there is
 * one SiteHeader again — a site cannot get the registry half without the auth half.
 */
export declare function SiteHeader({ siteId, pageTitle, center, badges, leadingActions, navLinks, trailingNavLinks, routes, personalSlug, clientId, onAfterLogout, useAuthSource, ...authOverrides }: SiteHeaderProps): ReactElement;
//# sourceMappingURL=SiteHeader.d.ts.map