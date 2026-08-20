import type { ReactElement, ReactNode } from 'react'
import { Wrap } from '../deck/Wrap'

/**
 * The page's foot. A `<footer>` landmark and a content column, and nothing
 * else — what goes in it is entirely the host's, because a footer is where a
 * site says who made it, which is the one thing a shared package cannot know.
 *
 * It reserves the host's dock clearance like every band, and for the same
 * reason: the dock is fixed and the footer is the last thing under it.
 */
export function SiteFooter({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <footer className={['lp-site-foot', className].filter(Boolean).join(' ')}>
      <Wrap>{children}</Wrap>
    </footer>
  )
}
