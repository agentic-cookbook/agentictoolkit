import { SITE_ROUTES } from '@agentic-toolkit/adh-registry/routes'
import type { SiteId } from '@agentic-toolkit/adh-registry'

/** The generated route every site that carries `app/[workspace]/profile/page.tsx` lists. */
const PROFILE_ROUTE = '/[workspace]/profile'

/**
 * Whether `siteId` serves the unconditional profile address, `/<slug>/profile`.
 *
 * Read off the generated route map rather than kept as a maintained list, the same reasoning
 * `servesConceptDetails` gives for the identical shape of question (`concepts/details-links.ts`):
 * `SITE_ROUTES` is rescanned from each site's App Router tree and held to it by
 * `siteRoutes.test.ts`, so a site that gains or drops the route changes this answer in the same
 * commit that changes the route tree — there is no second list to fall out of step with it.
 *
 * Exists because the shared header's avatar menu renders its Profile row on every site in the
 * family (`AvatarMenu`), but the route it links to exists on a subset of the fleet — `SiteHeader`
 * uses this to withhold the row's href where it would 404.
 */
export function hasProfileRoute(siteId: SiteId): boolean {
  return (SITE_ROUTES[siteId] ?? []).includes(PROFILE_ROUTE)
}
