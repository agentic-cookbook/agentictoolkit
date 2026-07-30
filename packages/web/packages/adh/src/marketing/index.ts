export { MarketingLanding } from './MarketingLanding'
export type { MarketingLandingProps } from './MarketingLanding'
export { StorySections } from './StorySections'
export type { StorySectionsProps } from './StorySections'
export { BRAND_PROMISE, PILLAR_COPY, STAGE_LABEL } from './story-copy'
// ---- Task 6.3 ----
// The session-aware marketing header, via its PACKAGE PATH rather than './…': it is
// 'use client' and every other module in this entry is a server component, so inlining it
// would hoist its directive over the whole `marketing/index` bundle (see its own header
// comment, and marketing/LandingHeroGate for the identical treatment).
export { MarketingSiteHeader } from '@agentic-toolkit/adh/marketing/MarketingSiteHeader'
export type { MarketingSiteHeaderProps } from '@agentic-toolkit/adh/marketing/MarketingSiteHeader'
// Relative, deliberately: MarketingRootHtml is a server module in this same entry and holds
// no module-level state, so inlining it forks nothing and hoists nothing.
export { MarketingRootHtml } from './MarketingRootHtml'
export type { MarketingRootHtmlProps } from './MarketingRootHtml'
