import type { ReactElement, ReactNode } from 'react'

/** One column of a `Checklist`: a heading and the ticked lines under it. */
export interface ChecklistGroup {
  heading: ReactNode
  items: ReactNode[]
}

/**
 * The long tail: everything the app does that didn't earn a section of its
 * own. Columns of ticked lines, grouped under quiet headings — dense on
 * purpose, since this is the section a reader scans to find the one thing
 * they came for. See the column-count comment in `css/blocks.css` for why
 * three across is declared rather than derived.
 */
export function Checklist({ groups }: { groups: ChecklistGroup[] }): ReactElement {
  return (
    <div className="lp-checklist">
      {groups.map((group, i) => (
        <div key={i}>
          <h3>{group.heading}</h3>
          <ul>
            {group.items.map((item, j) => (
              <li key={j}>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
