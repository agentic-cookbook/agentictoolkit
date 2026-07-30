import type { ReactElement, ReactNode } from 'react'

/**
 * The closing call to action — the one block below the hero that centres,
 * because it is the end of the argument rather than another point in it.
 * `className` lets a caller (see `Contact`) add itself to the same element
 * rather than nesting another wrapper around it.
 */
export function Closer({
  title,
  children,
  className,
}: {
  title: ReactNode
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <div className={['lp-closer', className].filter(Boolean).join(' ')}>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
