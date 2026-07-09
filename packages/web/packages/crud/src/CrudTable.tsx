'use client'

import { Button } from '@agentic-toolkit/ui/components/button'
import { Spinner } from '@agentic-toolkit/ui/components/spinner'
import { ErrorText } from '@agentic-toolkit/ui/components/error-text'
import { rowKey } from './useCrudResource'
import type { CrudColumn, CrudRow, CrudTableMeta } from './types'
import { cn } from '@agentic-toolkit/ui/lib/utils'
import { fieldCaptionClass } from '@agentic-toolkit/ui/lib/typography'

const MAX_COLUMNS = 6
const MAX_CELL_CHARS = 80

/** The columns shown in the list: primary key(s) first, then the remaining
 *  scalar columns up to the cap. Object/array columns are form-only. */
export function displayColumns(meta: CrudTableMeta): CrudColumn[] {
  const pk = meta.columns.filter((c) => meta.pkParams.includes(c.name))
  const scalars = meta.columns.filter(
    (c) => !meta.pkParams.includes(c.name) && c.type !== 'object' && c.type !== 'array',
  )
  return [...pk, ...scalars].slice(0, MAX_COLUMNS)
}

export function cellText(row: CrudRow, column: CrudColumn): string {
  const value = row[column.name]
  if (value == null) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text
}

export interface CrudTableProps {
  meta: CrudTableMeta
  rows: CrudRow[]
  loading: boolean
  error: string | null
  onNew: () => void
  onEdit: (row: CrudRow) => void
  onDelete: (row: CrudRow) => void
}

/** Placeholder-grade row list for one table: no sorting/search/pagination (the
 *  backend caps lists at 500); per-row Edit/Delete and a New action. */
export function CrudTable({ meta, rows, loading, error, onNew, onEdit, onDelete }: CrudTableProps) {
  const columns = displayColumns(meta)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.7rem] text-apt-text-dim">
          {loading ? 'Loading…' : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </span>
        <Button size="sm" onClick={onNew}>
          New
        </Button>
      </div>
      <ErrorText error={error} />
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : rows.length === 0 && !error ? (
        <p className="py-8 text-center font-mono text-sm text-apt-text-dim">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-apt-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-apt-border">
                {columns.map((column) => (
                  <th
                    key={column.name}
                    className={cn(fieldCaptionClass, "px-3 py-2 font-medium")}
                  >
                    {column.name}
                  </th>
                ))}
                <th className="px-3 py-2" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={rowKey(meta, row) || index}
                  className="border-b border-apt-border/50 last:border-b-0"
                >
                  {columns.map((column) => (
                    <td key={column.name} className="px-3 py-2 text-apt-text">
                      {cellText(row, column)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
