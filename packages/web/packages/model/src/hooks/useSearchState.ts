'use client'

import { useMemo, useState, useCallback, type KeyboardEvent } from 'react'
import type { SearchIndex, SearchResult } from '../lib/search'

export type SearchState = {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  handleKey: (e: KeyboardEvent<HTMLElement>) => void
  reset: () => void
}

export function useSearchState(index: SearchIndex): SearchState {
  const [query, setQueryState] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => index.query(query), [index, query])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setSelectedIndex(0)
  }, [])

  const reset = useCallback(() => {
    setQueryState('')
    setSelectedIndex(0)
  }, [])

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ArrowDown') {
        setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        reset()
      }
    },
    [results.length, reset],
  )

  return { query, setQuery, results, selectedIndex, setSelectedIndex, handleKey, reset }
}
