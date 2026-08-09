import type { ComponentType, ReactNode } from 'react'
import type { SiteId } from '@agentic-toolkit/adh-registry'
import type { SiteRoute, SiteSeo } from '@agentic-toolkit/adh-registry/seo'
// Type-only, so nothing crosses at runtime and no `external` pairing is owed — the
// whole-statement `import type … from` form is erased before the bundler sees it, and
// frontend/tools/verify-bundle-boundaries.py skips exactly that form (see its comment at
// the top of `_iter_self_specifiers`). The shell's prop type is imported rather than
// restated so `shell` cannot drift from what <MarketingRootHtml> actually accepts.
import type { MarketingRootHtmlProps } from '@agentic-toolkit/adh/marketing'

/** The paths every site in the family keeps out of its production index.
 *
 *  Measured, not assumed: 36 of the 38 sites in content/landing/manifest.json spell this
 *  exact list in their own `app/robots.ts`. The two that differ differ deliberately —
 *  `help` allows its whole surface (`['/api/', '/auth/']`), and `hub` leaves `/home` out
 *  because that is its signed-in app rather than a wall in front of one. Both say so by
 *  passing `robotsDisallow`, which is the only way to disagree.
 *
 *  `/api/` is the same-origin BFF proxy and `/auth/` the SSO callback: neither is a page,
 *  so neither is a crawl target on any tier. */
export const FAMILY_ROBOTS_DISALLOW: readonly string[] = [
  '/login',
  '/signup',
  '/home',
  '/api/',
  '/auth/',
]

/** The sitemap's route list, or a function that goes and gets it.
 *
 *  A function only for a site whose public URLs are not knowable at authoring time —
 *  `research`, whose papers are the site's actual content and are linked from nowhere a
 *  crawler can reach. It runs on the server (see the note on SiteConfig about which graph
 *  this module belongs to), so it may read a backend.
 *
 *  Nothing here declares a revalidation cadence, and a site that needs one must not add a
 *  segment-level `export const revalidate` to `app/sitemap.ts` — that export has to be a
 *  static literal for Next to read it, so a per-site value cannot be expressed there and a
 *  shared literal would put every static sitemap on a re-render loop that rewrites its own
 *  `lastModified` to "now" on each pass. Put the cadence on the fetch instead, where the
 *  data is: research's reads already carry `{ next: { revalidate: 300 } }`
 *  (src/lib/papers-server.ts), and Next derives the route's revalidation from them. */
export type SiteSitemap = SiteRoute[] | (() => SiteRoute[] | Promise<SiteRoute[]>)

/**
 * What a site declares about itself — the whole of it.
 *
 * Everything else under `app/` is a mount of shared code that reads this, so the fields
 * here are exactly the per-site tokens that used to be spelled inline in 38 copies of the
 * same file: the id (which appeared in `layout.tsx` twice, `robots.ts`, `sitemap.ts` and
 * both `details` pages), the two SEO strings only a human can write, and the six seams
 * <MarketingRootHtml> opens.
 */
export interface SiteDefinition {
  /** The registry id. Everything derivable — the brand name, the production origin, the
   *  concept-tree branch — is looked up from it rather than restated here. */
  id: SiteId
  /** Title + description, and optionally a bespoke social card. Not derivable: the
   *  registry knows what a site is called, not what it is for. */
  seo: SiteSeo
  /** Paths to keep out of the production index, replacing (not extending)
   *  FAMILY_ROBOTS_DISALLOW. Omit unless the site genuinely differs. */
  robotsDisallow?: readonly string[]
  /** The site's public routes, as paths. Required: a site with no sitemap is a site whose
   *  pages are discoverable only by luck, and the absence would read as intentional. */
  sitemap: SiteSitemap
  /** The site's own header, in place of the shared `<MarketingSiteHeader>`. */
  header?: MarketingRootHtmlProps['header']
  /** The site's own context providers, mounted between the family AuthProvider and the
   *  shell. */
  providers?: ComponentType<{ children: ReactNode }>
  /** Header nav items for the SHARED header; ignored when `header` is set. */
  navLinks?: MarketingRootHtmlProps['navLinks']
  /** Header items outside the collapsing nav, at the bar's trailing edge. */
  trailingNavLinks?: MarketingRootHtmlProps['trailingNavLinks']
  /** Footer links added to the shared legal/sites row. */
  footerLinks?: MarketingRootHtmlProps['footerLinks']
  /** Whether the cold-load silent-SSO probe runs on the site's non-landing routes
   *  (default `true`). See the prop's own doc on MarketingRootHtmlProps. */
  silentSso?: boolean
}

/**
 * A site's assembled configuration: what `defineSite` returns and what every mount under
 * `app/` reads.
 *
 * ## This module belongs to the SERVER graph, and that is what makes it work
 *
 * A site's config is imported by `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts` and
 * the `details` pages — all server modules — and by nothing on the client. The workspace
 * routes get the site's `SiteHomeModel` from `@/home-model` instead, which is the site's
 * other per-site module and is `'use client'`.
 *
 * That split is not tidiness. Fold the home model in here and the config becomes reachable
 * from a `'use client'` page, which drags whatever the config imports into the browser
 * bundle — including `research`'s sitemap reads, which resolve a backend URL through
 * `@agentic-toolkit/auth/server`. The split runs along the boundary React already draws,
 * so each half stays in one graph and neither has to know about the other.
 */
export interface SiteConfig {
  id: SiteId
  seo: SiteSeo
  /** Resolved: the site's own list, or FAMILY_ROBOTS_DISALLOW. */
  robotsDisallow: readonly string[]
  sitemap: SiteSitemap
  /** Pre-assembled props for `<MarketingRootHtml {...site.shell}>`, so a site's
   *  `app/layout.tsx` spreads one object instead of naming each seam. Typed as the
   *  component's own props minus `children`, so adding a seam there is a compile error
   *  here rather than a field sites silently cannot pass. */
  shell: Omit<MarketingRootHtmlProps, 'children'>
}

/**
 * Assemble a site's configuration.
 *
 * The one per-site declaration in the family. It reads as data and it is data: no field is
 * inspected here beyond `id`, so the React values (`header`, `providers`) pass through
 * untouched and stay whatever the server graph made them.
 */
export function defineSite(site: SiteDefinition): SiteConfig {
  return {
    id: site.id,
    seo: site.seo,
    robotsDisallow: site.robotsDisallow ?? FAMILY_ROBOTS_DISALLOW,
    sitemap: site.sitemap,
    shell: {
      siteId: site.id,
      header: site.header,
      providers: site.providers,
      navLinks: site.navLinks,
      trailingNavLinks: site.trailingNavLinks,
      footerLinks: site.footerLinks,
      silentSso: site.silentSso,
    },
  }
}

/** The sitemap's routes, whether the site listed them or supplies a function.
 *
 *  Exists so `app/sitemap.ts` can be one shape in all 38 sites: without it the file would
 *  have to branch on the field's type, which is the per-site difference this whole module
 *  is here to delete. */
export async function siteSitemapRoutes(site: SiteConfig): Promise<SiteRoute[]> {
  return typeof site.sitemap === 'function' ? site.sitemap() : site.sitemap
}
