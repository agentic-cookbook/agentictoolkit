import {
  getConcept,
  hasDetailPage,
  ownerSiteOf,
  relatedOf,
  siteConcept,
  subtreeOf,
  type ConceptNode,
  type DetailSection,
} from '@agentic-toolkit/adh/concepts'
// Relative on purpose, unlike the two package-path imports around it: this leaf holds no
// module state and carries no directive, so inlining it into the `details` entry costs a
// duplicate of two pure functions and nothing else. The route map it reads is external
// (`@agentic-toolkit/adh-registry`), which is where the one-copy rule actually applies.
import { conceptDetailsUrl } from '../concepts/details-links'
import { siteProdUrl, type SiteId } from '@agentic-toolkit/adh-registry'
// PRESERVED IMPORT — the package path, never './DetailsRail'. Same directive boundary
// as graph/ConceptGraph → graph/ConceptGraphClient: this page is a server module and the
// rail (which filters + arrow-key navigates) is 'use client', so under `bundle: true,
// splitting: false` a relative specifier would inline it and hoist its directive over
// this whole chunk. Its own tsup entry + `external` + exports subpath is the other half
// of the remedy; see verify-bundle-boundaries.py.
import { DetailsRail } from '@agentic-toolkit/adh/details/DetailsRail'
import { Breadcrumb } from './Breadcrumb'
import { DetailSections } from './DetailSections'

export interface DetailsPageProps {
  /** The site this details page belongs to (scopes the left rail + routes). */
  siteId: SiteId
  /** The topic to show. Omit for the site's own node (the details overview). */
  topic?: string
}

/** The shared "topic | details" two-pane page. Server component — fully
 *  crawlable. Fed entirely by the concept module, scoped to `siteId`. The route
 *  wrapper should `notFound()` for an unknown topic before rendering.
 *
 *  Deliberately NOT built on ui's client TopicDetail: this page's rail must be
 *  real `<a>` links that render on the server, crawl, and work with JS off —
 *  requirements the interactive onSelect rail cannot meet. The visual grammar
 *  matches the suite rail via the `.adh-details__*` skin instead. */
export function DetailsPage({ siteId, topic }: DetailsPageProps) {
  const siteNode = siteConcept(siteId)
  const node = topic ? getConcept(topic) : siteNode
  if (!node || !siteNode) return null

  const railTopics = subtreeOf(siteNode.id)
    .filter(hasDetailPage)
    .map((t) => ({
      id: t.id,
      label: t.label,
      href: `/details/${t.id}`,
      active: t.id === node.id,
      leaf: t.id !== siteNode.id,
    }))
  const sections: DetailSection[] =
    node.detail ??
    (node.keyPoints?.length ? [{ kind: 'points', heading: 'Key points', items: node.keyPoints }] : [])
  const related = relatedOf(node.id)

  // Not `siteProdUrl(owner, `/details/${id}`)` unconditionally: a site that does
  // not serve the shared concept-details route 404s that URL. See
  // `conceptDetailsUrl`, which sends those to the owner's landing instead.
  const relatedHref = (r: ConceptNode): string => conceptDetailsUrl(r.id, ownerSiteOf(r.id), siteId)

  return (
    <div className="adh-details">
      <aside className="adh-details__rail">
        <a className="adh-details__back" href="/">‹ Back to the map</a>
        <p className="adh-details__rail-label">{siteNode.label}</p>
        <DetailsRail topics={railTopics} siteLabel={siteNode.label} />
      </aside>

      <main className="adh-details__main">
        <Breadcrumb siteId={siteId} topicId={node.id} />
        {node.kicker && <p className="adh-details__kicker">{node.kicker}</p>}
        <h1 className="adh-details__title">{node.label}</h1>
        <p className="adh-details__lead">{node.blurb}</p>

        {node.ctas && node.ctas.length > 0 && (
          <div className="adh-details__ctas">
            {node.ctas.map((c) => (
              <a
                key={c.href}
                className="adh-details__cta"
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}

        <DetailSections sections={sections} />

        {node.docs && (
          <div className="adh-details__docs">
            {/* `docs` is a help-topic slug, so it resolves against the consolidated help
                surface (site `hub-help`, whose catch-all route `app/[...slug]/page.tsx`
                sits at the ROOT — no `/docs` prefix), not the standalone
                agenticdeveloperhelp.com app, which has no docs route at all. The registry
                row for `help` says the same thing: every family "Help" link points at
                hub-help. concepts.test.ts resolves every `docs` value against helpSlugs()
                so a slug that stops existing fails the suite rather than 404ing here. */}
            <a
              className="adh-details__cta"
              href={siteProdUrl('hub-help', `/${node.docs}`)}
            >
              Read the docs →
            </a>
          </div>
        )}

        {related.length > 0 && (
          <div className="adh-details__related">
            <p className="adh-details__related-label">Connected</p>
            <div className="adh-details__chips">
              {related.map((r) => (
                <a key={r.id} className="adh-details__chip" href={relatedHref(r)}>
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
