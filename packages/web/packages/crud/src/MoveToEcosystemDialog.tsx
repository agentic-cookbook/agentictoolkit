'use client'

import { useEffect, useState } from 'react'
import { AlertModal } from '@agentic-toolkit/ui/components/alert-modal'
import { Select } from '@agentic-toolkit/ui/components/select'
import { authedJson } from '@agentic-toolkit/auth/client'
import { errorMessage } from '@agentic-toolkit/ui/lib/errors'
import { ErrorText } from '@agentic-toolkit/ui/components/error-text'
import type { CrudTableMeta } from './types'

/** Minimal shape of GET /api/ecosystem/ecosystems — the manageable set the admin can move into. */
interface EcoOption {
  id: string
  name: string
  isDefault?: boolean
}
interface MoveResult {
  moved: Record<string, number>
}

/**
 * Confirm-and-move dialog for the All-Data browser's "Move to ecosystem…" action. Picks a
 * destination ecosystem, optionally previews what moves (the backend's `dryRun`, which for
 * aggregate roots like a persona reports its child rows too), then relocates every selected row
 * via POST /api/ecosystem/move. Admin-only server-side; the caller gates the action's visibility.
 */
export function MoveToEcosystemDialog({
  meta,
  rowIds,
  open,
  onClose,
  onMoved,
}: {
  meta: CrudTableMeta
  /** The raw primary-key values of the selected rows (a uuid, or an rdid for rdid tables). */
  rowIds: string[]
  open: boolean
  onClose: () => void
  /** Called after a successful move so the list can clear its selection and re-list. */
  onMoved: () => void
}) {
  const [ecosystems, setEcosystems] = useState<EcoOption[]>([])
  const [target, setTarget] = useState('')
  const [preview, setPreview] = useState<Record<string, number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fresh state + a fetch of the destination options each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setTarget('')
    setPreview(null)
    setError(null)
    let live = true
    authedJson<EcoOption[]>('/api/ecosystem/ecosystems')
      .then((rows) => {
        if (live) setEcosystems(rows)
      })
      .catch((e) => {
        if (live) setError(errorMessage(e))
      })
    return () => {
      live = false
    }
  }, [open])

  /** Move (or dry-run) every selected row, summing the per-table counts across the batch. */
  async function run(dryRun: boolean): Promise<Record<string, number>> {
    const total: Record<string, number> = {}
    for (const id of rowIds) {
      const res = await authedJson<MoveResult>('/api/ecosystem/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: meta.schema, table: meta.table, id, target, dryRun }),
      })
      for (const [k, v] of Object.entries(res.moved)) total[k] = (total[k] ?? 0) + v
    }
    return total
  }

  async function onPreview() {
    if (!target) {
      setError('Choose a destination ecosystem first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setPreview(await run(true))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function onConfirm() {
    if (!target) {
      setError('Choose a destination ecosystem first.')
      return
    }
    setBusy(true)
    setError(null)
    run(false)
      .then(() => onClose())
      .catch((e) => setError(errorMessage(e)))
      .finally(() => {
        // Re-list + clear the selection even on a PARTIAL failure (row K threw after rows 1..K-1
        // already committed server-side): the moved rows leave the list, so a retry can't re-POST
        // them (which could 404 and wedge the batch). On the error path the dialog stays open with
        // the message; the user re-selects whatever remains.
        onMoved()
        setBusy(false)
      })
  }

  const count = rowIds.length
  const description = (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
          Destination ecosystem
        </span>
        <Select
          value={target}
          disabled={busy}
          onChange={(e) => {
            setTarget(e.target.value)
            setPreview(null)
          }}
        >
          <option value="">Select an ecosystem…</option>
          {ecosystems.map((eco) => (
            <option key={eco.id} value={eco.id}>
              {eco.name}
              {eco.isDefault ? ' (default)' : ''} — {eco.id}
            </option>
          ))}
        </Select>
      </label>
      <button
        type="button"
        onClick={() => void onPreview()}
        disabled={!target || busy}
        className="self-start font-mono text-xs text-apt-gold underline underline-offset-2 disabled:opacity-50"
      >
        Preview what moves
      </button>
      {preview && (
        <p className="font-mono text-xs text-apt-text-dim">
          Will move:{' '}
          {Object.entries(preview)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ')}
        </p>
      )}
      <ErrorText error={error} />
    </div>
  )

  return (
    <AlertModal
      open={open}
      title={`Move ${count} ${meta.table} row${count === 1 ? '' : 's'} to another ecosystem`}
      description={description}
      confirmLabel="Move"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onClose}
      busy={busy}
    />
  )
}
