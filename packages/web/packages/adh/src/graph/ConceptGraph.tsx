import type { ReactElement } from 'react'
import { headers } from 'next/headers'
import { conceptIds, graphTree } from '@agentic-toolkit/adh/concepts'
import { detectEnv, type SiteEnv, type SiteId } from '@agentic-toolkit/adh-registry'
// PRESERVED IMPORT — the package path, never './ConceptGraphClient'. This module is a
// SERVER component (it reads next/headers); the diagram it renders is 'use client'.
// Under `bundle: true, splitting: false` a relative specifier would inline the client
// module here and esbuild would hoist its directive over the whole chunk, marking this
// server code as client code and breaking every consuming site's build. Its own tsup
// entry + `external` + exports subpath is the other half of the remedy — the same
// boundary trick as footer/FooterChatInner; see verify-bundle-boundaries.py.
// Statically imported (no ssr:false): the graph is deterministic, so Next server-renders
// it to crawlable, keyboard-navigable markup and hydrates the animation in place.
import { ConceptGraphClient } from '@agentic-toolkit/adh/graph/ConceptGraphClient'

export interface ConceptGraphProps {
  /** Node id to open focused on. Unknown ids fall back to the root. */
  focusId: string
  /** Small mono eyebrow above the title (a real SSR element). */
  eyebrow?: string
  /** Plain lead of the headline (e.g. "Agentic Developer"). */
  titleLead?: string
  /** The accented (gold, italic) site word(s) ending the headline. */
  titleAccent: string
  /** The site this landing is for — flags the matching card "You are Here". */
  currentSiteId?: SiteId
}

/** Server component: builds the slim graph tree (no detail prose ships to the
 *  client) and renders the interactive graph focused on `focusId`. The environment
 *  is resolved server-side from the request host so production can render a
 *  "Coming soon" state with no flash of the diagram. */
export async function ConceptGraph({
  focusId,
  eyebrow,
  titleLead,
  titleAccent,
  currentSiteId,
}: ConceptGraphProps): Promise<ReactElement> {
  const tree = graphTree()
  const initial = conceptIds.has(focusId) ? focusId : tree.id
  const env: SiteEnv = detectEnv((await headers()).get('host') ?? '')
  return (
    <ConceptGraphClient
      tree={tree}
      initialFocusId={initial}
      eyebrow={eyebrow}
      titleLead={titleLead}
      titleAccent={titleAccent}
      currentSiteId={currentSiteId}
      env={env}
    />
  )
}
