import type { ReactElement, ReactNode } from 'react'

/** One side of a `Versus` comparison: a title, a one-line lede, and the points under it. */
export interface VersusSide {
  title: ReactNode
  lede: ReactNode
  points: ReactNode[]
}

/**
 * Two panels side by side: what every other tool does, and what this one does
 * instead. The comparison IS the argument, so it gets a shape of its own
 * rather than being a pair of ordinary `Card`s — `us` is lit and `them` is
 * not, which is the whole point read at a glance.
 */
export function Versus({ them, us }: { them: VersusSide; us: VersusSide }): ReactElement {
  return (
    <div className="lp-versus">
      <div className="lp-versus__them">
        <h3>{them.title}</h3>
        <p>{them.lede}</p>
        <ul>
          {them.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
      <div className="lp-versus__us">
        <h3>{us.title}</h3>
        <p>{us.lede}</p>
        <ul>
          {us.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
