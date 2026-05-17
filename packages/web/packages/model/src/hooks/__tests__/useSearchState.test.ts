import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearchState } from '../useSearchState'
import { createSearchIndex } from '../../lib/search'
import type { SiteEntry } from '../../types'

const make = (slug: string, title: string): SiteEntry => ({
  slug,
  section: 's',
  raw: '',
  html: '',
  headings: [],
  frontmatter: { title },
})

const entries: SiteEntry[] = [
  make('/a', 'Alpha'),
  make('/b', 'Alphabet'),
  make('/c', 'Beta'),
]
const idx = createSearchIndex(entries)

describe('useSearchState', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSearchState(idx))
    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.selectedIndex).toBe(0)
  })

  it('updates results when query changes', () => {
    const { result } = renderHook(() => useSearchState(idx))
    act(() => result.current.setQuery('alph'))
    expect(result.current.results.length).toBeGreaterThan(0)
  })

  it('arrow keys move selection within bounds', () => {
    const { result } = renderHook(() => useSearchState(idx))
    act(() => result.current.setQuery('alph'))
    const total = result.current.results.length
    act(() => result.current.handleKey({ key: 'ArrowDown' } as any))
    expect(result.current.selectedIndex).toBe(Math.min(1, total - 1))
    act(() => result.current.handleKey({ key: 'ArrowUp' } as any))
    expect(result.current.selectedIndex).toBe(0)
  })

  it('Escape resets query and clears results', () => {
    const { result } = renderHook(() => useSearchState(idx))
    act(() => result.current.setQuery('alph'))
    act(() => result.current.handleKey({ key: 'Escape' } as any))
    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
  })
})
