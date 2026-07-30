import type { ReactElement, ReactNode } from 'react'

/**
 * The paragraph under a `Head` — deliberately a standalone component rather
 * than scoped to appear only inside one, since the same voice and measure are
 * wanted for the odd paragraph that follows a card grid or a chip list too.
 */
export function Lede({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <p className={['lp-lede', className].filter(Boolean).join(' ')}>{children}</p>
}
