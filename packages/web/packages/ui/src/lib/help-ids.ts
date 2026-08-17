// The well-known help ids, kept OUT of `components/help-content.tsx` on purpose.
//
// That module is `"use client"`, and adh's `defineSite` — which seeds the header's
// entry — lives in the SERVER graph: it is what `app/layout.tsx`, `app/robots.ts` and
// `app/sitemap.ts` import. A Server Component cannot dot into a client module for a
// plain value; React replaces the module with client REFERENCES, so reading a string
// export throws "You cannot dot into a client module from a server component" rather
// than yielding the string. A component crossing that boundary is fine (that is what
// the boundary is FOR) and `<HelpContentProvider>` still crosses it from
// MarketingRootHtml; a constant is not.
//
// So the id lives here, in a directive-free module both graphs may import, and
// `help-content.tsx` is left holding only what genuinely needs the client.

/** The id the shared header's site name looks up.
 *
 *  One constant rather than the literal spelled twice, because the two spellings
 *  sit in different packages — `defineSite` writes the entry, `SiteHeader` reads
 *  it — and a typo across that gap degrades silently to "no help here". */
export const SITE_TITLE_HELP_ID = 'site-title'
