import { SITE_ROUTES } from '@agentic-toolkit/adh-registry/routes'
import { siteProdUrl, type SiteId } from '@agentic-toolkit/adh-registry'

/** The shared concept-details route. A site that has this file serves a details
 *  page for ANY concept id the tree gives it; a site without it does not. */
const SHARED_TOPIC_ROUTE = '/details/[topic]'

/**
 * Whether `siteId` answers `/details/<concept id>` for an arbitrary concept.
 *
 * Read off the generated route map rather than kept as a list, because a list is
 * a second place to remember: `SITE_ROUTES` is rescanned from the filesystem and
 * guarded by `siteRoutes.test.ts`, so a site that gains or loses the shared
 * details route changes this answer in the same commit that changes the route.
 *
 * `CONCEPT_SITE_IDS` is emphatically NOT this question. It governs whether the
 * header shows a "Details" link, which is a RELATIVE `/details` on the current
 * site, so a site with a hand-built details tree belongs in it — `devteam` is in
 * it for exactly that reason. Using it here is what produced the bug: it says
 * "this site has details", not "this site can be deep-linked by concept id".
 */
export function servesConceptDetails(siteId: SiteId): boolean {
  return (SITE_ROUTES[siteId] ?? []).includes(SHARED_TOPIC_ROUTE)
}

/**
 * The URL for a related concept, from the site currently rendering it.
 *
 * `devteam` is the case this exists for. It renders its own `/details` tree from
 * its own content under an optional catch-all with `dynamicParams = false`, and
 * `generateStaticParams` enumerates only its four roots — so `/details/<concept
 * id>` is not a page there, it is a hard 404. Every related chip pointing at a
 * devteam-owned concept from any of the other 31 sites linked to that 404.
 *
 * A site that cannot answer the deep link gets its landing page instead: the
 * concept is what that whole site is about, so the root is a real answer to the
 * chip rather than an error page.
 */
export function conceptDetailsUrl(
  conceptId: string,
  ownerSiteId: SiteId | undefined,
  currentSiteId: SiteId,
): string {
  if (!ownerSiteId || ownerSiteId === currentSiteId) return `/details/${conceptId}`
  return siteProdUrl(ownerSiteId, servesConceptDetails(ownerSiteId) ? `/details/${conceptId}` : '/')
}
