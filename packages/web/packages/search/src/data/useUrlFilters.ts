'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { SearchFilters } from '../types'

const EMPTY_FILTERS: SearchFilters = { q: '', category: '', tag: '' }

/**
 * Parse `q`/`tag`/`category` from a `location.search` string. Pure + testable; the
 * caller decides what to do with an all-empty result. Trims `q` so a stray `?q=`
 * round-trips as empty.
 */
export function filtersFromSearch(search: string): SearchFilters {
  const p = new URLSearchParams(search)
  return {
    q: (p.get('q') ?? '').trim(),
    tag: p.get('tag') ?? '',
    category: p.get('category') ?? '',
  }
}

/**
 * Serialize active filters into a query string, omitting empty axes (so a blank view
 * yields `''`, i.e. a clean URL). Pure + testable.
 */
export function filtersToSearch(filters: SearchFilters): string {
  const p = new URLSearchParams()
  const q = filters.q.trim()
  if (q) p.set('q', q)
  if (filters.tag) p.set('tag', filters.tag)
  if (filters.category) p.set('category', filters.category)
  return p.toString()
}

/**
 * Merge the filters into an EXISTING `location.search` string: set/delete only the
 * `q`/`tag`/`category` keys and leave every other param intact (`utm_*` etc. survive
 * a filter change). Returns the new query string WITHOUT the leading `?` (may be
 * empty). Pure + testable.
 */
export function mergeFiltersIntoSearch(search: string, filters: SearchFilters): string {
  const p = new URLSearchParams(search)
  const q = filters.q.trim()
  if (q) p.set('q', q)
  else p.delete('q')
  if (filters.tag) p.set('tag', filters.tag)
  else p.delete('tag')
  if (filters.category) p.set('category', filters.category)
  else p.delete('category')
  return p.toString()
}

/**
 * Debounce (ms) for the URL write. Fast typing produces ONE `replaceState` per pause
 * instead of one per keystroke — WebKit rate-limits history mutations (~100 per 30s)
 * and throws a `SecurityError` past the cap, so per-keystroke writes can hard-fail.
 */
export const URL_WRITE_DEBOUNCE_MS = 250

/**
 * Filters state that is (optionally) mirrored to the URL query string so a results
 * view is shareable and the back/forward buttons re-sync it. Framework-agnostic and
 * SSR-safe: every `window` access is guarded, the initial render is always the same
 * empty state on server and client (no hydration mismatch), then a mount effect
 * hydrates from `window.location.search`. Writes use `replaceState` so live typing
 * never spams the history stack.
 *
 * When `enabled` is false it degrades to a plain `useState`, so the host stays
 * reusable (e.g. a second instance on one page, or an embed that owns its own URL).
 */
export function useUrlFilters(
  enabled: boolean,
): [SearchFilters, Dispatch<SetStateAction<SearchFilters>>] {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)

  // Hydrate from the URL on mount and keep in sync with back/forward (client only).
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const apply = (): void => setFilters(filtersFromSearch(window.location.search))
    apply()
    window.addEventListener('popstate', apply)
    return () => window.removeEventListener('popstate', apply)
  }, [enabled])

  // Write filters back to the URL (replaceState — no history spam), DEBOUNCED so fast
  // typing coalesces into one write per pause (see URL_WRITE_DEBOUNCE_MS). Skip the
  // first run so the mount write can't clobber the URL before hydration has read it —
  // the skip happens BEFORE any timer is scheduled, so the debounce cannot resurrect
  // the pre-hydration clobber; the hydration setFilters then re-runs this effect with
  // the hydrated values (an identical URL ⇒ no write). The write starts from the
  // CURRENT window.location.search and touches only our keys, so foreign params
  // (utm_* etc.) survive. A pending write is cancelled on re-run/unmount.
  const skipNextWrite = useRef(true)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    if (skipNextWrite.current) {
      skipNextWrite.current = false
      return
    }
    const timer = setTimeout(() => {
      const { pathname, hash, search } = window.location
      const qs = mergeFiltersIntoSearch(search, {
        q: filters.q,
        tag: filters.tag,
        category: filters.category,
      })
      const nextUrl = `${pathname}${qs ? `?${qs}` : ''}${hash}`
      if (nextUrl !== `${pathname}${search}${hash}`) {
        window.history.replaceState(window.history.state, '', nextUrl)
      }
    }, URL_WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // Depend on the primitive axes (not the `filters` object identity) so an
    // identical-value re-render never reschedules the write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filters.q, filters.tag, filters.category])

  return [filters, setFilters]
}
