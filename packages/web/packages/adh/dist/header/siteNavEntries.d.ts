import { type NavLink } from './NavLink';
import type { PopoverEntry } from './NavigationPopover';
export declare const SITE_NAV_SECTION = 3;
export type SiteNavEntriesOptions = {
    /** The Home destination the menu's top section renders ABOVE these rows — when it
     *  renders one at all. It does so only signed IN; signed out that section is
     *  Login / Sign up and nothing else, so pass `undefined` there and nothing is
     *  dropped. Dropping unconditionally is how a site whose own nav points at
     *  `/home` (community's "Forum") loses its board entirely on a signed-out phone. */
    homeHref?: string;
    /** The current route, for `current` marking. */
    pathname: string;
};
/**
 * The host site's own primary nav, as menu rows.
 *
 * {@link SiteMenu} calls this only while the header bar has DROPPED those links —
 * below 768px, where `.adh-header__links` is `display: none` because the bar cannot
 * hold the brand, three-plus destinations and the auth cluster inside a 390px phone.
 * Without it the phone has no primary nav at all: the links used to be reachable in
 * the avatar dropdown, which is an account menu now, and signed OUT was never covered
 * even then (the media query hides the links at every auth state).
 *
 * The rows carry the bar's labels verbatim and mark `current` with the bar's own
 * `pathMatches` over `matchPaths ?? [href]` — a destination that reads or highlights
 * differently in the two places is a second nav, not the same one relocated.
 */
export declare function buildSiteNavEntries(navLinks: NavLink[] | undefined, { homeHref, pathname }: SiteNavEntriesOptions): PopoverEntry[];
//# sourceMappingURL=siteNavEntries.d.ts.map