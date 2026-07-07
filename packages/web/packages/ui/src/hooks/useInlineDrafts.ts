'use client'

import { useCallback, useRef, useState } from 'react'

// The state mechanics behind InlineCommitControl consumers: per-row pending
// state (a PATCH of touched fields, or an armed delete), per-row in-flight
// commits, and per-row errors. The data itself stays in the consumer (the
// control's documented contract) — this hook only owns the fiddly ceremony
// every adopter was copy-pasting.
//
// Design notes, each closing a real defect class:
// - Drafts are PATCHES (only touched fields), so committing never sends —
//   and can never clobber — fields this user didn't edit, even after a
//   background refetch pulls in someone else's change.
// - `settle` (run after a successful commit) drops only patch keys whose
//   value still equals what was committed, so keystrokes typed while the
//   request was in flight survive as a still-dirty draft.
// - `runCommit` is a per-row gate: re-entry for a row already in flight is a
//   no-op (covers double-Enter and cross-row busy races), and failures land
//   in that row's error slot without touching other rows.

/** A row's pending state: a patch of touched fields, or an armed delete. */
export type InlineDraft<Draft> = Partial<Draft> | 'delete'

export interface InlineDraftsApi<Id extends string | number, Draft extends object> {
  /** The row as the editor should render it: base overlaid with the patch. */
  draftOf: (id: Id, base: Draft) => Draft
  /** Any touched field currently differs from the base row. */
  isDirty: (id: Id, base: Draft) => boolean
  /** The touched fields that differ from base — the commit payload. */
  changesOf: (id: Id, base: Draft) => Partial<Draft>
  /** Merge edited fields into the row's patch (ignored while armed). */
  edit: (id: Id, patch: Partial<Draft>) => void
  /** Drop the row's pending state and error (the ✕ action). */
  clear: (id: Id) => void
  /** Delete is armed for the row. */
  isArmed: (id: Id) => boolean
  /** Arm the pending delete (replacing any patch) or disarm it. */
  toggleArmed: (id: Id) => void
  /** A commit for the row is in flight. */
  isBusy: (id: Id) => boolean
  /** The row's last commit failure, if any. */
  errorOf: (id: Id) => string | null
  /** All current row errors (render however the page prefers). */
  errors: ReadonlyArray<{ id: Id; message: string }>
  /**
   * Run one commit for the row: no-op if one is already in flight; on failure
   * stores the row's error (via `describeError`) and keeps the pending state
   * for retry. Returns whether the commit succeeded.
   */
  runCommit: (id: Id, fn: () => Promise<void>) => Promise<boolean>
  /**
   * After a successful field commit: drop patch keys whose value still equals
   * what was committed, keeping any newer in-flight edits as a live draft.
   */
  settle: (id: Id, committed: Partial<Draft>) => void
}

export function useInlineDrafts<Id extends string | number, Draft extends object>(
  /** Turns a commit failure into the row's error message. */
  describeError: (err: unknown) => string,
): InlineDraftsApi<Id, Draft> {
  const [pending, setPending] = useState<ReadonlyMap<Id, InlineDraft<Draft>>>(new Map())
  const [inFlight, setInFlight] = useState<ReadonlySet<Id>>(new Set())
  const [errorMap, setErrorMap] = useState<ReadonlyMap<Id, string>>(new Map())
  const describeRef = useRef(describeError)
  describeRef.current = describeError

  const patchOf = useCallback(
    (id: Id): Partial<Draft> => {
      const entry = pending.get(id)
      return entry == null || entry === 'delete' ? {} : entry
    },
    [pending],
  )

  const draftOf = useCallback(
    (id: Id, base: Draft): Draft => ({ ...base, ...patchOf(id) }),
    [patchOf],
  )

  const changesOf = useCallback(
    (id: Id, base: Draft): Partial<Draft> => {
      const patch = patchOf(id)
      const changes: Partial<Draft> = {}
      for (const key of Object.keys(patch) as (keyof Draft)[]) {
        if (patch[key] !== base[key]) changes[key] = patch[key]
      }
      return changes
    },
    [patchOf],
  )

  const isDirty = useCallback(
    (id: Id, base: Draft): boolean => Object.keys(changesOf(id, base)).length > 0,
    [changesOf],
  )

  const edit = useCallback((id: Id, patch: Partial<Draft>): void => {
    setPending((prev) => {
      const entry = prev.get(id)
      if (entry === 'delete') return prev
      const next = new Map(prev)
      next.set(id, { ...(entry ?? {}), ...patch })
      return next
    })
  }, [])

  const clearError = useCallback((id: Id): void => {
    setErrorMap((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const clear = useCallback(
    (id: Id): void => {
      setPending((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      clearError(id)
    },
    [clearError],
  )

  const isArmed = useCallback((id: Id): boolean => pending.get(id) === 'delete', [pending])

  const toggleArmed = useCallback((id: Id): void => {
    setPending((prev) => {
      const next = new Map(prev)
      if (prev.get(id) === 'delete') next.delete(id)
      else next.set(id, 'delete')
      return next
    })
  }, [])

  const isBusy = useCallback((id: Id): boolean => inFlight.has(id), [inFlight])

  const errorOf = useCallback((id: Id): string | null => errorMap.get(id) ?? null, [errorMap])

  const errors = Array.from(errorMap, ([id, message]) => ({ id, message }))

  const inFlightRef = useRef(inFlight)
  inFlightRef.current = inFlight

  const runCommit = useCallback(
    async (id: Id, fn: () => Promise<void>): Promise<boolean> => {
      if (inFlightRef.current.has(id)) return false
      setInFlight((prev) => new Set(prev).add(id))
      clearError(id)
      try {
        await fn()
        return true
      } catch (err) {
        setErrorMap((prev) => new Map(prev).set(id, describeRef.current(err)))
        return false
      } finally {
        setInFlight((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [clearError],
  )

  const settle = useCallback((id: Id, committed: Partial<Draft>): void => {
    setPending((prev) => {
      const entry = prev.get(id)
      if (entry == null || entry === 'delete') return prev
      const remaining: Partial<Draft> = {}
      for (const key of Object.keys(entry) as (keyof Draft)[]) {
        const wasCommitted = key in committed && committed[key] === entry[key]
        if (!wasCommitted) remaining[key] = entry[key]
      }
      const next = new Map(prev)
      if (Object.keys(remaining).length === 0) next.delete(id)
      else next.set(id, remaining)
      return next
    })
  }, [])

  return {
    draftOf,
    isDirty,
    changesOf,
    edit,
    clear,
    isArmed,
    toggleArmed,
    isBusy,
    errorOf,
    errors,
    runCommit,
    settle,
  }
}
