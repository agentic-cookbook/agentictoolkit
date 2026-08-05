import type { ReactElement, ReactNode } from 'react'

/**
 * One side of a `Versus` comparison: a title, and then either a one-line lede,
 * the points under it, or both.
 *
 * `lede` and `points` are optional because a side is legitimately written
 * either way round — a claim with no bullets, or bullets with no claim — and
 * both must be OMITTED rather than passed empty. An empty fragment is not
 * absence: `<p>{<></>}</p>` is a styled empty paragraph carrying
 * `.lp-versus p`'s margins, and `points={[]}` is a styled empty `<ul>`. The
 * component cannot tell an empty fragment from content (it is one child
 * either way), so the caller has to say which it means, exactly as it does
 * for `Head`'s optional `title`.
 */
export interface VersusSide {
  title: ReactNode
  lede?: ReactNode
  points?: ReactNode[]
}

/**
 * One panel. Both sides render through this rather than through two copies of
 * the same JSX: the copies are what let the previous version guard neither
 * side, and a fix applied to one copy and not the other is the commoner shape
 * of that bug, not a rarer one.
 */
function Panel({ side, className }: { side: VersusSide; className: string }): ReactElement {
  return (
    <div className={className}>
      <h3>{side.title}</h3>
      {side.lede !== undefined && <p>{side.lede}</p>}
      {side.points !== undefined && side.points.length > 0 && (
        <ul>
          {side.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  )
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
      <Panel side={them} className="lp-versus__them" />
      <Panel side={us} className="lp-versus__us" />
    </div>
  )
}
