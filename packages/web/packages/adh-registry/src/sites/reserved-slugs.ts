import type { SiteId } from './registry'

/**
 * Slugs a registrant cannot claim, per site.
 *
 * Next resolves a static segment ahead of a dynamic one and does NOT fall through, so a
 * name that matches a top-level page is not a conflict the router reports — the static
 * page simply wins, and the registrant sees their profile 404 with nothing in any log to
 * explain it. That is what this list was built to prevent.
 *
 * Public profiles have since moved behind a static prefix of their own —
 * `/registry/<registry>/<entry>` on registries, `/consultant/<entry>` on consultants — so
 * a claimed name is no longer a *sibling* of `app/tour/` and can no longer be shadowed by
 * one. The list is still enforced, and every route that serves a claimed name calls
 * {@link isReservedSlug} and 404s: which names are claimable is a product decision, and
 * relaxing it would hand out names support conversations rely on staying unambiguous. So
 * the reason changed and the requirement did not.
 *
 * The paired test asserts this list covers every static directory each site's app/ tree
 * actually has — including each site's own entry prefix, which is why `registry` and
 * `consultant` appear below. Adding a page without adding its name here fails the test.
 */

/** Reserved on every site this module knows about. */
const UNIVERSAL = [
  // On disk today across the landing family.
  'auth',
  'details',
  'home',
  'privacy',
  'terms',
  'tour',
  'search',
  // The static prefixes the public profile routes live under. `registry` is registries'
  // and `consultant` is consultants', but both are reserved on both: the lists are
  // universal, and either site could grow the other's shape.
  'registry',
  'consultant',
  // Framework-owned; no app/ dir will ever vouch for these.
  'api',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  // Auth and admin surfaces, present or future.
  'admin',
  'login',
  'logout',
  'signin',
  'signout',
  'signup',
  'settings',
  'account',
  // Words a support conversation needs to stay unambiguous.
  'new',
  'edit',
  'help',
  'support',
  'about',
  'contact',
  'legal',
  'status',
] as const

export const RESERVED_SLUGS: Readonly<Record<string, readonly string[]>> = {
  registries: UNIVERSAL,
  consultants: UNIVERSAL,
}

/**
 * False for a site with no list — this module speaks only for the sites it names.
 *
 * `siteId` is typed `SiteId` (R6-M7) so an unrecognised site id is a compile error at every
 * *static* call site — the fleet's own registry of known sites is the source of truth for
 * what a caller may even attempt to ask about. This is a type-only fix: the runtime
 * fall-through above is unchanged on purpose. At least one real caller passes a raw DB
 * column (`registry.bound_site_id`, a platform-admin free-form value) that cannot be
 * statically narrowed to `SiteId`, and the entry-slug validation there is pinned by a
 * backend test to fail OPEN — a registry bound to a site id this module has never heard of
 * must still accept slugs, not brick every write. That caller now needs an explicit cast;
 * that is expected, not a gap this signature is meant to close.
 */
export function isReservedSlug(siteId: SiteId, slug: string): boolean {
  const list = RESERVED_SLUGS[siteId]
  if (!list) return false
  return list.includes(slug.trim().toLowerCase())
}

/**
 * True when ANY site this module knows about reserves `slug`.
 *
 * The question a name being claimed *before* it has a site has to ask, and a property of the
 * lists rather than of any one caller — so it lives beside them. A caller that folded
 * `Object.keys(RESERVED_SLUGS)` itself would be re-deriving that property at its own call
 * site, and would have to cast each key back to `SiteId` to do it, because the map's key type
 * is `string`.
 *
 * Deliberately the OR and not one site's list: while the lists happen to be identical the two
 * are indistinguishable, but they are per-site precisely so they can diverge, and the day one
 * does the caller must not silently start answering for whichever site came first.
 */
export function isReservedSlugAnywhere(slug: string): boolean {
  const wanted = slug.trim().toLowerCase()
  return Object.values(RESERVED_SLUGS).some((list) => list.includes(wanted))
}
