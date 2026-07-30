import { getSite, splitSiteTitle, type SiteId } from '@agentic-toolkit/adh-registry'
import { siteConcept } from '@agentic-toolkit/adh/concepts'
import { ConceptGraph } from './ConceptGraph'

export interface LandingGraphProps {
  /** The marketing site whose node the landing graph opens focused on. */
  siteId: SiteId
  /** Optional `?focus=` override from the page's searchParams (deep-link). */
  focusId?: string
}

/** A site's landing graph: the shared concept graph, opened focused on this
 *  site's node (or a `?focus=` deep-link). Server component. */
export function LandingGraph({ siteId, focusId }: LandingGraphProps) {
  const node = siteConcept(siteId)
  const initial = focusId && focusId.length > 0 ? focusId : node?.id ?? 'hub'
  const site = getSite(siteId)
  // Title = the site's brand, themed like the SiteLanding hero: a plain
  // "Agentic Developer" lead + the site word(s) in gold italic (shared
  // `splitSiteTitle`). The eyebrow is the site node's kicker.
  const { titleLead, titleAccent } = site
    ? splitSiteTitle(site)
    : { titleLead: '', titleAccent: node?.label ?? 'Agentic Developer' }
  return (
    <ConceptGraph
      focusId={initial}
      eyebrow={node?.kicker}
      titleLead={titleLead}
      titleAccent={titleAccent}
      currentSiteId={siteId}
    />
  )
}
