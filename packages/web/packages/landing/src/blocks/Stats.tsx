import type { ReactElement, ReactNode } from 'react'

/** One cell of a `Stats` strip: the number (`term`) and its caption (`detail`). */
export interface StatEntry {
  term: ReactNode
  detail: ReactNode
}

/**
 * A strip of numbers meant to be scanned in one horizontal sweep. Each entry
 * is wrapped in its own `div` — that wrapper, not the `dl`, is what the grid
 * in `css/blocks.css` lays out three across (see the comment there for why
 * the column count is declared rather than derived).
 */
export function Stats({ entries }: { entries: StatEntry[] }): ReactElement {
  return (
    <dl className="lp-stats">
      {entries.map((entry, i) => (
        <div key={i}>
          <dt>{entry.term}</dt>
          <dd>{entry.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
