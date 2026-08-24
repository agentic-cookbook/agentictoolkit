'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_QUERY_PARAMS,
  type SearchFilters,
  type SearchSource,
} from '../types'

/** Default result page size when a source does not pin one. */
export const DEFAULT_PAGE_SIZE = 50

/** Default debounce (ms) applied to search/filter changes before a request fires. */
export const DEFAULT_DEBOUNCE_MS = 250

/**
 * Default per-request timeout (ms). Mirrors @agentic-toolkit/markdown's MarkdownViewer
 * (15s): a request that does not resolve by then is aborted and surfaced as an
 * error rather than spinning on the loading skeleton forever.
 */
export const DEFAULT_TIMEOUT_MS = 15000

/** The paginated results envelope every source returns (mirrors `GET /public/papers`). */
export interface SearchResultEnvelope<Hit> {
  items: Hit[]
  total: number
  page: number
  pageSize: number
}

export type SearchPhase = 'idle' | 'loading' | 'ready' | 'error'

/**
 * True when the filters warrant a results request — a non-empty trimmed query OR any
 * active tag/category facet. When false (the default, empty state) the hook skips the
 * fetch entirely (c11): the view shows a "search to get started" prompt instead of
 * auto-loading the whole corpus. Pure + exported so the view and hook agree on the
 * condition.
 */
export function isActiveSearch(filters: SearchFilters): boolean {
  return Boolean(filters.q.trim() || filters.tag || filters.category)
}

/**
 * The search state. `items`/`total` hold the LAST successful page and are retained
 * across a re-query, so typing never flashes the list back to a skeleton (the
 * AuthorPapersIndex behavior, generalised). `settled` flips true after the first
 * response resolves so the initial skeleton shows only before any data exists.
 * `refresh` re-runs the CURRENT query immediately (skipping the debounce) — the
 * Enter-commit and error-retry affordance.
 */
export interface DocumentSearchState<Hit> {
  phase: SearchPhase
  items: Hit[]
  total: number
  error: string | null
  settled: boolean
  /** Re-run the current query NOW, bypassing the debounce (Enter-commit / retry). */
  refresh: () => void
}

/** Join a (possibly trailing-slashed) base onto a (possibly leading-slashed) path. */
function joinPath(base: string, path: string): string {
  if (!path) return base
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

/**
 * Build the results request URL from the injected scope — applying the source's
 * query-param NAME mapping (defaults `q`/`tag`/`category`/`page`/`pageSize`). The core
 * holds no literal endpoint or public-only query string; everything comes from `source`.
 * Empty axes are omitted so a blank filter is never sent. Pure + exported for testing.
 */
export function buildSearchUrl(
  source: SearchSource,
  filters: SearchFilters,
  page: number,
): string {
  const names = { ...DEFAULT_QUERY_PARAMS, ...source.params }
  const pageSize = source.pageSize ?? DEFAULT_PAGE_SIZE
  const qs = new URLSearchParams()
  const q = filters.q.trim()
  if (q) qs.set(names.q, q)
  if (filters.tag) qs.set(names.tag, filters.tag)
  if (filters.category) qs.set(names.category, filters.category)
  qs.set(names.page, String(page))
  qs.set(names.pageSize, String(pageSize))
  // Scope params LAST, so they win over a user filter rather than the other way round.
  // `fixedParams` is the corpus's SCOPE, not a filter default — `types.ts`'s docblock calls it
  // "not clearable by the user" for exactly this reason. Letting a user filter override it
  // would widen the corpus past the scope the source declared (e.g. a site renaming a filter
  // axis to `author` would leak other authors' documents onto an author-scoped page). `set`
  // overwrites by key, so applying these after the filters above is what makes them win.
  for (const [k, v] of Object.entries(source.fixedParams ?? {})) qs.set(k, v)
  const path = joinPath(source.baseUrl, source.endpoints.results)
  const query = qs.toString()
  return query ? `${path}?${query}` : path
}

/** Build a facet (tags/categories) request URL, or null when the source omits it. */
export function buildFacetUrl(
  source: SearchSource,
  facet: 'tags' | 'categories',
): string | null {
  const path = source.endpoints[facet]
  if (!path) return null
  const url = joinPath(source.baseUrl, path)
  // The facet corpus has to mirror the results corpus, so the scope rides here too — a facet
  // option outside the scope is an option that yields no results.
  const qs = new URLSearchParams(Object.entries(source.fixedParams ?? {}))
  const query = qs.toString()
  return query ? `${url}?${query}` : url
}

/**
 * Combine the caller's abort controller (unmount / re-query) with a fresh per-request
 * timeout, so every outbound request both cancels on teardown AND fails fast if the
 * backend hangs. Uses the platform `AbortSignal.any` + `AbortSignal.timeout`.
 */
function withTimeout(signal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
}

/** True when a rejected fetch is a TIMEOUT (vs. our own unmount/re-query abort). */
function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'TimeoutError'
}

