import type { SiteId } from './registry'

// The brand-story layer — one structural story record per site, the data spine
// behind every logged-out landing (see docs/planning/brand-story-plan.md).
// PURE DATA + TYPES (no React), like the registry it sits beside. Copy (labels,
// blurbs, hero prose) stays in the locale content catalog (websites/site-config);
// this module holds only what is identical across translations: where each site
// sits in the brand architecture, the message house, and the visitor journey.
//
// Why a sibling Record instead of fields on SiteDef: the SITES literal's
// <gen:sites> block is owned by scaffold-sites.py, so hand-authored judgment
// fields there would be clobbered on regeneration. `Record<SiteId, SiteStory>`
// makes the compiler the governance instead — scaffolding a new SiteId without
// authoring its story is a type error, never a silent gap.

/** Brand tier — the From/Of rule (brand-story-plan §2).
 *  - `masterbrand`: the Hub itself; carries the whole promise.
 *  - `chapter`: prefix-named sites OF the hub — one capability or stage each.
 *  - `satellite`: endorsed own-identity products (Toolkit, Persona Registry,
 *    Cookbook, FishLamp Design) — their own audience, visibly "from the Hub".
 *  - `proof`: own-named consumer products FROM the hub (Bitbag, My Agentic
 *    Teams, Learn True Facts) — the proof layer; only tie is a provenance mark,
 *    and they are excluded from hub-brand chrome and audits. */
export type BrandTier = 'masterbrand' | 'chapter' | 'satellite' | 'proof'

/** Message-house pillar (brand-story-plan §3) — which third of the promise
 *  ("everything your AI agents need to become real software") a site serves:
 *  agent `identity`, the agentic `backend`, or `build`-with-agents. */
export type StoryPillar = 'identity' | 'backend' | 'build'

/** Visitor-journey stage (brand-story-plan §4): Discover → Learn → Build →
 *  Ship → Adopt. Drives the logged-out landing's framing and its default CTA. */
export type FunnelStage = 'discover' | 'learn' | 'build' | 'ship' | 'adopt'

export interface SiteStory {
  tier: BrandTier
  pillar: StoryPillar
  funnelStage: FunnelStage
  /** The next site in this site's story — the logged-out landing's "next step"
   *  cross-link (e.g. the personas pipeline: personas → personabuilder →
   *  personaregistry → hub). Every chain converges on the hub (guarded by a
   *  test): whatever door a visitor entered, the story leads to the platform.
   *
   *  NOT the guided tour's graph. `/tour` walks the family in one sequence
   *  ending on a terminal site; this converges every branch on the hub. The
   *  two are different edge sets with different shapes and different owners
   *  — this one is hand-authored brand judgment, the tour's is derived from
   *  the `next:` frontmatter in `frontend/content/landing/sites/` — and the
   *  tour's lives in `SITE_TOUR_NEXT` below. They agree for many sites,
   *  which is exactly why reading one for the other stays wrong quietly. */
  nextStep: SiteId
}

