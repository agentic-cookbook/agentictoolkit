import type { SiteId } from '@agentic-toolkit/adh-registry'

// The marketing sites that render the shared concept-graph landing. Kept as a
// tiny, prose-free literal (NO import of the tree) so the always-loaded header
// can check participation without bundling every details page's copy. The
// concept tree must focus a node for each id here — guarded by concepts.test.ts.
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
