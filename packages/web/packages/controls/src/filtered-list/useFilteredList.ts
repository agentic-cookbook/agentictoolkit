import { useMemo, useState } from 'react'
import type { Accessor, FilteredListConfig, MatchFn, UseFilteredListResult } from './types'

interface DefaultMatcherDeps<T> {
  getTitle: Accessor<T>
  getSubtitle?: Accessor<T>
  getDetails?: Accessor<T>
  getSearchableExtras?: (item: T) => readonly (string | undefined | null)[]
}

function defaultMatcher<T>(deps: DefaultMatcherDeps<T>): MatchFn<T> {
  const { getTitle, getSubtitle, getDetails, getSearchableExtras } = deps
  return (item, q) => {
    const fields: (string | undefined | null)[] = [
      getTitle(item),
      getSubtitle?.(item),
      getDetails?.(item),
    ]
    if (getSearchableExtras) fields.push(...getSearchableExtras(item))
    for (const f of fields) {
      if (f && f.toLowerCase().includes(q)) return true
    }
    return false
  }
}

export function useFilteredList<T>(config: FilteredListConfig<T>): UseFilteredListResult<T> {
  const {
    items,
    getTitle,
    getSubtitle,
    getDetails,
    getSearchableExtras,
    match,
    initialQuery = '',
  } = config

  const [query, setQuery] = useState(initialQuery)

  const matcher = useMemo<MatchFn<T>>(
    () =>
      match ?? defaultMatcher({ getTitle, getSubtitle, getDetails, getSearchableExtras }),
    [match, getTitle, getSubtitle, getDetails, getSearchableExtras],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return items
    return items.filter((it) => matcher(it, q))
  }, [items, query, matcher])

  return {
    query,
    setQuery,
    visible,
    total: items.length,
    empty: visible.length === 0,
  }
}