/** One story per site, keyed by SiteId — same display order as SITES. */
export const SITE_STORIES: Record<SiteId, SiteStory> = {
  // --- proof layer: own-named products FROM the hub ---
  bitbag: { tier: 'proof', pillar: 'identity', funnelStage: 'discover', nextStep: 'hub' },
  // --- the masterbrand + core family ---
  hub: { tier: 'masterbrand', pillar: 'backend', funnelStage: 'discover', nextStep: 'hub-help' },
  // help.adh.com (the consolidated help surface). Its own chapter, converging straight on the hub.
  'hub-help': { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'hub' },
  cookbook: { tier: 'satellite', pillar: 'build', funnelStage: 'learn', nextStep: 'toolkit' },
  projects: { tier: 'chapter', pillar: 'build', funnelStage: 'build', nextStep: 'devteam' },
  narratives: { tier: 'chapter', pillar: 'build', funnelStage: 'discover', nextStep: 'hub' },
  personaregistry: { tier: 'satellite', pillar: 'identity', funnelStage: 'adopt', nextStep: 'hub' },
  devteam: { tier: 'chapter', pillar: 'build', funnelStage: 'build', nextStep: 'hub' },
  toolkit: { tier: 'satellite', pillar: 'build', funnelStage: 'build', nextStep: 'hub' },
  myagenticteams: { tier: 'proof', pillar: 'identity', funnelStage: 'adopt', nextStep: 'hub' },
  mcp: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'hub' },
  // --- the scaffolded chapters ---
  community: { tier: 'chapter', pillar: 'build', funnelStage: 'adopt', nextStep: 'hub' },
  support: { tier: 'chapter', pillar: 'build', funnelStage: 'adopt', nextStep: 'hub-help' },
  // docs.adh.com and the `docs` SiteId are retired (folded into help.adh.com, which serves the
  // guides + /rest-api); help continues to toolkit (docs' former nextStep). The landing itself
  // (agenticdeveloperhelp.com) is delisted — stories that used to flow INTO 'help' (hub, support)
  // now flow to 'hub-help', the family's Help destination.
  help: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'toolkit' },
  news: { tier: 'chapter', pillar: 'build', funnelStage: 'discover', nextStep: 'hub' },
  academy: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'cookbook' },
  dashboards: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  recipes: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'cookbook' },
  personas: { tier: 'chapter', pillar: 'identity', funnelStage: 'build', nextStep: 'personabuilder' },
  communities: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  ecosystems: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  registries: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  storage: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'hub' },
  customers: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'billing' },
  products: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'billing' },
  billing: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  domains: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  authentication: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'customers' },
  sites: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'hub' },
  devices: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  notifications: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  knowledgebases: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'hub' },
  tools: { tier: 'chapter', pillar: 'build', funnelStage: 'build', nextStep: 'toolkit' },
  education: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'academy' },
  teamregistry: { tier: 'chapter', pillar: 'identity', funnelStage: 'adopt', nextStep: 'hub' },
  teambuilder: { tier: 'chapter', pillar: 'identity', funnelStage: 'build', nextStep: 'teamregistry' },
  codereviews: { tier: 'chapter', pillar: 'build', funnelStage: 'ship', nextStep: 'hub' },
  personabuilder: { tier: 'chapter', pillar: 'identity', funnelStage: 'build', nextStep: 'personaregistry' },
  research: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'knowledgebases' },
  consultants: { tier: 'chapter', pillar: 'build', funnelStage: 'adopt', nextStep: 'fishlamp' },
  // Organizations is the account-shape chapter: who your org is, who is in it, how it
  // is configured. Its teams topic is what hands the story to teambuilder.
  orgs: { tier: 'chapter', pillar: 'backend', funnelStage: 'adopt', nextStep: 'teambuilder' },
  // Notebook sits beside research — the same markdown surface, kept private. It hands
  // off to research, which is where a note becomes something you publish.
  notebook: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'research' },
  integrations: { tier: 'chapter', pillar: 'backend', funnelStage: 'build', nextStep: 'hub' },
  // Gamification is a property OF a product, so its story continues into products.
  gamification: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'products' },
  games: { tier: 'chapter', pillar: 'build', funnelStage: 'ship', nextStep: 'products' },
  // --- selling, testing, finding people, and filing what you write down ---
  // The hub's own merch shop: physical goods, so its story hands straight back to
  // the hub rather than into any product chapter.
  store: { tier: 'chapter', pillar: 'backend', funnelStage: 'adopt', nextStep: 'hub' },
  // Stores is the storefront ON a product, so its story continues into products.
  stores: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'products' },
  // Testing is the other half of shipping quality, beside code review.
  testing: { tier: 'chapter', pillar: 'build', funnelStage: 'ship', nextStep: 'codereviews' },
  // The developer directory — the people layer beside the consultant directory.
  registry: { tier: 'chapter', pillar: 'build', funnelStage: 'adopt', nextStep: 'consultants' },
  // Docs is research with the publishing stripped out, so it hands off to research.
  docs: { tier: 'chapter', pillar: 'build', funnelStage: 'learn', nextStep: 'research' },
  // --- studio & consulting. FishLamp Design is the studio the family sits under
  // (it replaced Agentic Developer Studio, whose site is gone); consulting points
  // at it as the absorbing site. fishlampdesign is the same site on its second
  // domain, so it shares fishlamp's story. ---
  consulting: { tier: 'chapter', pillar: 'build', funnelStage: 'adopt', nextStep: 'fishlamp' },
  fishlamp: { tier: 'satellite', pillar: 'build', funnelStage: 'discover', nextStep: 'hub' },
  fishlampdesign: { tier: 'satellite', pillar: 'build', funnelStage: 'discover', nextStep: 'fishlamp' },
  // --- operational consoles ---
  admin: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  status: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
  builds: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'status' },
  // --- registered but unlisted ---
  messaging: { tier: 'chapter', pillar: 'backend', funnelStage: 'ship', nextStep: 'hub' },
}

