import type { ReactElement, ReactNode } from 'react'

/**
 * One point: an optional bold lead-in (`term`) and the sentence it opens
 * (`detail`). The lead-in is what makes a list of four paragraphs skimmable
 * without shortening any of them.
 */
export interface PointEntry {
  term?: ReactNode
  detail: ReactNode
}

/**
 * A marked list of claims, each long enough to be a sentence or three.
 *
 * Deliberately not `Trust` (whose items are short enough to read as a strip)
 * and not `Cards` (which boxes each item and so implies they are parallel
 * features rather than parts of one argument). The marker is a token so a
 * host can change it; each item's content is wrapped in a single `span`
 * because the row is a two-column grid — marker, then content — and an
 * unwrapped lead-in would land in the grid as a second item of its own.
 *
 * `ordered` swaps the element for `ol` and the marker for the item's own
 * number. It is an element change and not a class-only one: the sequence is
 * the claim ("first this, then that"), and only `ol` says so to a screen
 * reader, which announces "list item 3 of 7" where a `ul` announces a bullet.
 * The digits come from a CSS counter rather than from the content, so a
 * re-ordered source can never disagree with the numbers on screen.
 */
export function Points({
  entries,
  ordered = false,
}: {
  entries: PointEntry[]
  ordered?: boolean
}): ReactElement {
  const items = entries.map((entry, i) => (
    <li key={i}>
      <span>
        {entry.term === undefined ? null : <b>{entry.term}</b>}
        {entry.term === undefined ? null : ' '}
        {entry.detail}
      </span>
    </li>
  ))
  return ordered ? (
    <ol className="lp-points lp-points--ordered">{items}</ol>
  ) : (
    <ul className="lp-points">{items}</ul>
  )
}
