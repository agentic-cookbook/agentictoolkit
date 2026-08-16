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
 * A value this hook is willing to compare structurally: an object literal, not a `Date`, `Map`,
 * `RegExp` or class instance. Those carry state their own keys do not describe, so walking their
 * enumerable properties would call two different values equal; identity is the honest answer for
 * them and `Object.is` above has already given it.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v) as unknown
  return proto === Object.prototype || proto === null
}

/**
 * Field equality for dirty-checking. `Object.is` for scalars; arrays and object literals compare
 * by CONTENT so a structured field does not read as dirty merely because the setter handed back a
 * fresh value. Without this, every editor with a list or object field would light Save up
 * permanently and the flag would mean nothing.
 *
 * The object case is not symmetry for its own sake. A facet that hands its whole config back per
 * keystroke — `chatStatus` and `cannedChat` both do — produces a new object every time, so with
 * only the array case an editor latched `dirty` on the first render and never let go: Save stayed
 * lit with nothing to save, and the exit guard blocked navigation away from an untouched persona.
 * Any future field whose value is a config object gets the same treatment for free, which is the
 * point of fixing it here rather than at either call site.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  }
  // Array-vs-object must not fall through to the key walk: `[]` and `{}` both have zero keys.
  if (Array.isArray(a) || Array.isArray(b)) return false
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return (
      ka.length === kb.length &&
      ka.every(
        (k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]),
      )
    )
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

  // Same short-circuit `set` applies, for the same reason and by the same rule: a mutator handed
  // the values already in the draft must be a no-op, not a re-render. `patch` is the one callers
  // reach for when a child component hands back a whole fresh object per keystroke
  // (`ServicesSection`'s `patch(next)`), which is exactly when an unconditional setState costs the
  // most — and two sibling mutators that behave differently on identical input is a caller trap.
  const patch = useCallback((values: Partial<T>) => {
    setState((s) => {
      const keys = Object.keys(values) as (keyof T)[]
      if (keys.every((k) => sameValue(s.draft[k], values[k]))) return s
      return { ...s, draft: { ...s.draft, ...values } }
    })
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
    // The UNION of both key sets, not just the draft's. `patch(Partial<T>)` widens the draft and
    // `commit(next?: T)` can narrow the baseline, so the two sets are not guaranteed equal. Only
    // draft ⊇ baseline is reachable through today's API (nothing deletes a draft key), and
    // iterating the draft alone happens to cover that — but the flag's meaning must not rest on an
    // invariant no type enforces: a baseline key missing from the draft would otherwise be
    // invisible, so dropping a field would read as "nothing changed" and Save would stay dead.
    const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]) as Set<keyof T>
    return [...keys].some((k) => !sameValue(draft[k], baseline[k]))
  }, [state])

  return { draft: state.draft, set, patch, dirty, commit, reset, baseline: state.baseline }
}
