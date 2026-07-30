import { ancestorsOf, getConcept, hasDetailPage, type ConceptNode } from '@agentic-toolkit/adh/concepts'
import { siteProdUrl, type SiteId } from '@agentic-toolkit/adh-registry'

// Same-site breadcrumb path for a node. Detail-bearing nodes (sites + leaves)
// link to their /details page; concepts + the root live in the graph, so they
// link back to it (root → '/', concepts → '/?focus=<id>').
function pathFor(node: ConceptNode): string {
  if (hasDetailPage(node)) return `/details/${node.id}`
  return node.id === 'hub' ? '/' : `/?focus=${node.id}`
}

/** Crawlable breadcrumb trail + a BreadcrumbList JSON-LD block (absolute URLs on
 *  the site's own host). Server component. */
export function Breadcrumb({ siteId, topicId }: { siteId: SiteId; topicId: string }) {
  const node = getConcept(topicId)
  if (!node) return null
  const trail = [...ancestorsOf(topicId), node]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: n.label,
      item: siteProdUrl(siteId, pathFor(n)),
    })),
  }

  return (
    <nav className="adh-details__crumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((n, i) => {
          const last = i === trail.length - 1
          return (
            <li key={n.id}>
              {i > 0 && <span className="adh-details__crumb-sep" aria-hidden="true">›</span>}
              {last ? (
                <span aria-current="page">{n.label}</span>
              ) : (
                <a href={pathFor(n)}>{n.label}</a>
              )}
            </li>
          )
        })}
      </ol>
      {/* JSON-LD from trusted, in-repo data (taxonomy labels + registry hosts).
          `<` is escaped to < — the canonical safe way to embed structured
          data, so no value can ever break out of the <script> element. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </nav>
  )
}
