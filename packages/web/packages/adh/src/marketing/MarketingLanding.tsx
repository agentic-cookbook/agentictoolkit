import type { ReactElement } from 'react'
// Imported via the package path (not relative) so this entry doesn't carry its
// own private copy of the concepts barrel's module-level state (the taxonomy's
// `byId` map) — concepts/index is already its own preserved tsup entry, reached
// from several others; see the matching `external` entry and
// verify-bundle-boundaries.py's Check B.
import { siteConcept } from '@agentic-toolkit/adh/concepts'
import { getSite, splitSiteTitle, type SiteId } from '@agentic-toolkit/adh-registry'
// SiteLanding is the ADH family's placeholder hero (brand copy + gold accent), so Task 5.8 put
// it in the adh VOCABULARY tier rather than the generic layout subpath. Both tiers live in this
// package now, but it is still not a `layout` export — hence the sibling relative import.
import { SiteLanding } from '../layout/SiteLanding'
import { LandingGraph } from '@agentic-toolkit/adh/graph'
// Imported via the package path (not relative) so the 'use client' module stays
// its own chunk — the same boundary trick as footer/FooterChatInner and
// graph/ConceptGraphClient. A relative import inlines it into this entry, and
// tsup then hoists its 'use client' over the whole bundle — including
// LandingGraph → ConceptGraph's server-only next/headers, which makes every
// site importing this barrel fail to build.
import { LandingHeroGate } from '@agentic-toolkit/adh/marketing/LandingHeroGate'
import { StorySections } from './StorySections'

// The graph explorer can only ever appear in the pre-launch envs; production
// never constructs it (keeping prod pages static). Server-only DEPLOYMENT_ENV
// read, same as AdhThemeStyle — fail-safe: unset/unknown env means the prod
// hero. Within these envs the diagram is additionally gated behind the
// `landing_site_explorer_diagram` feature flag (LandingHeroGate) — off by
// default, so every site shows the static hero until the flag is flipped.
const GRAPH_ENVS = new Set(['local', 'testing', 'staging'])

export type MarketingLandingProps = {
  /** The marketing site whose copy this landing renders. */
  siteId: SiteId
  /** Optional `?focus=` deep-link forwarded to the landing graph (no effect on
   *  the production hero). */
  focusId?: string
}

/**
 * The shared logged-out landing for the ADH marketing family: the concept-graph
 * explorer opened focused on this site's node (the "consistent" half — every
 * site shows the same map of the constellation, centred on itself), followed by
 * the shared {@link StorySections} (the "thorough" half — key points, the
 * message-house pillar, the next step). Everything derives from `siteId` — zero
 * hard-coded copy — via the registry, the story layer (sites/story.ts), and the
 * site-config content catalog behind the locale seam.
 *
 * The diagram is doubly gated: production never constructs it (the family's
 * pre-launch gate — prod pages stay static), and in the pre-launch envs it
 * only mounts when the `landing_site_explorer_diagram` feature flag is on
 * (default off — the static `SiteLanding` hero shows instead). The story
 * sections render in every environment. A server component: the whole story
 * is crawlable server markup.
 */
export function MarketingLanding({ siteId, focusId }: MarketingLandingProps): ReactElement {
  const node = siteConcept(siteId)
  const site = getSite(siteId)
  const { titleLead, titleAccent } = site
    ? splitSiteTitle(site)
    : { titleLead: '', titleAccent: node?.label ?? 'Agentic Developer' }

  const staticHero = (
    <SiteLanding
      eyebrow={node?.kicker ?? ''}
      titleLead={titleLead}
      titleAccent={titleAccent}
      blurb={node?.blurb ?? ''}
    />
  )
  const hero = GRAPH_ENVS.has(process.env.DEPLOYMENT_ENV ?? '') ? (
    <LandingHeroGate
      diagram={<LandingGraph siteId={siteId} focusId={focusId} />}
      fallback={staticHero}
    />
  ) : (
    staticHero
  )

  return (
    <>
      {hero}
      <StorySections siteId={siteId} />
    </>
  )
}
