import type { Metadata } from 'next'
import { getConcept, siteConcept } from '@agentic-toolkit/adh/concepts'
import { getSite, siteProdUrl, type SiteId } from '@agentic-toolkit/adh-registry'
import { siteMetadata } from '@agentic-toolkit/adh-registry/seo'

/** Next `Metadata` for a site's details page — a specific `topic`, or the site's
 *  details overview when omitted. Canonical points at the site's own host so each
 *  topic is an independently-indexable URL. Lives here (not in the framework-free
 *  concepts module) because it depends on `next`. */
export function detailsMetadata(siteId: SiteId, topic?: string): Metadata {
  const site = getSite(siteId)
  const brand = site ? site.fullLabel ?? site.label : 'Agentic Developer Hub'
  const node = topic ? getConcept(topic) : siteConcept(siteId)
  if (!node) return {}
  const path = topic ? `/details/${topic}` : '/details'
  const url = siteProdUrl(siteId, path)
  // Built ON `siteMetadata` rather than beside it. The hand-rolled block this
  // replaces named only title/description/type/url, and because a page's
  // `openGraph` REPLACES the layout's instead of merging, that silently cost
  // every one of these pages its site name, locale and social card — the
  // difference between unfurling as a card and unfurling as a bare link.
  const base = siteMetadata(siteId, {
    title: `${node.label} — ${brand}`,
    description: node.blurb,
    path,
  })
  return {
    ...base,
    // Absolute, and deliberately kept over the relative one `path` produces:
    // identical in effect, but it survives a page being rendered without the
    // layout's `metadataBase`.
    alternates: { canonical: url },
    // These really are articles, not the site's front door.
    openGraph: { ...base.openGraph, type: 'article', title: node.label, url },
  }
}
