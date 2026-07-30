'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { MarkdownRenderer, DEFAULT_THEME_ID, getThemeById } from '@agentic-toolkit/markdown'
import { Button } from '@agentic-toolkit/ui/components/button'
import { DEFAULT_CONTENT_ENDPOINT, type DocumentPreviewProps, type SearchSource } from '../../types'
import type { PaperSearchHit } from '../../registry/markdown'
import { DEFAULT_TIMEOUT_MS } from '../../data/useDocumentSearch'

/**
 * The markdown PREVIEW BODY (criterion c4): reuses @agentic-toolkit/markdown's
 * `MarkdownRenderer` — the same GitHub-flavoured, shiki-highlighted, rehype-sanitised
 * pipeline every adh site uses — rather than a bespoke parser. It fetches the selected
 * paper's full content from the public-by-(slug, route) endpoint through the injected
 * scope's base URL, then renders it inside the viewer-owned `--mdv-*` reading palette
 * (the default, matching the research surface), exactly as the research site's
 * PaperRenderer does.
 *
 * c14: this renders the BODY ONLY — the title + kind badge + author + date + summary +
 * evaluation metadata header lives in {@link MarkdownPreviewHeader}, which the preview
 * dock renders ONCE above this body. Rendering a second header here would duplicate the
 * dock's single header (the c14 bug), so it deliberately does not.
 *
 * The content fetch carries a timeout (default 15s, mirroring MarkdownViewer) so a
 * stalled backend lands in the error state rather than spinning forever; the error
 * state offers a Retry that re-runs the fetch.
 */

// The reading palette never changes for a published paper — computed once at module scope.
const READING_THEME = getThemeById(DEFAULT_THEME_ID)

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; content: string }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }

function trimBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base
}

/**
 * Build the full-content URL for a hit through the injected scope: the scope's
 * `endpoints.content` path TEMPLATE (default {@link DEFAULT_CONTENT_ENDPOINT}) with
 * its `:slug`/`:route` placeholders filled from the hit (URL-encoded), joined onto
 * the scope's base URL. A non-public scope overrides the template — no edit here.
 */
function contentUrl(source: SearchSource, hit: PaperSearchHit): string {
  const template = source.endpoints.content ?? DEFAULT_CONTENT_ENDPOINT
  const path = template
    .replace(':slug', encodeURIComponent(hit.author.slug))
    .replace(':route', encodeURIComponent(hit.publicRoute))
  return `${trimBase(source.baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}

/** True when a rejected fetch is a TIMEOUT (vs. our own unmount/re-select abort). */
function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'TimeoutError'
}

export function MarkdownPreview({
  hit,
  source,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: DocumentPreviewProps<PaperSearchHit>): ReactElement {
  const [state, setState] = useState<State>({ phase: 'loading' })
  // Bumped by Retry to force the fetch to re-run for the same paper.
  const [reloadToken, setReloadToken] = useState(0)
  const retry = useCallback(() => setReloadToken((n) => n + 1), [])

  // Read scope from a ref so the effect depends only on the (slug, route, baseUrl)
  // primitives — an inline `source` object never re-fires the fetch.
  const sourceRef = useRef(source)
  sourceRef.current = source
  const slug = hit.author.slug
  const route = hit.publicRoute
  const base = source.baseUrl
  const contentTemplate = source.endpoints.content ?? DEFAULT_CONTENT_ENDPOINT

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setState({ phase: 'loading' })

    fetch(contentUrl(sourceRef.current, hit), {
      ...sourceRef.current.fetchInit,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load paper (HTTP ${res.status}).`)
        return (await res.json()) as { content?: string }
      })
      .then((body) => {
        if (!active) return
        const content = body.content ?? ''
        setState(content.trim() ? { phase: 'ready', content } : { phase: 'empty' })
      })
      .catch((err: unknown) => {
        // Our own unmount/re-select abort → drop silently. A timeout is NOT this abort
        // (the controller is untouched), so it falls through to the error state.
        if (!active || controller.signal.aborted) return
        setState({
          phase: 'error',
          message: isTimeoutError(err)
            ? `Timed out loading paper after ${Math.round(timeoutMs / 1000)}s.`
            : err instanceof Error
              ? err.message
              : 'Failed to load paper.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
    // `hit` is reconstructed each render; depend on the stable identity primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, route, base, contentTemplate, timeoutMs, reloadToken])

  return (
    // c14 — the BODY only. The metadata header (title/badge/author/date/summary/
    // evaluation/link) is rendered ONCE by the preview dock via MarkdownPreviewHeader,
    // so no header is rendered here (that would be the duplicate the c14 fix removes).
    <div
      className="adh-mv-content"
      data-mdv-theme={READING_THEME.id}
      data-mdv-shiki-variant={READING_THEME.shikiVariant}
      style={READING_THEME.palette as CSSProperties}
    >
      {state.phase === 'loading' && (
        <div className="adh-mv-state" aria-live="polite" aria-busy="true">
          <p className="adh-mv-state-detail">Loading paper…</p>
        </div>
      )}
      {state.phase === 'empty' && (
        <div className="adh-mv-state">
          <p className="adh-mv-state-title">Empty paper</p>
          <p className="adh-mv-state-detail">This paper has no content yet.</p>
        </div>
      )}
      {state.phase === 'error' && (
        <div className="adh-mv-state adh-mv-state--error" role="alert">
          <p className="adh-mv-state-title">Failed to load paper</p>
          <p className="adh-mv-state-detail">{state.message}</p>
          <Button variant="outline" size="sm" onClick={retry} className="mt-3">
            Retry
          </Button>
        </div>
      )}
      {state.phase === 'ready' && <MarkdownRenderer content={state.content} />}
    </div>
  )
}
