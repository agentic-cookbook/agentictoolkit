import type { ReactElement, ReactNode } from 'react'

/**
 * A table of records: the header labels, the rows under them, and a caption.
 *
 * `caption` is required, and it is not decoration — it is the only thing that
 * says what the rows are a sample OF. A table showing three of ten runs
 * without saying so is a different claim from the same table with the caption,
 * and the caption is the honest one. It renders visually hidden by default so
 * the claim reaches a screen reader whether or not the surrounding prose
 * repeats it; `showCaption` puts it on the page.
 *
 * Every row must be the same width as `columns`. A short row would silently
 * shift every cell after it into the wrong column — the kind of defect that
 * reads as a typo in the content rather than as a bug.
 */
export function Table({
  caption,
  showCaption,
  columns,
  rows,
}: {
  caption: ReactNode
  showCaption?: boolean
  columns: ReactNode[]
  rows: ReactNode[][]
}): ReactElement {
  const bad = rows.find((row) => row.length !== columns.length)
  if (bad !== undefined) {
    throw new Error(
      `Table: row ${rows.indexOf(bad)} has ${bad.length} cells but there are ` +
        `${columns.length} columns`,
    )
  }
  return (
    <div className="lp-table-scroll">
      <table className="lp-table">
        <caption className={showCaption === true ? undefined : 'lp-sr-only'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
