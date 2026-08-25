// Every page route of every deployed site, keyed by site id.
//
// HAND-WRITTEN — the two halves it merges are the generated files. Lazy-loaded
// by the site menu (as the package subpath `@agentic-toolkit/adh-registry/routes`)
// to fill the dev "Routes" flyout for sites that pass no curated `routes` prop.
//
// There are two halves because this package is a submodule of BOTH adh and
// adhmarketing, each owning part of the fleet and neither able to see the other's
// site tree. Each repo's `gen-site-routes.py --region <half>` writes its own file
// whole; nothing writes this one. A single generated file would instead be
// written by whichever repo ran last, with the other repo's entries deleted, and
// nothing would report it — a shorter map compiles, type-checks, satisfies every
// assertion about the sites it still names, and simply drops the other fleet out
// of the flyout and out of research's sitemap. `siteRoutes.test.ts` asserts both
// halves are non-empty and that their key sets are disjoint, which are the two
// symptoms the arrangement can still produce.
//
// NOT dev-only tooling: research's `src/lib/sitemap-routes.ts` reads
// `SITE_ROUTES.research` at build time to derive which top-level and
// `[workspace]`-child segments are STATIC — i.e. which author or paper slugs would
// be shadowed by a real route — so research's public sitemap is a second,
// load-bearing consumer, not just the flyout above. Do not prune this for being
// unused outside dev tooling.
import type { SiteId } from './registry'
import { SITE_ROUTES_MAIN } from './routes.main.generated'
import { SITE_ROUTES_MARKETING } from './routes.marketing.generated'

export { SITE_ROUTES_MAIN, SITE_ROUTES_MARKETING }

export const SITE_ROUTES: Partial<Record<SiteId, readonly string[]>> = {
  ...SITE_ROUTES_MAIN,
  ...SITE_ROUTES_MARKETING,
}
