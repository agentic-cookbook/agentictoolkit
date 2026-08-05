import { pathMatches, type NavLink } from './NavLink'
import type { PopoverEntry } from './NavigationPopover'

// The section the host site's own nav rows carry. The popover rules a divider
// wherever two adjacent entries disagree on this number (`NavigationPopover`), so all
// it has to be is DISTINCT from the others in play — 0 (SiteMenu's auth top section),
// 1 (`hubCoreGroups`' HUB_SECTION) and 2 (`debugSiteGroups`' DEBUG_SECTION). Ordering
// is the array's job, not this number's; 3 is simply the next free value.
export const SITE_NAV_SECTION = 3

export type SiteNavEntriesOptions = {
  /** The Home destination the menu's top section renders ABOVE these rows — when it
   *  renders one at all. It does so only signed IN; signed out that section is
   *  Login / Sign up and nothing else, so pass `undefined` there and nothing is
   *  dropped. Dropping unconditionally is how a site whose own nav points at
   *  `/home` (community's "Forum") loses its board entirely on a signed-out phone. */
  homeHref?: string
  /** The Details destination the menu renders below Help, on every site that ships its
   *  own `/details`. Same contract as `homeHref` and for the same reason: hub's bar
   *  still declares a `details` link when signed OUT (the one destination it kept), so
   *  without this a signed-out phone opens the menu on two identical Details rows —
   *  the canonical one and the bar's, folded in. Undefined on a site with no such row,
   *  where nothing is dropped. */
  detailsHref?: string
  /** The current route, for `current` marking. */
  pathname: string
}

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
export function buildSiteNavEntries(
  navLinks: NavLink[] | undefined,
  { homeHref, detailsHref, pathname }: SiteNavEntriesOptions,
): PopoverEntry[] {
  if (!navLinks?.length) return []
  // The destinations this menu ALREADY renders above these rows. Each is optional and
  // each is dropped only when its row actually exists — see the props' docs.
  const alreadyAbove = [homeHref, detailsHref].filter((h): h is string => h !== undefined)
  return (
    navLinks
      // `homeHref` is the top section's first row and `detailsHref` sits below Help,
      // while hub's bar carries links of its own to both — without this the phone menu
      // opens on two Homes, or two Details.
      //
      // Deliberately the ONLY things dropped. The bar has a second filter — a link to
      // `siteNameHref` (`/`), on the grounds that the brand text links there — but it
      // applies only when the brand text is actually rendered, i.e. when no
      // `siteSwitcher` was supplied. Every adh site supplies one, so on those sites the
      // brand is this menu's TRIGGER and nothing in the header goes to `/` at all.
      // Copying that filter here unconditionally would leave a declared destination
      // with no route to it on the one viewport that needs it.
      .filter((link) => !alreadyAbove.includes(link.href))
      .map((link) => ({
        kind: 'leaf' as const,
        section: SITE_NAV_SECTION,
        item: {
          key: `nav:${link.href}`,
          label: link.label,
          href: link.href,
          icon: link.icon,
          current: (link.matchPaths ?? [link.href]).some((m) => pathMatches(pathname, m)),
        },
      }))
  )
}