async function fetchResults<Hit>(
  source: SearchSource,
  filters: SearchFilters,
  page: number,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<SearchResultEnvelope<Hit>> {
  const res = await fetch(buildSearchUrl(source, filters, page), {
    ...source.fetchInit,
    signal: withTimeout(signal, timeoutMs),
  })
  if (!res.ok) throw new Error(`Search request failed (HTTP ${res.status}).`)
  return (await res.json()) as SearchResultEnvelope<Hit>
}

/** Stable serialization of the scope so an inline `source` object can't loop the effect.
 *  `fixedParams` MUST be part of it: two sources differing only by scope (two
 *  `PaperSearchView`s on one page, `authorSlug` apart) are different corpora and must not
 *  share a cache/effect key. Pure + exported for testing. */
export function sourceKeyOf(source: SearchSource): string {
  return JSON.stringify({
    baseUrl: source.baseUrl,
    endpoints: source.endpoints,
    params: source.params ?? null,
    fixedParams: source.fixedParams ?? null,
    pageSize: source.pageSize ?? null,
  })
}

/** Stable serialization of the three filter fields, for `sourceKeyOf`'s reason: the fetch
 *  effect depends on this key, so a key that two DIFFERENT filter states can spell is a filter
 *  change the fetch never sees. It used to be `` `${q} ${tag} ${category}` ``, which is not
 *  injective over free text — tags and categories are NAMES, not slugs (the facet endpoint
 *  serves the distinct values as the author typed them), so `{q: "a b", tag: ""}` and
 *  `{q: "a", tag: "b"}` joined the same string. The controls always move (they render from
 *  `filters`); on a collision the results do not, leaving the previous query's hits sitting
 *  under the new query's chips. Pure + exported for testing. */
export function filterKeyOf(filters: SearchFilters): string {
  return JSON.stringify([filters.q, filters.tag, filters.category])
}

export interface UseDocumentSearchOptions {
  /** Debounce (ms) before a filter change fires a request (default 250). */
  debounceMs?: number
  /** Per-request timeout (ms) before the fetch aborts into the error state (default 15000). */
  timeoutMs?: number
}

/**
 * Debounced, abortable search over the injected scope. Self-contained plain `fetch`
 * (no SWR/react-query assumed) so it runs in the marketing environment. Refetches page
 * 1 whenever the (serialized) scope or filters change; the previous results stay
 * visible while the new request is in flight. Every request carries a timeout so a
 * stalled backend lands in the error state rather than an endless skeleton.
 */
export function useDocumentSearch<Hit>(
  source: SearchSource,
  filters: SearchFilters,
  options: UseDocumentSearchOptions = {},
): DocumentSearchState<Hit> {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const active = isActiveSearch(filters)

  const [items, setItems] = useState<Hit[]>([])
  const [total, setTotal] = useState(0)
  const [phase, setPhase] = useState<SearchPhase>(active ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [settled, setSettled] = useState(false)
  // Bumped by `refresh()` to force an immediate re-run of the current query.
  const [nonce, setNonce] = useState(0)

  // Read the latest source/filters from refs so the effect depends only on the
  // serialized keys below (an unmemoised inline object never re-fires it).
  const sourceRef = useRef(source)
  sourceRef.current = source
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  // When set, the next effect run skips the debounce (Enter-commit / retry).
  const immediateRef = useRef(false)

  const sourceKey = useMemo(() => sourceKeyOf(source), [source])
  const filterKey = filterKeyOf(filters)

  const refresh = useCallback(() => {
    immediateRef.current = true
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    // c11 — no query and no active facet ⇒ do NOT fetch. Reset to the idle prompt
    // state (drop any prior results) and skip the request entirely; the view renders
    // its "search to get started" prompt. Facets still load (that hook is unaffected).
    if (!isActiveSearch(filtersRef.current)) {
      immediateRef.current = false
      setItems([])
      setTotal(0)
      setError(null)
      setPhase('idle')
      setSettled(false)
      return
    }

    let live = true
    const controller = new AbortController()
    const immediate = immediateRef.current
    immediateRef.current = false
    setPhase('loading')
    setError(null)

    const run = (): void => {
      void fetchResults<Hit>(
        sourceRef.current,
        filtersRef.current,
        1,
        controller.signal,
        timeoutMs,
      )
        .then((env) => {
          if (!live) return
          setItems(env.items ?? [])
          setTotal(env.total ?? 0)
          setPhase('ready')
          setSettled(true)
        })
        .catch((err: unknown) => {
          // Our own unmount/re-query abort → drop silently. A TIMEOUT is NOT this
          // abort (the controller is untouched), so it falls through to the error.
          if (!live || controller.signal.aborted) return
          setError(
            isTimeoutError(err)
              ? `Search timed out after ${Math.round(timeoutMs / 1000)}s.`
              : err instanceof Error
                ? err.message
                : 'Search failed.',
          )
          setPhase('error')
          setSettled(true)
        })
    }

    const timer = setTimeout(run, immediate ? 0 : debounceMs)
    return () => {
      live = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [sourceKey, filterKey, debounceMs, timeoutMs, nonce])

  return { phase, items, total, error, settled, refresh }
}

/**
 * Load the distinct tag + category facet options once per scope (the filter dropdown
 * sources). A facet the source omits, or a failed/timed-out facet request, yields `[]` —
 * the filter axis simply shows no options rather than erroring the whole view.
 */
export function useFacets(
  source: SearchSource,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): { tags: string[]; categories: string[] } {
  const [tags, setTags] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])

  const sourceRef = useRef(source)
  sourceRef.current = source
  const sourceKey = useMemo(() => sourceKeyOf(source), [source])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const current = sourceRef.current

    const load = async (facet: 'tags' | 'categories'): Promise<string[]> => {
      const url = buildFacetUrl(current, facet)
      if (!url) return []
      const res = await fetch(url, {
        ...current.fetchInit,
        signal: withTimeout(controller.signal, timeoutMs),
      })
      if (!res.ok) return []
      const body = (await res.json()) as { items?: string[] }
      return body.items ?? []
    }

    void Promise.all([load('tags'), load('categories')])
      .then(([t, c]) => {
        if (!active) return
        setTags(t)
        setCategories(c)
      })
      .catch(() => {
        // Facets are non-essential; a failure/timeout leaves the dropdowns empty.
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [sourceKey, timeoutMs])

  return { tags, categories }
}
