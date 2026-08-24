/**
 * `useLastPresent` — the value a closing modal still needs.
 *
 * The behaviour it exists for (a Dialog fading out instead of popping) is a CSS transition,
 * which jsdom does not run, so the dialogs' own tests cannot see it. What they can see is
 * the contract underneath: the subject outlives the host clearing it, and never leaks back
 * into the next open. That is asserted here, once, where it is actually observable.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useLastPresent } from '../hooks/useLastPresent'

describe('useLastPresent', () => {
  it('passes a live value straight through', () => {
    const { result } = renderHook(({ v }) => useLastPresent(v), {
      initialProps: { v: 'work' as string | null },
    })
    expect(result.current).toBe('work')
  })

  it('holds the last value once it goes null', () => {
    // The whole point: `if (!subject) return null` used to fire on this exact tick, cutting
    // the exit transition off before it had a frame to run in.
    const { result, rerender } = renderHook(({ v }) => useLastPresent(v), {
      initialProps: { v: 'work' as string | null },
    })
    rerender({ v: null })
    expect(result.current).toBe('work')
  })

  it('takes up the new value the moment one arrives', () => {
    const { result, rerender } = renderHook(({ v }) => useLastPresent(v), {
      initialProps: { v: 'work' as string | null },
    })
    rerender({ v: null })
    rerender({ v: 'planning' })
    expect(result.current).toBe('planning')
  })

  it('is null until it has ever been given a value', () => {
    const { result } = renderHook(() => useLastPresent<string>(null))
    expect(result.current).toBeNull()
  })
})
