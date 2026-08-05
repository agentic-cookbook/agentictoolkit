import type { SiteId } from '@agentic-toolkit/adh-registry'
import type { PopoverEntry } from './NavigationPopover'
// PRESERVED IMPORT — the package path, never '../concepts/participating', for the same
// reason SiteHeader.tsx spells it this way: this module is bundled into the header entry,
// which under `bundle: true, splitting: false` would otherwise get its own copy of
// participating's module-level Set alongside the one in dist/concepts/participating.js.
import { isConceptSite } from '@agentic-toolkit/adh/concepts/participating'
import { menuIcon } from './menu-icons'

// Contact + Details: the two destinations that left hub's header bar, re-homed in the
// site menu directly below Help. A pure builder like `siteNavEntries` / `devToolsEntries`
// — {@link SiteMenu} decides WHEN and supplies the resolved hrefs, this decides WHAT.
//
// Both rows carry section 0, the Help row's own section, so the popover rules no divider
// between them (it draws one wherever adjacent entries disagree on `section`). That is
// what "below Help" means structurally: the same group, not a new one under it.

/** The section these rows sit in — Help's, deliberately. See the module comment. */
export const BELOW_HELP_SECTION = 0

/**
 * This site's own `/details`, or undefined where no such page exists.
 *
 * The 32 {@link isConceptSite} sites ship one, and so does the hub — whose details page
 * predates that set and sits outside it. The remaining 11 sites have no `/details` at
 * all, and a menu row is a promise that a destination exists.
 *
 * Site-RELATIVE on purpose. Every one of those 33 sites has its own details page, so
 * this must never be resolved through the hub the way {@link SiteMenu}'s Contact row is:
 * that would aim all 32 satellites at the HUB's details instead of their own.
 */
export function siteDetailsHref(siteId: SiteId): string | undefined {
  return isConceptSite(siteId) || siteId === 'hub' ? '/details' : undefined
}

export type BelowHelpEntriesOptions = {
  /** The Contact destination, already resolved by the engine's `routeHref` — a bare
   *  path on the hub, an SSO-wrapped absolute URL from any other site. `/contact` exists
   *  on the hub and nowhere else in the family, so every site's row points there; the
   *  same shape as the promoted `hub-help` row. */
  contactHref: string
  /** This site's own details page, from {@link siteDetailsHref}. Undefined ⇒ no row. */
  detailsHref?: string
  /** The current route, for `current` marking. */
  pathname: string
}

/** The Contact (+ Details, where it exists) rows rendered immediately below Help. */
export function buildBelowHelpEntries({
  contactHref,
  detailsHref,
  pathname,
}: BelowHelpEntriesOptions): PopoverEntry[] {
  const out: PopoverEntry[] = [
    {
      kind: 'leaf',
      section: BELOW_HELP_SECTION,
      item: {
        key: 'route:/contact',
        label: 'Contact',
        href: contactHref,
        icon: menuIcon('/contact'),
        // Only ever current on the hub, where the href is the bare path; elsewhere it is
        // an absolute URL, which never starts with '/'. The same test the config-driven
        // route rows apply in `useSiteMenu` — a destination must not highlight by one
        // rule here and another there.
        current: isSameOrigin(contactHref) && pathname === contactHref,
      },
    },
  ]
  if (detailsHref)
    out.push({
      kind: 'leaf',
      section: BELOW_HELP_SECTION,
      item: {
        key: 'route:/details',
        label: 'Details',
        href: detailsHref,
        icon: menuIcon('/details'),
        // Prefix-matched, so a details CHILD route (`/details/acme`) keeps the row lit —
        // matching how the bar's own `details` link behaved via `matchPaths`.
        current: pathname === detailsHref || pathname.startsWith(`${detailsHref}/`),
      },
    })
  return out
}

/** A same-origin path: a single leading slash. `//host/x` is protocol-relative, i.e.
 *  another origin, so it is excluded. */
function isSameOrigin(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}
