import type { ReactElement, ReactNode } from 'react'

/** One tile in a `Cards` grid: a heading and whatever prose follows it. */
export function Card({ title, children }: { title: ReactNode; children: ReactNode }): ReactElement {
  return (
    <div className="lp-card">
      <h3>{title}</h3>
      {children}
    </div>
  )
}
