import type { ReactElement, ReactNode } from 'react'

/**
 * Planned agents, kept visibly separate from the shipped provider chips
 * above it — its own label (reusing `Head`'s `.lp-eyebrow`), its own rule,
 * its own container. A reader who skims a list of names and comes away
 * thinking a planned provider ships today has been misled by the layout,
 * whatever the sentence beside it says, so the separation is structural
 * rather than a caveat in prose that a skimmer never reaches.
 *
 * `eyebrow` is optional, and an absent one renders NO span rather than an
 * empty one: an aside nested inside a section that already carries a heading
 * has nothing left to label, and `.lp-roadmap .lp-eyebrow` has its own margin
 * — so an empty span would open the box with a blank line the host cannot
 * see in the JSX and no test can fail on.
 */
export function Roadmap({ eyebrow, children }: { eyebrow?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <div className="lp-roadmap">
      {eyebrow === undefined ? null : <span className="lp-eyebrow">{eyebrow}</span>}
      {children}
    </div>
  )
}