/** The guided tour's next-step graph: whose `/tour` this site's `/tour` hands
 *  off to. Read `SITE_STORIES[id].nextStep` for the brand story instead — the
 *  note on that field says why the two are not the same edge set.
 *
 *  GENERATED. The entries between the sentinels below come from the `next:`
 *  frontmatter in `frontend/content/landing/sites/`, spliced by
 *  `landing sites generate`; `landing sites check` fails if they drift. To
 *  change the walk, edit the markdown — not this file. The declaration and
 *  this comment are hand-written and outside the region, so the generator
 *  owns the graph and nothing else.
 *
 *  `Partial` is load-bearing twice over, and is why this is a second const
 *  rather than a field spliced into `SITE_STORIES`: the walk is being ported
 *  a few sites at a time, so the region covers a SUBSET of `SiteId` and will
 *  until every site has a markdown file; and the terminal site — where the
 *  walk ends — never has a next step, so even a finished walk leaves one id
 *  absent by construction. A site with no entry here is not on the tour yet;
 *  that is a state to render, not an error. */
export const SITE_TOUR_NEXT: Partial<Record<SiteId, SiteId>> = {
  // <gen:tour> managed by landing — do not edit by hand
  hub: 'narratives',
  narratives: 'news',
  news: 'store',
  store: 'academy',
  academy: 'education',
  education: 'recipes',
  recipes: 'research',
  research: 'authentication',
  authentication: 'knowledgebases',
  knowledgebases: 'notebook',
  notebook: 'docs',
  docs: 'personabuilder',
  personabuilder: 'personas',
  personas: 'projects',
  projects: 'sites',
  sites: 'storage',
  storage: 'teambuilder',
  teambuilder: 'toolkit',
  toolkit: 'tools',
  tools: 'billing',
  billing: 'codereviews',
  codereviews: 'testing',
  testing: 'communities',
  communities: 'customers',
  customers: 'dashboards',
  dashboards: 'devices',
  devices: 'domains',
  domains: 'ecosystems',
  ecosystems: 'gamification',
  gamification: 'integrations',
  integrations: 'notifications',
  notifications: 'orgs',
  orgs: 'games',
  games: 'products',
  products: 'stores',
  stores: 'registries',
  registries: 'community',
  community: 'consultants',
  consultants: 'registry',
  registry: 'consulting',
  consulting: 'devteam',
  devteam: 'cookbook',
  cookbook: 'personaregistry',
  personaregistry: 'support',
  support: 'help',
  help: 'teamregistry',
  // </gen:tour>
}

export function getSiteStory(id: SiteId): SiteStory {
  return SITE_STORIES[id]
}
