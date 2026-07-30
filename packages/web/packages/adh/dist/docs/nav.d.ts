/**
 * The shared documentation navigation — one structure for every ADH docs surface (the `help` and
 * `docs` sites, and the source of truth the Help modal's topic tree mirrors). Hrefs are
 * **base-relative** (no leading site prefix); {@link DocsShell} joins them onto each site's
 * `basePath` (e.g. `/docs` on the help site, `/` on the docs site) — so the same nav serves sites
 * whose URL prefixes differ, which is exactly what forced the old per-site content copies.
 */
export interface DocsNavLink {
    /** Row label. */
    label: string;
    /** Base-relative slug, no leading slash (e.g. `quickstart`, `oauth/overview`). `''` = the base
     *  index page. */
    slug: string;
}
export interface DocsNavSection {
    /** Optional group heading above the links. Omit for an ungrouped leading block. */
    label?: string;
    links: DocsNavLink[];
}
export declare const DOCS_NAV: DocsNavSection[];
/** Join a site `basePath` and a base-relative `slug` into an absolute href, collapsing the double
 *  slash for the index (`slug === ''`). `basePath` should have no trailing slash (`/docs` or ``). */
export declare function docsHref(basePath: string, slug: string): string;
/** Every base-relative slug in the nav — the enumerable set of doc routes a site generates. */
export declare function docsSlugs(): string[];
/** The nav label for a slug (`''` = Introduction), or `undefined` if the slug isn't in the nav —
 *  used for a route's `<title>` and to reject unknown slugs. */
export declare function docsNavLabel(slug: string): string | undefined;
//# sourceMappingURL=nav.d.ts.map