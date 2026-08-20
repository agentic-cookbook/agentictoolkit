import type { ReactElement, ReactNode } from 'react'
import { Wrap } from '../deck/Wrap'

export interface FlowHeroProps {
  id?: string
  /** The mark. A `ReactNode` so the host supplies its own `<Image>`/`<img>` —
   * this package never renders one itself. */
  mark?: ReactNode
  /**
   * A claim, not the product name. The name belongs in the header, the mark
   * above it and the browser tab; a landing page gets one line to say what the
   * thing does. (`Hero`, the deck's, says the same and means it the same way.)
   */
  headline: ReactNode
  /** One line under the headline. Not a blurb — the bands are the blurb. */
  sub: ReactNode
  /**
   * The buttons — bare `Btn`s, in the host's own order. NOT wrapped in a `Cta`:
   * `.lp-hero-actions` is already the centred, wrapping flex row, so a `Cta`
   * inside it nests a second one and its 0.75rem gap wins, leaving the hero's
   * own spacing inert and unfixable from `flow.css`.
   */
  children?: ReactNode
  /**
   * The line under the buttons: price, platform floor, availability. Uppercased
   * by the stylesheet, so a host putting a PRODUCT NAME in here must opt out of
   * the transform — Apple's guidelines forbid setting one in all caps.
   */
  meta?: ReactNode
  /** A shot below the composition, usually wrapped in `Bleed`. */
  shot?: ReactNode
}

/**
 * The flow page's opening: a centred composition over a warm ground, with the
 * first shot cropped by the page edge below it.
 *
 * A `<div>` and not a `<section>`: the bands below are the page's landmarks,
 * and a hero that is also one puts an unlabelled region at the top of every
 * screen reader's outline. The deck's `Hero` makes the same call for the same
 * reason.
 */
export function FlowHero({ id, mark, headline, sub, children, meta, shot }: FlowHeroProps): ReactElement {
  return (
    <div id={id} className="lp-hero-flow">
      <Wrap>
        {mark}
        <h1>{headline}</h1>
        <p className="lp-hero-sub">{sub}</p>
        {children !== undefined && <div className="lp-hero-actions">{children}</div>}
        {meta !== undefined && <p className="lp-hero-meta">{meta}</p>}
      </Wrap>
      {shot !== undefined && (
        <Wrap>
          <div className="lp-hero-shot">{shot}</div>
        </Wrap>
      )}
    </div>
  )
}
