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

  it("patch applies several keys at once", () => {
    const { result } = renderHook(() => useDirtyDraft({ a: 1, b: 2 }))
    act(() => result.current.patch({ a: 9, b: 8 }))
    expect(result.current.draft).toEqual({ a: 9, b: 8 })
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
})
