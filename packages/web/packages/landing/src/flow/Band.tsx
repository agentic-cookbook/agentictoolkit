import type { ReactElement, ReactNode } from 'react'
import { Wrap } from '../deck/Wrap'

/**
 * A band's ground. `dark` and `soft` alternate down the page; `paper` is the
 * light band, and a page should have at most one — it is a punctuation mark,
 * and two of them is a stripe pattern.
 */
export type BandTone = 'dark' | 'soft' | 'paper'

export interface BandProps {
  id?: string
  /** Default 'dark'. */
  tone?: BandTone
  /**
   * The diagonal cut along the band's top edge. Default true.
   *
   * False for the first band under a hero that already ends on an angle, and
   * for a band whose neighbour above is the same tone — a seam between two
   * identical grounds is invisible geometry that still costs the overlap. On
   * `tone="paper"`, which cuts its own foot regardless, this controls the top
   * edge only.
   */
  seam?: boolean
  className?: string
  children: ReactNode
}

/**
 * One section of the flow page: the `Screen` of this layout, minus the screen.
 *
 * A band is as tall as its content. That is the whole difference from
 * `.lp-screen`, and it is why none of the deck's vertical-unit reasoning
 * carries over: `100vh` versus `svh`/`dvh` was an argument about holding a SNAP
 * UNIT still while Safari's toolbar collapsed, and a band has no snap unit.
 *
 * The seam is a `clip-path` on the band plus a negative top margin that pulls
 * it up under its neighbour by the same distance, so the diagonal reveals the
 * band above rather than the page background. Both come off `--lp-seam`, so the
 * two cannot drift.
 */
export function Band({ id, tone = 'dark', seam = true, className, children }: BandProps): ReactElement {
  const cls = ['lp-band', `lp-band--${tone}`, seam ? 'lp-band--seam' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <section id={id} className={cls}>
      <Wrap>{children}</Wrap>
    </section>
  )
}
