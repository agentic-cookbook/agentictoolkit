import type { ReactElement, ReactNode } from 'react'
import { Glow } from './Glow'

export interface ScreenProps {
  id?: string
  /** Where the content sits. 'top' parks it in the top third; 'center' is for a hero. */
  align?: 'top' | 'center'
  /** 'section' for a landmark screen; 'div' for one that isn't (the hero). */
  as?: 'section' | 'div'
  className?: string
  /**
   * Light this screen from behind. Default false — a deck where every screen
   * glows is a host's decision, not the package's, and a host that lights only
   * its hero is the commoner case.
   *
   * A host could equally write `<Glow />` as its own first child, since
   * `.lp-screen` is already the positioned, stacking-context ancestor the glow
   * needs. The prop exists so the ordering isn't the host's to get right: the
   * glow has to precede the content it sits behind.
   */
  glow?: boolean
  children: ReactNode
}

/**
 * One screen of the deck: a full viewport tall, and a snap point.
 *
 * `align="top"` is the default and is the interesting one — see css/base.css
 * for why content parks high and runs down rather than centring.
 */
export function Screen({
  id,
  align = 'top',
  as: Tag = 'section',
  className,
  glow = false,
  children,
}: ScreenProps): ReactElement {
  const cls = ['lp-screen', align === 'center' ? 'lp-screen--center' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag id={id} className={cls}>
      {glow && <Glow />}
      {children}
    </Tag>
  )
}
