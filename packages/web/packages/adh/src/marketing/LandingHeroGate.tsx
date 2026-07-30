'use client'

import type { ReactNode } from 'react'
// Both from the flags barrel, and both by the PACKAGE PATH — never '../flags', even
// though it is a sibling directory here. `flags/index` is its own tsup entry with a
// matching `external` because it publishes `FeatureFlagsProvider`'s React context; a
// relative specifier for either name would inline a private copy of that module into
// THIS entry, giving the gate a second, unsubscribed context object. The mechanism and
// the FLAG vocabulary used to live in separate packages (toolkit / the former `@adh/chrome`, Task
// 5.3) — the merge made them one barrel, not one bundling unit.
import { useFlagEnabled, FLAG } from '@agentic-toolkit/adh/flags'

export type LandingHeroGateProps = {
  /** The interactive concept-graph explorer (server-rendered, passed through). */
  diagram: ReactNode
  /** The static hero shown while the diagram flag is off (the default). */
  fallback: ReactNode
}

/**
 * Gates the landing's concept-graph explorer behind the
 * `landing_site_explorer_diagram` feature flag. A gate, so only an explicit Yes
 * shows the diagram: backend down, flag absent, and first paint (still Fetching)
 * all fall to the static hero, and it never flashes in unbidden.
 * Both subtrees arrive server-rendered as props; this client chokepoint only
 * picks which one mounts (same pattern as AdhFooter's bitbag gate).
 */
export function LandingHeroGate({ diagram, fallback }: LandingHeroGateProps): ReactNode {
  return useFlagEnabled(FLAG.landingSiteExplorerDiagram) ? diagram : fallback
}
