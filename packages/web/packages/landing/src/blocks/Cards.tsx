import type { ReactElement, ReactNode } from 'react'

/**
 * The grid a `Card` sits in. `pair` swaps the shared `auto-fit` floor for an
 * explicit two-column track once the caller has exactly the item count that
 * wants it — see the `--pair` rule in css/blocks.css for why that has to be an
 * explicit count rather than a wider floor.
 */
export function Cards({
  children,
  pair,
  className,
}: {
  children: ReactNode
  pair?: boolean
  className?: string
}): ReactElement {
  const cls = ['lp-cards', pair === true ? 'lp-cards--pair' : '', className].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
