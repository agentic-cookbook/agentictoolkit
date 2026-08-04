import { type ReactElement, type ReactNode } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
import { type RouteSection } from '@agentic-toolkit/adh/header';
import { type NavLink } from './NavLink';
export type MenuLink = {
    site: SiteId;
    label?: string;
    description?: string;
    external?: boolean;
} | {
    route: string;
    label: string;
    description?: string;
};
export type MenuGroup = {
    kind: 'leaf';
    section: number;
    blurb?: boolean;
    link: MenuLink;
} | {
    kind: 'inline';
    section: number;
    blurb?: boolean;
    link: MenuLink;
} | {
    kind: 'topic';
    section: number;
    label: string;
    links: MenuLink[];
};
/** The header-chrome props every site menu (and the dispatcher) carry. */
export type SiteMenuChromeProps = {
    /** Which site this header belongs to — marks the "current" row in the menu list.
     *  (The trigger label is always the hub brand, not this site.) */
    currentSiteId: SiteId;
    /** Whether a user is signed in. Gates the settings affordance only (the trigger
     *  label is always the hub brand, regardless of route or auth state). */
    authenticated?: boolean;
    /** Replaces the trigger's default "Agentic Developer Hub ⌄" content — e.g. a
     *  site's own logo. Used by bitbag.ai to surface the family menu behind its
     *  wordmark. */
    triggerContent?: ReactNode;
    /** Extra class on the trigger button (e.g. to style a logo trigger). */
    triggerClassName?: string;
    /** Transform a cross-site destination href before it's used (link + navigate).
     *  Injected by the auth-aware header: when the user is signed in it wraps the
     *  href into a silent SSO redirect so the target lands ALREADY logged in (no
     *  logged-out flash). Absent ⇒ plain navigation. The current site's own entry
     *  ('/') is never passed through. */
    resolveHref?: (defaultHref: string) => string;
    /** The signed-in user's personal workspace slug, forwarded to {@link useSiteMenu}
     *  as the in-hub slug fallback on the slug-less workspace shell routes (`/home`,
     *  `/home/settings`, …). Supplied by the auth-aware header on the hub. */
    personalSlug?: string;
    /** When signed in, the command row swaps the "?" help button for a settings
     *  gear. `onSettings` (preferred) opens an in-app overlay over the current
     *  route; otherwise `settingsHref` makes the gear a link (satellites redirect
     *  to the hub's settings page). Both absent, or signed out ⇒ the "?" help
     *  button. Gated on `authenticated`: settings never show signed out. */
    settingsHref?: string;
    onSettings?: () => void;
    /** The signed-OUT top-section links (Login / Sign up). Supplied by AdhHeader (its
     *  env-resolved login/signup hrefs); when signed in, or absent, those rows are
     *  omitted (the signed-in top section shows Home / Workspaces / Recents instead). */
    loginHref?: string;
    signupHref?: string;
    /** Curated route map for the "Routes" flyout, appended after the Marketing/Main
     *  sites submenus. Shown in local/testing/staging, and to a signed-in adh admin
     *  in every env — see {@link SiteMenu}'s devToolsSection. When a site passes
     *  none, the flyout falls back to the generated per-site route map
     *  (`@agentic-toolkit/adh-registry/routes`), loaded lazily once the dev tools unlock. */
    routes?: RouteSection[];
    /** The signed-in user holds the adh `admin` capability. Unlocks the whole dev
     *  tail of the menu (Marketing/Main sites, Routes, Debug Options) in EVERY env,
     *  production included. A display courtesy, not a security boundary — everything
     *  it reveals (site lists, route paths, the debug console) ships in the client
     *  bundle for anyone to read; the backend enforces real authorization. */
    userIsAdmin?: boolean;
    /** The host site's OWN primary nav — the same `NavLink[]` the header bar draws.
     *  Surfaced here as rows ONLY while the bar has dropped them, which it does below
     *  768px (`.adh-header__links { display: none }`): the bar cannot hold the brand,
     *  three-plus destinations and the auth cluster inside a 390px phone.
     *
     *  Without this the phone has no primary nav at all. It used to be reachable in the
     *  avatar dropdown, which carried the signed-in nav; that dropdown is an account menu
     *  now, so the destinations have nowhere else to be. Signed OUT was never covered
     *  even then — the media query hides the links at every auth state.
     *
     *  Above the breakpoint these rows are ABSENT, not hidden: see
     *  {@link useHeaderLinksCollapsed}. */
    navLinks?: NavLink[];
    /** Drop the dev-only Routes / Debug Options rows (and the Debug window they own).
     *  Set by the theme editor's SiteMenuPreview, which renders a LIVE SiteMenu inside
     *  the Debug console itself — without this, its "Debug Options" row would open a
     *  second Debug console on top of the first. The same recursion the preview already
     *  guards against for the theme switcher; the window portals to <body>, so the
     *  preview's scoped-CSS trick can't reach it. */
    suppressDevTools?: boolean;
};
export type SiteMenuProps = SiteMenuChromeProps & {
    /** The declarative menu config to render — supplied by a config-only subclass
     *  (MarketingSiteMenu / WorkspaceSiteMenu). This base holds ALL the logic; the
     *  subclass holds ONLY this. */
    groups: MenuGroup[];
};
/**
 * The shared site-menu base: the header's site-switcher trigger rendered as a
 * {@link NavigationPopover} command menu, driven entirely by a declarative
 * {@link MenuGroup} config. It owns everything except the content —
 *
 *  - env-aware destination links (cross-site / in-hub for SITE links via hrefFor,
 *    hub routes via routeHref), each resolved once per row;
 *  - the trigger label (always the hub brand — this menu is the family launcher);
 *  - navigation (SPA for same-origin, full-page for cross-site);
 *  - the signed-in settings gear / signed-out help affordance + the "help" search
 *    command that opens the shared sites-overview popover.
 *
 * The config-only subclasses (MarketingSiteMenu, WorkspaceSiteMenu) supply nothing
 * but their `groups`; the dispatcher (SiteMenuSwitcher) picks which to render by route.
 */
export declare function SiteMenu({ groups, currentSiteId, authenticated, triggerContent, triggerClassName, resolveHref, personalSlug, settingsHref, onSettings, loginHref, signupHref, navLinks, routes, userIsAdmin, suppressDevTools, }: SiteMenuProps): ReactElement;
//# sourceMappingURL=SiteMenu.d.ts.map