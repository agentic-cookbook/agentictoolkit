import type { ReactElement, ReactNode } from 'react'

/**
 * Planned agents, kept visibly separate from the shipped provider chips
 * above it — its own label (reusing `Head`'s `.lp-eyebrow`), its own rule,
 * its own container. A reader who skims a list of names and comes away
 * thinking a planned provider ships today has been misled by the layout,
 * whatever the sentence beside it says, so the separation is structural
 * rather than a caveat in prose that a skimmer never reaches.
 */
export function Roadmap({ eyebrow, children }: { eyebrow: ReactNode; children: ReactNode }): ReactElement {
  return (
    <div className="lp-roadmap">
      <span className="lp-eyebrow">{eyebrow}</span>
      {children}
    </div>
  )
}
