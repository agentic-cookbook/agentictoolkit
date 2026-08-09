// The per-site declaration every ADH family site is assembled from. Its own entry, not a
// member of `marketing/index`: a site's `app/robots.ts`, `app/sitemap.ts` and `details`
// pages import the config too, and none of them wants the landing deck, the story sections
// and the wordmark pulled in behind it. Holds no module state — pure types plus a function
// that returns its argument — so unlike `home`, `flags` or the telemetry leaves it owes
// tsup no `external` pairing.
export { defineSite, siteSitemapRoutes, FAMILY_ROBOTS_DISALLOW } from './SiteConfig'
export type { SiteConfig, SiteDefinition, SiteSitemap } from './SiteConfig'
