'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { authedJson, authedRequest } from '@agentic-toolkit/auth/client'
import { errorMessage } from '@agentic-toolkit/ui/lib/errors'
import type { CrudRow, CrudTableMeta } from './types'

/** Every site mounts its BFF proxy at /api (stripped on forward). */
const API_BASE = '/api'

/** Substitute a row's primary-key values into the table's item path template,
 *  e.g. '/persona-memory/links/{srcId}/{dstId}/{relation}' + the row. */
export function itemUrl(meta: CrudTableMeta, row: CrudRow): string {
  let path = meta.itemPath
  for (const param of meta.pkParams) {
    path = path.replace(`{${param}}`, encodeURIComponent(String(row[param] ?? '')))
  }
  return `${API_BASE}${path}`
}

/** A row's primary key as one string — the same per-part escaping as itemUrl,
 *  so a '/' inside a composite-key value can't collide with the separator.
 *  Empty ('') when a single-pk row carries no value. */
export function rowKey(meta: CrudTableMeta, row: CrudRow): string {
  return meta.pkParams.map((param) => encodeURIComponent(String(row[param] ?? ''))).join('/')
}

export interface CrudResource {
  rows: CrudRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Mutations throw on failure (the caller renders the message inline) and
   *  re-list on success. */
  create: (values: CrudRow) => Promise<void>
  update: (row: CrudRow, values: CrudRow) => Promise<void>
  remove: (row: CrudRow) => Promise<void>
  /** Raw mutators — the same authed PUT/POST/DELETE as create/update/remove but
   *  WITHOUT the trailing re-list, so a batch save (the split editor) can issue
   *  many writes and refresh ONCE at the end. Throw on failure like their
   *  re-listing wrappers. */
  createRow: (values: CrudRow) => Promise<CrudRow>
  updateRow: (row: CrudRow, values: CrudRow) => Promise<CrudRow>
  removeRow: (row: CrudRow) => Promise<void>
}

/** List/create/update/delete one generic-CRUD table through the site's /api
 *  BFF proxy, authenticated by the shared Bearer client. `filter` narrows the LIST
 *  call only (column-equality query params the backend list route ANDs with the
 *  ecosystem scope); mutations are unaffected. `scopeEcosystemId` names the target
 *  ecosystem on EVERY verb (`?ecosystemId=` — the backend's ecosystem-param scope
 *  override for the integration synced-data tables, authorized server-side against
 *  the ecosystems the caller manages); without it the backend scopes to the caller's
 *  JWT ecosystem. `error` reflects the list call only; mutation errors are thrown to
 *  the caller. */
export function useCrudResource(
  meta: CrudTableMeta,
  filter?: Record<string, string>,
  scopeEcosystemId?: string,
): CrudResource {
  const [rows, setRows] = useState<CrudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The scope override rides every verb's URL; empty string means "no override".
  const scopeQuery = scopeEcosystemId ? `ecosystemId=${encodeURIComponent(scopeEcosystemId)}` : ''
  // Serialized once so an inline `filter={{…}}` literal doesn't change identity
  // every render and re-trigger the list effect.
  const filterQuery =
    filter && Object.keys(filter).length > 0 ? new URLSearchParams(filter).toString() : ''
  const listQuery = [scopeQuery, filterQuery].filter(Boolean).join('&')
  // Guards against out-of-order responses: switching tables (a new `meta` on a
  // live hook) starts a new list call while the old one may still be in
  // flight — only the LATEST call may write state, or a slow stale response
  // would overwrite the new table's rows.
  const listSeq = useRef(0)
  // `loading` blocks the UI (the table swaps to a spinner), so only signal it
  // before anything has loaded this mount — post-mutation re-lists keep the
  // current rows rendered instead of flashing. A failed background refresh
  // shows the error next to the stale rows, which is accepted.
  const hasLoadedRef = useRef(false)

  const refresh = useCallback(async () => {
    const seq = ++listSeq.current
    if (!hasLoadedRef.current) setLoading(true)
    setError(null)
    try {
      const fetched = await authedJson<CrudRow[]>(
        `${API_BASE}${meta.basePath}${listQuery ? `?${listQuery}` : ''}`,
      )
      if (seq !== listSeq.current) return
      hasLoadedRef.current = true
      setRows(fetched)
    } catch (err) {
      if (seq !== listSeq.current) return
      setError(errorMessage(err))
    } finally {
      if (seq === listSeq.current) setLoading(false)
    }
  }, [meta, listQuery])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Raw mutators (no re-list) — the single home for the authed POST/PUT/DELETE
  // shape, reused by both the re-listing wrappers below and the split editor's
  // batch save (which refreshes once after all writes).
  const createRow = useCallback(
    (values: CrudRow) =>
      authedJson<CrudRow>(`${API_BASE}${meta.basePath}${scopeQuery ? `?${scopeQuery}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }),
    [meta, scopeQuery],
  )

  const updateRow = useCallback(
    (row: CrudRow, values: CrudRow) =>
      authedJson<CrudRow>(`${itemUrl(meta, row)}${scopeQuery ? `?${scopeQuery}` : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }),
    [meta, scopeQuery],
  )

  const removeRow = useCallback(
    // DELETE answers 204 No Content — authedRequest, not authedJson.
    async (row: CrudRow) => {
      await authedRequest(`${itemUrl(meta, row)}${scopeQuery ? `?${scopeQuery}` : ''}`, {
        method: 'DELETE',
      })
    },
    [meta, scopeQuery],
  )

  const create = useCallback(
    async (values: CrudRow) => {
      await createRow(values)
      await refresh()
    },
    [createRow, refresh],
  )

  const update = useCallback(
    async (row: CrudRow, values: CrudRow) => {
      await updateRow(row, values)
      await refresh()
    },
    [updateRow, refresh],
  )

  const remove = useCallback(
    async (row: CrudRow) => {
      await removeRow(row)
      await refresh()
    },
    [removeRow, refresh],
  )

  return { rows, loading, error, refresh, create, update, remove, createRow, updateRow, removeRow }
}
