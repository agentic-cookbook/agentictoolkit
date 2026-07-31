import type { SiteId } from '@agentic-toolkit/adh-registry'

// The sites the concept tree focuses a node for — the 31 marketing landings that
// render the shared concept-graph, plus `devteam`, which the tree names but which
// renders its OWN landing and its own `/details` tree. What membership buys a site
// is the header's "Details" link, and that link is a relative `/details` on the
// current site, so a site with a hand-built details route belongs here just as much
// as one using the shared route. Kept as a tiny, prose-free literal (NO import of
// the tree) so the always-loaded header can check participation without bundling
// every details page's copy. The concept tree must focus a node for each id here —
// guarded by concepts.test.ts.
export const CONCEPT_SITE_IDS: ReadonlySet<SiteId> = new Set<SiteId>([
  'academy',
  'authentication',
  'billing',
  'communities',
  'community',
  'consulting',
  'customers',
  'dashboards',
  'devices',
  'devteam',
  'domains',
  'ecosystems',
  'education',
  'knowledgebases',
  'narratives',
  'news',
  'notifications',
  'personas',
  'products',
  'projects',
  'recipes',
  'registries',
  'sites',
  'storage',
  'support',
  'tools',
  'teamregistry',
  'teambuilder',
  'codereviews',
  'personabuilder',
  'research',
  'consultants',
])

export function isConceptSite(siteId: SiteId): boolean {
  return CONCEPT_SITE_IDS.has(siteId)
}
