import type { ReactElement } from "react"
import type { AdminNote, HistoryEntry } from "../lib/invitations-types"

/**
 * Presentational detail-panel section — renders the admin notes and history for
 * a subject. Prop-driven: the caller fetches the data (react-query lives in the
 * app, never here) and threads it in. Notes and history load independently, so
 * each section has its own loading flag — a slow history fetch never withholds
 * already-loaded notes.
 */
export function NotesAndHistory({
  notes,
  history,
  notesLoading,
  historyLoading,
}: {
  notes: AdminNote[]
  history: HistoryEntry[]
  notesLoading?: boolean
  historyLoading?: boolean
}): ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-apt-text-muted">Admin notes</h4>
        {notesLoading ? (
          <p className="mt-1 text-sm text-apt-text-dim">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="mt-1 text-sm text-apt-text-dim">No admin notes.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-apt-border bg-apt-surface-2/40 p-2 text-sm text-apt-text">
                <div>{n.content}</div>
                <div className="mt-1 text-xs text-apt-text-muted">{n.author} · {n.modifiedDate}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-apt-text-muted">History</h4>
        {historyLoading ? (
          <p className="mt-1 text-sm text-apt-text-dim">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-1 text-sm text-apt-text-dim">No history.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {history.map((h) => (
              <li key={h.id} className="text-sm text-apt-text">
                <span className="text-apt-text-muted">{h.timestamp}</span> — {h.actor} {h.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
