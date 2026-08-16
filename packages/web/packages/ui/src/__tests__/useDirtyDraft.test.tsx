import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"

import { useDirtyDraft } from "../hooks/useDirtyDraft"

describe("useDirtyDraft", () => {
  it("starts clean", () => {
    const { result } = renderHook(() => useDirtyDraft({ name: "a", tags: ["x"] }))
    expect(result.current.dirty).toBe(false)
  })

  it("goes dirty on a changed value and clean again when reverted", () => {
    const { result } = renderHook(() => useDirtyDraft({ name: "a" }))
    act(() => result.current.set("name", "b"))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.set("name", "a"))
    expect(result.current.dirty).toBe(false)
  })

  it("stays clean when set writes the SAME value", () => {
    const { result } = renderHook(() => useDirtyDraft({ visibility: "private" }))
    act(() => result.current.set("visibility", "private"))
    expect(result.current.dirty).toBe(false)
  })

  it("compares arrays by content, not identity", () => {
    const { result } = renderHook(() => useDirtyDraft({ tags: ["x", "y"] }))
    act(() => result.current.set("tags", ["x", "y"]))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.set("tags", ["x", "z"]))
    expect(result.current.dirty).toBe(true)
  })

  // A facet that hands its whole config back per keystroke (chatStatus, cannedChat) emits a fresh
  // object every time. Without content comparison the editor latched `dirty` on the first render:
  // Save stayed lit with nothing to save, and the exit guard blocked leaving an untouched persona.
  it("compares object literals by content, not identity", () => {
    const { result } = renderHook(() =>
      useDirtyDraft({ chatStatus: { words: [{ tags: ["think"], present: "p", past: "q" }] } }),
    )
    act(() =>
      result.current.set("chatStatus", {
        words: [{ tags: ["think"], present: "p", past: "q" }],
      }),
    )
    expect(result.current.dirty).toBe(false)
    act(() =>
      result.current.set("chatStatus", {
        words: [{ tags: ["think"], present: "p", past: "CHANGED" }],
      }),
    )
    expect(result.current.dirty).toBe(true)
  })

  it("treats a missing key and an extra key as a change", () => {
    const { result } = renderHook(() => useDirtyDraft<{ cfg: Record<string, unknown> }>({
      cfg: { a: 1 },
    }))
    act(() => result.current.set("cfg", { a: 1, b: 2 }))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.set("cfg", { b: 1 }))
    expect(result.current.dirty).toBe(true)
  })

  // `[]` and `{}` both walk to zero keys, so the array case has to be settled before the object
  // one or an empty list would read as equal to an empty config.
  it("never calls an empty array equal to an empty object", () => {
    const { result } = renderHook(() => useDirtyDraft<{ v: unknown }>({ v: [] }))
    act(() => result.current.set("v", {}))
    expect(result.current.dirty).toBe(true)
  })

  // A Date's identity is its only honest comparison here: two Dates with different instants have
  // the same (zero) enumerable keys, so a structural walk would call them equal.
  it("does not structurally compare non-plain objects", () => {
    const { result } = renderHook(() => useDirtyDraft({ at: new Date(0) }))
    act(() => result.current.set("at", new Date(5000)))
    expect(result.current.dirty).toBe(true)
  })

  it("patch applies several keys at once", () => {
    const { result } = renderHook(() => useDirtyDraft({ a: 1, b: 2 }))
    act(() => result.current.patch({ a: 9, b: 8 }))
    expect(result.current.draft).toEqual({ a: 9, b: 8 })
    expect(result.current.dirty).toBe(true)
  })

  // `patch` is the mutator child components call with a whole fresh object per change
  // (ServicesSection), so an unconditional setState re-renders the editor on every keystroke that
  // changed nothing. It has to short-circuit exactly like `set` — sibling mutators disagreeing on
  // identical input is a caller trap.
  it("patch returns the SAME state object when every value is unchanged", () => {
    const { result } = renderHook(() => useDirtyDraft({ a: 1, tags: ["x"] }))
    const before = result.current.draft
    // Fresh object, fresh array — identity differs, content doesn't.
    act(() => result.current.patch({ a: 1, tags: ["x"] }))
    expect(result.current.draft).toBe(before)
    expect(result.current.dirty).toBe(false)
  })

  it("patch still applies when only SOME of the values are unchanged", () => {
    const { result } = renderHook(() => useDirtyDraft({ a: 1, b: 2 }))
    act(() => result.current.patch({ a: 1, b: 3 }))
    expect(result.current.draft).toEqual({ a: 1, b: 3 })
    expect(result.current.dirty).toBe(true)
  })

  // `commit(next)` can narrow the key set; a following `patch` widens the DRAFT past the baseline.
  // (The mirror image — a baseline key the draft has lost — is what `dirty`'s union iteration
  // guards, and is deliberately not asserted here: no sequence of set/patch/commit/reset can
  // produce it, so a test for it could not fail. See the comment on `dirty`.)
  it("sees a key the draft has gained since the baseline was committed", () => {
    const { result } = renderHook(() => useDirtyDraft<{ a: number; b?: number }>({ a: 1, b: 2 }))
    act(() => result.current.commit({ a: 1 }))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.patch({ b: 5 }))
    expect(result.current.dirty).toBe(true)
  })

  it("commit adopts the saved row as the new baseline", () => {
    const { result } = renderHook(() => useDirtyDraft({ name: "a" }))
    act(() => result.current.set("name", "b"))
    act(() => result.current.commit())
    expect(result.current.dirty).toBe(false)
    expect(result.current.draft).toEqual({ name: "b" })
  })

  it("commit(next) adopts a server-normalised row", () => {
    const { result } = renderHook(() => useDirtyDraft({ slug: "a" }))
    act(() => result.current.set("slug", "B"))
    act(() => result.current.commit({ slug: "b" }))
    expect(result.current.draft).toEqual({ slug: "b" })
    expect(result.current.dirty).toBe(false)
  })

  it("reset restores the baseline", () => {
    const { result } = renderHook(() => useDirtyDraft({ name: "a" }))
    act(() => result.current.set("name", "b"))
    act(() => result.current.reset())
    expect(result.current.draft).toEqual({ name: "a" })
    expect(result.current.dirty).toBe(false)
  })

  it("exposes baseline: starts at the initial value, unmoved by set/patch, and moves on commit", () => {
    const { result } = renderHook(() => useDirtyDraft({ name: "a", tags: ["x"] }))
    expect(result.current.baseline).toEqual({ name: "a", tags: ["x"] })

    act(() => result.current.set("name", "b"))
    act(() => result.current.patch({ tags: ["y"] }))
    // draft moved, baseline didn't — a consumer diffing against `baseline` must see the ORIGINAL
    // loaded values while edits are in flight.
    expect(result.current.draft).toEqual({ name: "b", tags: ["y"] })
    expect(result.current.baseline).toEqual({ name: "a", tags: ["x"] })

    act(() => result.current.commit())
    expect(result.current.baseline).toEqual({ name: "b", tags: ["y"] })
  })
})
