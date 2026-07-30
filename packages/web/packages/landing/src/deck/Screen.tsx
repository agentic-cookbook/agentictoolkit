import type { ReactElement, ReactNode } from 'react'

export interface ScreenProps {
  id?: string
  /** Where the content sits. 'top' parks it in the top third; 'center' is for a hero. */
  align?: 'top' | 'center'
  /** 'section' for a landmark screen; 'div' for one that isn't (the hero). */
  as?: 'section' | 'div'
  className?: string
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
  children,
}: ScreenProps): ReactElement {
  const cls = ['lp-screen', align === 'center' ? 'lp-screen--center' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag id={id} className={cls}>
      {children}
    </Tag>
  )
}
