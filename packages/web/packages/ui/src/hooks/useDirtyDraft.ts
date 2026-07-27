'use client'

import { useCallback, useMemo, useState } from 'react'

export interface DirtyDraft<T extends object> {
  draft: T
  set: <K extends keyof T>(key: K, value: T[K]) => void
  patch: (values: Partial<T>) => void
  /** True when at least one key differs from the baseline. */
  dirty: boolean
  /** Adopt `next` as the new baseline and clear `dirty` (call after a successful save). */
  commit: (next?: T) => void
  /** Throw the edits away and return to the baseline. */
  reset: () => void
  /**
   * The "what was loaded" snapshot `dirty` compares `draft` against — read-only, moved only by
   * `commit`. A consumer that must diff `draft` against the ORIGINAL loaded values itself (e.g. to
   * build a minimal PATCH body) reads this instead of keeping its own parallel copy of the prop it
   * was seeded from: after `commit(saved)` this is the server's row while a caller's own copy of the
   * original prop would still be the stale pre-save one, and the two would disagree exactly when it
   * matters.
   */
  baseline: T
}

/**
 * Field equality for dirty-checking. `Object.is` for scalars; arrays compare by CONTENT so a
 * multi-value field (examples, tags, model lists) does not read as dirty merely because the
 * setter handed back a fresh array. Without this, every editor with a list field would light
 * Save up permanently and the flag would mean nothing.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  }
  return false
}

/**
 * Draft state plus the DIRTY flag every editor's Save button needs.
 *
 * Editors previously kept a bare `useState` draft and gated Save on validity alone, which made
 * the button say the wrong thing in both directions: lit before the user touched anything, and —
 * when a required field on some other tab happened to be blank — permanently grey no matter what
 * they edited. Dirty is the missing half of `canSave = dirty && valid`.
 *
 * The in-flight/`saving` term is deliberately NOT part of that: `canSave` is a statement about the
 * DRAFT alone ("is there something worth saving, and is it savable?"), so it stays meaningful to
 * anything that reads it — a blocked-reason message, an exit guard, a test. Whether a save is
 * already running is a property of the request, not the draft, and belongs at the button
 * (`disabled={!canSave || saving}`). Two consumers apply it for you and must not be doubled up on:
 * `SaveCancelButtons` (`ui/src/blocks/button-bar.tsx`) and `DialogActions`, which hides its whole
 * action row while `busy`.
 *
 * Draft and baseline live in ONE state object rather than draft-in-state plus baseline-in-a-ref:
 * `commit()` must produce a genuinely new state value or React bails out of the update (same
 * object reference in, same one out), `dirty`'s memo never recomputes, and the flag stays stuck
 * `true` right after a successful save. Keeping both halves in one `setState` call means `commit`
 * always hands back a fresh object, so the bail-out can't happen.
 */
export function useDirtyDraft<T extends object>(initial: T | (() => T)): DirtyDraft<T> {
  const [state, setState] = useState<{ draft: T; baseline: T }>(() => {
    const init = typeof initial === 'function' ? (initial as () => T)() : initial
    return { draft: init, baseline: init }
  })

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((s) =>
      sameValue(s.draft[key], value) ? s : { ...s, draft: { ...s.draft, [key]: value } },
    )
  }, [])

  const patch = useCallback((values: Partial<T>) => {
    setState((s) => ({ ...s, draft: { ...s.draft, ...values } }))
  }, [])

  const commit = useCallback((next?: T) => {
    setState((s) => {
      const adopted = next ?? s.draft
      return { draft: adopted, baseline: adopted }
    })
  }, [])

  const reset = useCallback(() => {
    setState((s) => ({ ...s, draft: s.baseline }))
  }, [])

  const dirty = useMemo(() => {
    const { draft, baseline } = state
    return (Object.keys(draft) as (keyof T)[]).some((k) => !sameValue(draft[k], baseline[k]))
  }, [state])

  return { draft: state.draft, set, patch, dirty, commit, reset, baseline: state.baseline }
}
