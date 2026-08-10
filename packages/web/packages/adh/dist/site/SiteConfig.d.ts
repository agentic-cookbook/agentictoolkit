import type { ComponentType, ReactNode } from 'react';
import type { SiteId } from '@agentic-toolkit/adh-registry';
import type { SiteRoute, SiteSeo } from '@agentic-toolkit/adh-registry/seo';
import type { MarketingRootHtmlProps } from '@agentic-toolkit/adh/marketing';
/** The paths every site in the family keeps out of its production index.
 *
 *  Measured, not assumed: all but two of the sites in content/landing/manifest.json want
 *  exactly this list. The two that differ say so by passing `robotsDisallow`, which is the
 *  only way to disagree — `help` allows its whole surface (`['/api/', '/auth/']`), and `hub`
 *  adds `/settings` to it. A site that ADDS spreads this constant rather than restating it:
 *  a hand-copied list is a list that stops tracking this one, and hub's did — it dropped
 *  `/home` on the grounds that its `/home` is the signed-in app itself, which is a reason to
 *  keep a crawler out rather than a reason to let one in.
 *
 *  `/api/` is the same-origin BFF proxy and `/auth/` the SSO callback: neither is a page,
 *  so neither is a crawl target on any tier. */
export declare const FAMILY_ROBOTS_DISALLOW: readonly string[];
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
export type SiteSitemap = SiteRoute[] | (() => SiteRoute[] | Promise<SiteRoute[]>);
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
    id: SiteId;
    /** Title + description, and optionally a bespoke social card. Not derivable: the
     *  registry knows what a site is called, not what it is for. */
    seo: SiteSeo;
    /** Paths to keep out of the production index, replacing (not extending)
     *  FAMILY_ROBOTS_DISALLOW. Omit unless the site genuinely differs. */
    robotsDisallow?: readonly string[];
    /** The site's public routes, as paths. Required: a site with no sitemap is a site whose
     *  pages are discoverable only by luck, and the absence would read as intentional. */
    sitemap: SiteSitemap;
    /** The site's own header, in place of the shared `<MarketingSiteHeader>`. */
    header?: MarketingRootHtmlProps['header'];
    /** The site's own context providers, mounted between the family AuthProvider and the
     *  shell. */
    providers?: ComponentType<{
        children: ReactNode;
    }>;
    /** Header nav items for the SHARED header; ignored when `header` is set. */
    navLinks?: MarketingRootHtmlProps['navLinks'];
    /** Header items outside the collapsing nav, at the bar's trailing edge. */
    trailingNavLinks?: MarketingRootHtmlProps['trailingNavLinks'];
    /** Footer links added to the shared legal/sites row. */
    footerLinks?: MarketingRootHtmlProps['footerLinks'];
    /** Whether the cold-load silent-SSO probe runs on the site's non-landing routes
     *  (default `true`). See the prop's own doc on MarketingRootHtmlProps. */
    silentSso?: boolean;
    /** This site's gate for `/home`, in place of the family's `<HomeGate>`.
     *
     *  The same kind of seam as `header` and `providers`, opened for the same reason: one
     *  site needing a different gate used to mean a different `app/home/layout.tsx`, and a
     *  route file that differs is a route file nothing keeps in step. `hub` sets it because
     *  it owns `/login` — an unauthenticated visitor goes there rather than out through the
     *  cross-site SSO flow HomeGate performs. Omit and the family gate is used. */
    homeGate?: SiteGate;
    /** This site's gate for `/<workspace>`, in place of the family's `<HomeGate>`. Separate
     *  from `homeGate` because the two answer different questions: `/home` needs only a
     *  signed-in caller, while `/<workspace>` names a principal the caller may not be a
     *  member of. `hub` resolves that membership; the family's sites do not need to, because
     *  the shared shell only ever puts a workspace of the caller's own in the URL. */
    workspaceGate?: SiteGate;
    /** This site's SSO callback body, in place of the family's `<AuthCallback>`.
     *
     *  A ReactNode rather than a component type because the two take different props: the
     *  family's exchanges a one-time `#code` for a session, and `hub` — which HOSTS the
     *  authorization server — runs the fuller `<SsoCallback>` flow against its own auth
     *  context. Omit and the family callback is used. */
    authCallback?: ReactNode;
}
/** A gate: a client component that decides whether the route below it may render at all.
 *
 *  Mounted from a SERVER layout, which is what keeps `robots: { index: false }` on the
 *  route — a client component cannot export metadata, so a site whose gate is its layout
 *  has no way to say "not indexable" and the gated pages end up in the index. */
export type SiteGate = ComponentType<{
    children: ReactNode;
}>;
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
    id: SiteId;
    seo: SiteSeo;
    /** Resolved: the site's own list, or FAMILY_ROBOTS_DISALLOW. */
    robotsDisallow: readonly string[];
    sitemap: SiteSitemap;
    /** Pre-assembled props for `<MarketingRootHtml {...site.shell}>`, so a site's
     *  `app/layout.tsx` spreads one object instead of naming each seam. Typed as the
     *  component's own props minus `children`, so adding a seam there is a compile error
     *  here rather than a field sites silently cannot pass. */
    shell: Omit<MarketingRootHtmlProps, 'children'>;
    /** The route seams, passed through undefaulted — see the fields of the same name on
     *  SiteDefinition.
     *
     *  Undefaulted because a default here would be a default nobody can see: these are read by
     *  exactly two route files, each of which has to name the family's gate anyway to type its
     *  own `??`, and a config that quietly supplies one makes the mount's own line look dead.
     *  So the `??` lives at the mount, where the reader is.
     *
     *  This used to claim a runtime reason — that resolving them would drag
     *  `@agentic-toolkit/auth`'s module graph ("a token store and a refresh timer at module
     *  scope") behind `app/robots.ts` and `app/sitemap.ts`. That was wrong twice over, and the
     *  correction matters because sites were being told to reason from it: `@agentic-toolkit/auth`
     *  is itself a `'use client'` barrel, so a server module importing it gets client REFERENCES
     *  and never evaluates a line of it — which is why hub's `site.config.tsx` can hold four
     *  client components and its `app/robots.ts` still executes nothing but this file. And there
     *  is no such timer or store to drag: the package has no module-scope state and no
     *  `setInterval` anywhere in its source. The paragraph above this one is the constraint that
     *  IS real, and it runs the other way — a `'use client'` importer would pull `research`'s
     *  server-only sitemap reads into a browser bundle. */
    homeGate?: SiteGate;
    workspaceGate?: SiteGate;
    authCallback?: ReactNode;
}
/**
 * Assemble a site's configuration.
 *
 * The one per-site declaration in the family. It reads as data and it is data: no field is
 * inspected here beyond `id`, so the React values (`header`, `providers`) pass through
 * untouched and stay whatever the server graph made them.
 */
export declare function defineSite(site: SiteDefinition): SiteConfig;
/** The sitemap's routes, whether the site listed them or supplies a function.
 *
 *  Exists so `app/sitemap.ts` can be one shape in all 38 sites: without it the file would
 *  have to branch on the field's type, which is the per-site difference this whole module
 *  is here to delete. */
export declare function siteSitemapRoutes(site: SiteConfig): Promise<SiteRoute[]>;
//# sourceMappingURL=SiteConfig.d.ts.map