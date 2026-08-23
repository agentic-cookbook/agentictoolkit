/**
 * The sites whose workspace implementation lives in this package.
 *
 * DATA ONLY -- this module imports no model, and must not grow one. Every model is its own
 * entry (`@agentic-toolkit/adh-site-homes/<id>`) precisely so that mounting one costs one; a
 * barrel that imported all 47 to build a lookup would hand every consumer the whole
 * fleet's feature packages in a single chunk, which is the one thing the per-entry shape
 * buys. A caller that needs a model names it statically, the way a route does.
 *
 * Generated from the sites that mount `app/[workspace]` -- see the plan's step 1.
 */
export const FLEET_HOME_SITE_IDS = [
  'academy',
  'authentication',
  'billing',
  'codereviews',
  'communities',
  'community',
  'consultants',
  'consulting',
  'cookbook',
  'customers',
  'dashboards',
  'devices',
  'devteam',
  'docs',
  'domains',
  'ecosystems',
  'education',
  'games',
  'gamification',
  'help',
  'integrations',
  'knowledgebases',
  'messages',
  'messaging',
  'narratives',
  'news',
  'notebook',
  'notifications',
  'orgs',
  'personabuilder',
  'personas',
  'products',
  'projects',
  'recipes',
  'registries',
  'registry',
  'research',
  'sites',
  'storage',
  'store',
  'stores',
  'support',
  'teambuilder',
  'teamregistry',
  'testing',
  'toolkit',
  'tools',
] as const

export type FleetHomeSiteId = (typeof FLEET_HOME_SITE_IDS)[number]
