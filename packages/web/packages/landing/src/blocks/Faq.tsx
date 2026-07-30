import type { ReactElement, ReactNode } from 'react'

/** One question in a `Faq`: the question, its answer, and whether it starts open. */
export interface FaqEntry {
  question: ReactNode
  answer: ReactNode
  /** Starts expanded. Normally exactly one entry carries this — an accordion
   * where every row is shut reads as a list of links rather than answers. */
  open?: boolean
}

/**
 * The objections, answered — built from `<details>`/`<summary>` rather than a
 * scripted accordion, so it opens and closes with no JavaScript at all, stays
 * open when printed, and is searchable by the browser's own find. Do not
 * replace it with state.
 */
export function Faq({ entries }: { entries: FaqEntry[] }): ReactElement {
  return (
    <div className="lp-faq">
      {entries.map((entry, i) => (
        <details key={i} open={entry.open === true}>
          <summary>{entry.question}</summary>
          {entry.answer}
        </details>
      ))}
    </div>
  )
}
