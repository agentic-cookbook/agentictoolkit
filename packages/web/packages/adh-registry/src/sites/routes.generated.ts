// Every page route of every deployed site, keyed by site id.
//
// HAND-WRITTEN — the four shares it merges are the generated files. Lazy-loaded
// by the site menu (as the package subpath `@agentic-toolkit/adh-registry/routes`)
// to fill the dev "Routes" flyout for sites that pass no curated `routes` prop.
//
// There are four shares because this package is a submodule of adh, adhmarketing,
// adhplaceholders and agenticdeveloperhubwebsite, each owning part of the fleet and
// none able to see the others' site trees. Each repo's
// `gen-site-routes.py --region <share>` writes its own file whole; nothing writes
// this one. A single generated file would instead be written by whichever repo ran
// last, with the other three repos' entries deleted, and nothing would report it — a shorter map compiles, type-checks,
// satisfies every assertion about the sites it still names, and simply drops the
// other fleets out of the flyout and out of research's sitemap.
// `siteRoutes.test.ts` asserts every share is non-empty and that their key sets
// are pairwise disjoint, which are the two symptoms the arrangement can still
// produce.
//
// NOT dev-only tooling: research's `src/lib/sitemap-routes.ts` reads
// `SITE_ROUTES.research` at build time to derive which top-level and
// `[workspace]`-child segments are STATIC — i.e. which author or paper slugs would
// be shadowed by a real route — so research's public sitemap is a second,
// load-bearing consumer, not just the flyout above. Do not prune this for being
// unused outside dev tooling.
import type { SiteId } from './registry'
import { SITE_ROUTES_HUB } from './routes.hub.generated'
import { SITE_ROUTES_MAIN } from './routes.main.generated'
import { SITE_ROUTES_MARKETING } from './routes.marketing.generated'
import { SITE_ROUTES_PLACEHOLDER } from './routes.placeholder.generated'

export {
  SITE_ROUTES_HUB,
  SITE_ROUTES_MAIN,
  SITE_ROUTES_MARKETING,
  SITE_ROUTES_PLACEHOLDER,
}

export const SITE_ROUTES: Partial<Record<SiteId, readonly string[]>> = {
  ...SITE_ROUTES_HUB,
  ...SITE_ROUTES_MAIN,
  ...SITE_ROUTES_MARKETING,
  ...SITE_ROUTES_PLACEHOLDER,
}
