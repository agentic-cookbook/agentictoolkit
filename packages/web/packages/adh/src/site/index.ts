// The per-site declaration every ADH family site is assembled from. Its own entry, not a
// member of `marketing/index`: a site's `app/robots.ts`, `app/sitemap.ts` and `details`
// pages import the config too, and none of them wants the landing deck, the story sections
// and the wordmark pulled in behind it. Holds no module state — pure types plus a function
// that returns its argument — so unlike `home`, `flags` or the telemetry leaves it owes
// tsup no `external` pairing.
export { defineSite, siteSitemapRoutes, FAMILY_ROBOTS_DISALLOW } from './SiteConfig'
export type { SiteConfig, SiteDefinition, SiteSitemap } from './SiteConfig'
// Which handles the shared `/<workspace>` route leaves claimable. Here rather than in `home`
// because the two callers are settings FORMS, and `home` is the client entry that pulls in
// @agentic-toolkit/data — a form that only needs a word list should not pay for the workspace
// runtime to get it.
export {
  reservedWorkspaceSlugs,
  FAMILY_ROUTE_SEGMENTS,
  SITE_ROUTE_SEGMENTS,
  RESERVED_HANDLE_WORDS,
} from './reservedSlugs'
