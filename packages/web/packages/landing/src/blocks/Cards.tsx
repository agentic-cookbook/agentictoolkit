import type { ReactElement, ReactNode } from 'react'

/**
 * The grid a `Card` sits in. `pair` and `trio` swap the shared `auto-fit` floor
 * for an explicit two- or three-column track once the caller has exactly the
 * item count that wants it — see the `--pair` rule in css/blocks.css for why
 * that has to be an explicit count rather than a wider floor. `trio` is the
 * same argument at nine items: `auto-fit` lays nine cards out as 4 + 4 + 1 at
 * the full measure, and a trailing row of one reads as something having gone
 * wrong rather than as the ninth item.
 *
 * Passing both is a caller error, not a cascade puzzle: the two set the same
 * property, so which one won would depend on stylesheet order.
 */
export function Cards({
  children,
  pair,
  trio,
  className,
}: {
  children: ReactNode
  pair?: boolean
  trio?: boolean
  className?: string
}): ReactElement {
  if (pair === true && trio === true) {
    throw new Error('Cards: `pair` and `trio` set the same column track — pass at most one')
  }
  const cls = [
    'lp-cards',
    pair === true ? 'lp-cards--pair' : '',
    trio === true ? 'lp-cards--trio' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <div className={cls}>{children}</div>
}
