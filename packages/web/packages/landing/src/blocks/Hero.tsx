import type { ReactElement, ReactNode } from 'react'
import { Screen } from '../deck/Screen'

export interface HeroProps {
  id?: string
  /** The mark. A `ReactNode` so the host supplies its own `<Image>`/`<img>` —
   * this package never renders one itself (see the top-level constraint
   * against depending on `next/image`). */
  mark?: ReactNode
  /**
   * A claim, not the product name — the name belongs in the header, the mark
   * above it and the browser tab. A landing page gets one line to say what
   * the thing does.
   */
  headline: ReactNode
  tagline: ReactNode
  /** `Cta`, `Trust`, `StatusPill` — in the host's own order. */
  children?: ReactNode
  /** Default true. */
  glow?: boolean
}

/**
 * The landing screen: a centred `Screen`, the only one on the page — see the
 * `.lp-screen.lp-hero` comment in `css/blocks.css` for why centring is the
 * hero's exception rather than the rule.
 */
export function Hero({ id, mark, headline, tagline, children, glow = true }: HeroProps): ReactElement {
  return (
    <Screen as="div" id={id} align="center" className="lp-hero" glow={glow}>
      {mark}
      <h1>{headline}</h1>
      <p className="lp-tag">{tagline}</p>
      {children}
    </Screen>
  )
}
