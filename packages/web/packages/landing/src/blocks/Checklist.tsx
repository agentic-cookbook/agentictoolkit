import type { ReactElement, ReactNode } from 'react'

/** One line in a `Checklist` column.
 *
 * `soon` marks a line the reader cannot rely on yet — still on a branch, or
 * landed with nothing shipped that uses it. It carries a different mark rather
 * than being left out: a checklist that silently omits what is coming is as
 * misleading as one that ticks it, and a caveat in the prose beside a ticked
 * line is not read by the skimmer the marks are for. The distinction has to be
 * structural, which is why it is a field here and not a phrase in `text`. */
export interface ChecklistItem {
  text: ReactNode
  soon?: boolean
}

/** One column of a `Checklist`: a heading and the lines under it.
 *
 * `items` may be empty, and then no `<ul>` is rendered at all — an empty list
 * element is invisible on screen while still carrying `.lp-checklist ul`'s
 * spacing, so it reads as a layout bug rather than as missing content. The
 * generator refuses a group with nothing under it before it ever gets here
 * (that is incomplete content, and an error says so); this guard is what
 * keeps the markup honest for any other caller. */
export interface ChecklistGroup {
  heading: ReactNode
  items: ChecklistItem[]
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
          {group.items.length > 0 && (
            <ul>
              {group.items.map((item, j) => (
                <li key={j} className={item.soon ? 'lp-checklist__item--soon' : undefined}>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
