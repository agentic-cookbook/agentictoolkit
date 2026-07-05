'use client'

import { useEffect, useRef, useState } from 'react'
import type { MarkdownDocument } from '../types'

export type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }

/**
 * Fetches a markdown document by id. Receives an AbortSignal so the caller can
 * cancel on unmount / id change / timeout. The default implementation calls the
 * host app's API forwarder; consumers (and tests) can inject an alternative.
 */
export type MarkdownFetcher = (
  id: string,
  signal: AbortSignal,
) => Promise<MarkdownDocument>

/** Default request timeout (ms) before the fetch is aborted and surfaced as an error. */
const DEFAULT_TIMEOUT_MS = 15_000

/** Sentinel so a timeout abort is distinguishable from an unmount/id-change abort. */
const TIMEOUT_REASON = 'mdv-timeout'

/**
 * Read an RFC 9457 problem detail (`application/problem+json`) or a plain-text
 * body and return a human-readable message for the error state (c3).
 */
async function messageFromResponse(res: Response, id: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  // Read the body ONCE as text — a Response body is a single-use stream, so
  // calling res.json() then res.text() would throw "body already used" and lose
  // the fallback text. Parse problem+json from the text we already have.
  const body = await res.text().catch(() => '')
  if (contentType.includes('application/problem+json')) {
    try {
      const problem = JSON.parse(body) as { title?: string; detail?: string }
      const parts = [problem.title, problem.detail].filter(Boolean)
      if (parts.length > 0) return parts.join(' — ')
    } catch {
      // malformed problem+json — fall through to the generic message
    }
  }
  if (res.status === 404) return `Document not found (id: ${id}).`
  return body || `Failed to load document (HTTP ${res.status}).`
}

/** The default fetcher: GET /api/content/markdown/:id through the host app's forwarder. */
export const defaultMarkdownFetcher: MarkdownFetcher = async (id, signal) => {
  const res = await fetch(`/api/content/markdown/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    // Throw a message-bearing error so the hook surfaces a readable error state.
    throw new Error(await messageFromResponse(res, id))
  }
  return (await res.json()) as MarkdownDocument
}

export interface UseMarkdownDocumentOptions {
  /** Injected fetcher (default: the real API forwarder). Lets demos/tests seed content. */
  fetcher?: MarkdownFetcher
  /** Abort + error after this many ms (default 15000). */
  timeoutMs?: number
}

/**
 * Fetches a markdown document by id and exposes a discriminated-union state so
 * the caller can render loading / error / success branches explicitly.
 *
 * Uses an AbortController: the request is aborted on unmount, on id change, and
 * on timeout. A missing/blank id short-circuits to an error (fail-fast, c3).
 */
export function useMarkdownDocument(
  id: string | undefined,
  options: UseMarkdownDocumentOptions = {},
): FetchState<MarkdownDocument> {
  const { fetcher = defaultMarkdownFetcher, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  // Hold the fetcher in a ref so an UNMEMOIZED inline fetcher prop does not
  // re-trigger the effect every render — that would loop: fetch → setState →
  // re-render → new fetcher reference → effect re-fires → fetch … The effect
  // depends only on [id, timeoutMs] and reads the latest fetcher from the ref.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Seed loading when an id is present so the first paint doesn't flash idle.
  const [state, setState] = useState<FetchState<MarkdownDocument>>(() =>
    id ? { status: 'loading' } : { status: 'idle' },
  )

  useEffect(() => {
    // No id → nothing to fetch; the neutral idle state is DERIVED below rather
    // than synced here (a missing id is "no document selected", not an error).
    if (!id) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(TIMEOUT_REASON), timeoutMs)
    setState({ status: 'loading' })

    fetcherRef
      .current(id, controller.signal)
      .then((doc) => {
        // Drop only an unmount/id-change abort; if the data arrived despite a
        // timeout abort, show it rather than getting stuck on "loading".
        if (controller.signal.aborted && controller.signal.reason !== TIMEOUT_REASON) {
          return
        }
        setState({ status: 'success', data: doc })
      })
      .catch((err: unknown) => {
        // An unmount/id-change abort is expected — drop it silently.
        if (controller.signal.aborted && controller.signal.reason !== TIMEOUT_REASON) {
          return
        }
        const message =
          controller.signal.reason === TIMEOUT_REASON
            ? `Timed out loading document after ${Math.round(timeoutMs / 1000)}s.`
            : err instanceof Error
              ? err.message
              : 'Network error.'
        setState({ status: 'error', message })
      })
      .finally(() => clearTimeout(timer))

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [id, timeoutMs])

  // Derive the absent-id case (no effect-driven state sync, no flash).
  return id ? state : { status: 'idle' }
}
