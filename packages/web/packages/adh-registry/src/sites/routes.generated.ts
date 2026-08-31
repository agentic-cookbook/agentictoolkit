// Every page route of every deployed site, keyed by site id.
//
// HAND-WRITTEN — the shares it merges are the generated files. Lazy-loaded
// by the site menu (as the package subpath `@agentic-toolkit/adh-registry/routes`)
// to fill the dev "Routes" flyout for sites that pass no curated `routes` prop.
//
// There are several shares because this package is a submodule of every repo that
// builds part of the fleet — adh, adhmarketing, adhplaceholders,
// agenticdeveloperhubwebsite, agenticdeveloperteamwebsite,
// agenticpersonaregistrywebsite — each owning part of it and none able to see the
// others' site trees. Each repo's
// `gen-site-routes.py --region <share>` writes its own file whole; nothing writes
// this one. A single generated file would instead be written by whichever repo ran
// last, with every other repo's entries deleted, and nothing would report it — a
// shorter map compiles, type-checks, satisfies every assertion about the sites it
// still names, and simply drops the other fleets out of the flyout and out of
// research's sitemap.
// `siteRoutes.test.ts` asserts every share is non-empty and that their key sets
// are pairwise disjoint, which are the two symptoms the arrangement can still
// produce.
//
// `SITE_ROUTE_SHARES` is the one list of them. The test derives its cases from it
// rather than repeating the names, so a repo split — and seven more are queued —
// adds a region by editing this file alone. It used to take three coordinated
// edits, two of them in a test whose whole job is to catch a share nobody wrote.
//
// NOT dev-only tooling: research's `src/lib/sitemap-routes.ts` reads
// `SITE_ROUTES.research` at build time to derive which top-level and
// `[workspace]`-child segments are STATIC — i.e. which author or paper slugs would
// be shadowed by a real route — so research's public sitemap is a second,
// load-bearing consumer, not just the flyout above. Do not prune this for being
// unused outside dev tooling.
import type { SiteId } from './registry'
import { SITE_ROUTES_DEVTEAM } from './routes.devteam.generated'
import { SITE_ROUTES_HUB } from './routes.hub.generated'
import { SITE_ROUTES_MAIN } from './routes.main.generated'
import { SITE_ROUTES_MARKETING } from './routes.marketing.generated'
import { SITE_ROUTES_PERSONAREGISTRY } from './routes.personaregistry.generated'
import { SITE_ROUTES_PLACEHOLDER } from './routes.placeholder.generated'

type Share = Partial<Record<SiteId, readonly string[]>>

/** Every share, keyed by the `--region` argument that regenerates it. */
export const SITE_ROUTE_SHARES = {
  devteam: SITE_ROUTES_DEVTEAM,
  hub: SITE_ROUTES_HUB,
  main: SITE_ROUTES_MAIN,
  marketing: SITE_ROUTES_MARKETING,
  personaregistry: SITE_ROUTES_PERSONAREGISTRY,
  placeholder: SITE_ROUTES_PLACEHOLDER,
} satisfies Record<string, Share>

export const SITE_ROUTES: Share = Object.assign(
  {},
  ...Object.values(SITE_ROUTE_SHARES),
)
