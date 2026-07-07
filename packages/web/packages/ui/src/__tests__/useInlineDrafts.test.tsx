import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { useInlineDrafts } from '../hooks/useInlineDrafts'

interface Row {
  key: string
  description: string
  enabled: boolean
}

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

function setup() {
  return renderHook(() => useInlineDrafts<string, Row>(describeError))
}

describe('useInlineDrafts', () => {
  it('overlays only touched fields; a clean row is not dirty', () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    expect(result.current.isDirty('r1', base)).toBe(false)
    expect(result.current.draftOf('r1', base)).toEqual(base)

    act(() => result.current.edit('r1', { description: 'Beta gate' }))

    expect(result.current.isDirty('r1', base)).toBe(true)
    expect(result.current.draftOf('r1', base)).toEqual({ ...base, description: 'Beta gate' })
    // The commit payload is only the touched field — never the whole row.
    expect(result.current.changesOf('r1', base)).toEqual({ description: 'Beta gate' })
  })

  it('editing a field back to its base value clears dirtiness', () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'changed' }))
    expect(result.current.isDirty('r1', base)).toBe(true)
    act(() => result.current.edit('r1', { description: 'Beta' }))
    expect(result.current.isDirty('r1', base)).toBe(false)
    expect(result.current.changesOf('r1', base)).toEqual({})
  })

  it('never clobbers an untouched field that changed under it (patch-based drafts)', () => {
    const before: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { enabled: true }))
    // A background refetch changes `description` while the user only touched `enabled`.
    const after: Row = { key: 'beta', description: 'Renamed elsewhere', enabled: false }
    // The commit payload carries only `enabled` — the refetched description is untouched.
    expect(result.current.changesOf('r1', after)).toEqual({ enabled: true })
    expect(result.current.draftOf('r1', after)).toEqual({ ...after, enabled: true })
  })

  it('settle keeps keystrokes typed while the commit was in flight', () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'Beta gate' }))
    // Commit fires with "Beta gate"; before it resolves the user types more.
    act(() => result.current.edit('r1', { description: 'Beta gateway' }))
    act(() => result.current.settle('r1', { description: 'Beta gate' }))

    // The committed value is gone, but the newer keystroke survives as a live draft.
    expect(result.current.isDirty('r1', base)).toBe(true)
    expect(result.current.draftOf('r1', base).description).toBe('Beta gateway')
  })

  it('settle with no newer edits fully clears the row', () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'Beta gate' }))
    act(() => result.current.settle('r1', { description: 'Beta gate' }))
    expect(result.current.isDirty('r1', base)).toBe(false)
  })

  it('arming a delete replaces any patch and is mutually exclusive with edits', () => {
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'x' }))
    act(() => result.current.toggleArmed('r1'))
    expect(result.current.isArmed('r1')).toBe(true)
    // While armed, edits are ignored (the row is pending deletion, not editing).
    act(() => result.current.edit('r1', { description: 'y' }))
    expect(result.current.isArmed('r1')).toBe(true)
    act(() => result.current.toggleArmed('r1'))
    expect(result.current.isArmed('r1')).toBe(false)
  })

  it('runCommit ignores re-entry for a row already in flight', async () => {
    const { result } = setup()
    let resolveFirst: () => void = () => {}
    const first = vi.fn(() => new Promise<void>((r) => (resolveFirst = r)))
    const second = vi.fn(() => Promise.resolve())

    let firstPromise!: Promise<boolean>
    act(() => {
      firstPromise = result.current.runCommit('r1', first)
    })
    await waitFor(() => expect(result.current.isBusy('r1')).toBe(true))

    // A second commit for the same row while the first is in flight is a no-op.
    let secondResult: boolean | undefined
    await act(async () => {
      secondResult = await result.current.runCommit('r1', second)
    })
    expect(secondResult).toBe(false)
    expect(second).not.toHaveBeenCalled()

    await act(async () => {
      resolveFirst()
      await firstPromise
    })
    expect(result.current.isBusy('r1')).toBe(false)
  })

  it('runCommit stores the row error on failure and keeps pending state for retry', async () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'Beta gate' }))
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.runCommit('r1', () => Promise.reject(new Error('boom')))
    })
    expect(ok).toBe(false)
    expect(result.current.errorOf('r1')).toBe('boom')
    // The draft survives so the user can fix and retry.
    expect(result.current.isDirty('r1', base)).toBe(true)
    // A later successful commit clears the stale error.
    await act(async () => {
      await result.current.runCommit('r1', () => Promise.resolve())
    })
    expect(result.current.errorOf('r1')).toBeNull()
  })

  it('clear drops the row draft and its error', async () => {
    const base: Row = { key: 'beta', description: 'Beta', enabled: false }
    const { result } = setup()

    act(() => result.current.edit('r1', { description: 'Beta gate' }))
    await act(async () => {
      await result.current.runCommit('r1', () => Promise.reject(new Error('boom')))
    })
    act(() => result.current.clear('r1'))
    expect(result.current.isDirty('r1', base)).toBe(false)
    expect(result.current.errorOf('r1')).toBeNull()
  })
})
