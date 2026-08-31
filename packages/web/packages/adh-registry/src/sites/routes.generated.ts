// Every page route of every deployed site, keyed by site id.
//
// HAND-WRITTEN — the shares it merges are the generated files. Lazy-loaded
// by the site menu (as the package subpath `@agentic-toolkit/adh-registry/routes`)
// to fill the dev "Routes" flyout for sites that pass no curated `routes` prop.
//
// There are several shares because this package is a submodule of every repo that
// builds part of the fleet, each owning part of it and none able to see the others'
// site trees. Each repo's `gen-site-routes.py --region <share>` writes its own file
// whole; nothing writes this one. A single generated file would instead be written by
// whichever repo ran last, with every other repo's entries deleted, and nothing would
// report it — a shorter map compiles, type-checks, satisfies every assertion about
// the sites it still names, and simply drops the other fleets out of the flyout and
// out of research's sitemap. `siteRoutes.test.ts` asserts every share is non-empty
// and that their key sets are pairwise disjoint, which are the two symptoms the
// arrangement can still produce.
//
// `SITE_ROUTE_SHARES` below is the roster, and the only one: the test derives its
// cases from that constant rather than repeating the names, so a split adds a region
// by editing this file alone. Do not restate the repos, or the count, in prose here.
// The paragraph that used to do so was rewritten at five consecutive splits and was
// still wrong at the sixth, while sitting a dozen lines above the constant that was
// right.
//
// NOT dev-only tooling, and as of 2026-08-31 not even same-repo tooling:
// agenticdeveloperresearchwebsite's `src/lib/sitemap-routes.ts` reads
// `SITE_ROUTES.research` at build time to derive which top-level and
// `[workspace]`-child segments are STATIC — i.e. which author or paper slugs would
// be shadowed by a real route. research is the only site in the fleet with
// `public_workspace_segment: true`, so its workspace slugs ARE top-level URL
// segments and that derivation is load-bearing, not a flyout nicety.
//
// That consumer now lives in a different repo and reaches this map through the
// shared submodule. So pruning the `research` entry — or letting its share go
// unwritten — breaks a build in a repo nobody reading this file would think to
// check, and breaks it as a quietly smaller sitemap rather than as an error.
import type { SiteId } from './registry'
import { SITE_ROUTES_COMMUNITY } from './routes.community.generated'
import { SITE_ROUTES_COOKBOOK } from './routes.cookbook.generated'
import { SITE_ROUTES_DEVTEAM } from './routes.devteam.generated'
import { SITE_ROUTES_DOCS } from './routes.docs.generated'
import { SITE_ROUTES_HUB } from './routes.hub.generated'
import { SITE_ROUTES_MAIN } from './routes.main.generated'
import { SITE_ROUTES_MARKETING } from './routes.marketing.generated'
import { SITE_ROUTES_PERSONAREGISTRY } from './routes.personaregistry.generated'
import { SITE_ROUTES_PLACEHOLDER } from './routes.placeholder.generated'
import { SITE_ROUTES_REGISTRY } from './routes.registry.generated'
import { SITE_ROUTES_RESEARCH } from './routes.research.generated'
import { SITE_ROUTES_SHIPR } from './routes.shipr.generated'
import { SITE_ROUTES_TOOLKIT } from './routes.toolkit.generated'

type Share = Partial<Record<SiteId, readonly string[]>>

/** Every share, keyed by the `--region` argument that regenerates it. */
export const SITE_ROUTE_SHARES = {
  community: SITE_ROUTES_COMMUNITY,
  cookbook: SITE_ROUTES_COOKBOOK,
  devteam: SITE_ROUTES_DEVTEAM,
  docs: SITE_ROUTES_DOCS,
  hub: SITE_ROUTES_HUB,
  main: SITE_ROUTES_MAIN,
  marketing: SITE_ROUTES_MARKETING,
  personaregistry: SITE_ROUTES_PERSONAREGISTRY,
  placeholder: SITE_ROUTES_PLACEHOLDER,
  registry: SITE_ROUTES_REGISTRY,
  research: SITE_ROUTES_RESEARCH,
  shipr: SITE_ROUTES_SHIPR,
  toolkit: SITE_ROUTES_TOOLKIT,
} satisfies Record<string, Share>

export const SITE_ROUTES: Share = Object.assign(
  {},
  ...Object.values(SITE_ROUTE_SHARES),
)
