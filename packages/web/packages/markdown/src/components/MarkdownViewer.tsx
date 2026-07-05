'use client'

import { useCallback, useState } from 'react'
import { useMarkdownDocument } from '../hooks/useMarkdownDocument'
import type { MarkdownFetcher } from '../hooks/useMarkdownDocument'
import {
  getThemeById,
  DEFAULT_THEME_ID,
  isValidThemeId,
  SHIKI_VARIANT_BY_ID,
} from '../themes/registry'
import { MDV_PALETTES } from '../themes/palettes'
import { MarkdownThemeSwitcher } from './MarkdownThemeSwitcher'
import { MarkdownRenderer } from './MarkdownRenderer'

const STORAGE_KEY = 'adh-mdv-theme'

/**
 * Pre-hydration bootstrap script (next-themes pattern). Runs synchronously while
 * the SSR HTML is parsed — BEFORE first paint — so the persisted reading theme is
 * applied before anything is shown (c8: no flash, no SSR/CSR mismatch).
 *
 * It targets its own content root via `document.currentScript.parentElement`,
 * reads the persisted theme id, validates it against the registry, then stamps
 * `data-mdv-theme` + `data-mdv-shiki-variant` and applies the `--mdv-*` palette
 * as inline custom properties.
 *
 * The palette + variant maps are serialised via JSON.stringify, so NO concrete
 * color literal appears in this .tsx source — they live only in palettes.ts.
 */
const BOOTSTRAP_SCRIPT = `(function(){try{var s=document.currentScript;var el=s&&s.parentElement;if(!el)return;var k=${JSON.stringify(
  STORAGE_KEY,
)};var P=${JSON.stringify(MDV_PALETTES)};var V=${JSON.stringify(
  SHIKI_VARIANT_BY_ID,
)};var id=null;try{id=window.localStorage.getItem(k)}catch(e){}if(!id||!P[id])id=${JSON.stringify(
  DEFAULT_THEME_ID,
)};el.setAttribute('data-mdv-theme',id);el.setAttribute('data-mdv-shiki-variant',V[id]||'light');var p=P[id];for(var v in p){el.style.setProperty(v,p[v])}}catch(e){}})()`

/**
 * Read the persisted theme id synchronously (client only), VALIDATED against the
 * registry. A stale/removed id (e.g. a theme deleted in a later release) is
 * treated as absent so it falls back to the default — matching what the
 * pre-hydration bootstrap script does, so React and the DOM never disagree.
 */
function readPersistedThemeId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isValidThemeId(stored) ? stored : undefined
  } catch {
    return undefined
  }
}

export interface MarkdownViewerProps {
  /**
   * The `id` of a row in the backend `content.markdown` table. The viewer fetches
   * it via GET /api/content/markdown/:id (through the host app's API forwarding).
   */
  id: string | undefined
  /**
   * Optional injected fetcher (default: the real API forwarder). Production leaves
   * this unset so the real backend is used; demos/tests inject seeded content.
   */
  fetcher?: MarkdownFetcher
  /** Optional fetch timeout in ms (default 15000). */
  timeoutMs?: number
  /** Optional CSS class forwarded to the viewer container. */
  className?: string
  /**
   * Optional CSP nonce for the inline no-flash bootstrap script. Host apps that
   * run a strict `script-src 'nonce-…' 'strict-dynamic'` policy MUST pass the
   * per-request nonce (e.g. `headers().get('x-nonce')`) so the script isn't
   * blocked — when blocked, the SSR paint falls back to the default theme,
   * defeating the no-flash behavior. Apps without a strict CSP can omit it.
   */
  nonce?: string
}

/**
 * Reusable markdown viewer.
 *
 * Given a markdown document `id`, fetches the row, renders it as sanitised
 * GitHub-flavoured markdown with shiki-highlighted code, and offers a persisted,
 * user-selectable reading theme.
 *
 * Architecture (single-responsibility modules):
 *   MarkdownViewer         — fetch state + theme persistence + chrome layout
 *   useMarkdownDocument    — abortable, timed fetch with an injectable fetcher
 *   MarkdownThemeSwitcher  — @adh-shared/ui Select control
 *   MarkdownRenderer       — async markdown → sanitised HTML (theme-independent)
 *   themes/registry+palettes — data-driven `--mdv-*` reading palettes
 *
 * Theming: the CHROME (container, toolbar, switcher) uses @adh-shared/ui + apt-*
 * tokens for platform consistency; only the CONTENT root carries the viewer-owned
 * `--mdv-*` palette (data-mdv-theme), kept separate from the platform tokens.
 */
export function MarkdownViewer({
  id,
  fetcher,
  timeoutMs,
  className,
  nonce,
}: MarkdownViewerProps): React.JSX.Element {
  // Read persisted theme synchronously so the FIRST client render already matches
  // what the pre-hydration script applied (no flash; consistent with SSR+script).
  const [themeId, setThemeId] = useState<string>(
    () => readPersistedThemeId() ?? DEFAULT_THEME_ID,
  )

  const activeTheme = getThemeById(themeId)

  const handleThemeChange = useCallback((newId: string) => {
    setThemeId(newId)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, newId)
      } catch {
        // ignore storage failures (private mode, quota) — theme still applies live
      }
    }
  }, [])

  const fetchState = useMarkdownDocument(id, { fetcher, timeoutMs })

  // The reading palette is applied as inline custom properties on the content
  // root; React keeps it in sync on theme change (instant repaint via CSS vars).
  const paletteStyle = activeTheme.palette as React.CSSProperties

  const toolbarTitle = fetchState.status === 'success' ? fetchState.data.title : ''

  return (
    <div
      className={[
        'adh-mv flex min-h-0 flex-col overflow-hidden rounded-xl border border-apt-border bg-apt-bg',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Chrome toolbar — apt-* tokens for platform consistency. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-apt-border bg-apt-surface px-4 py-3">
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-apt-text"
          title={toolbarTitle || undefined}
        >
          {toolbarTitle}
        </span>
        <MarkdownThemeSwitcher activeThemeId={themeId} onThemeChange={handleThemeChange} />
      </div>

      {/* Content root — carries the viewer-owned --mdv-* reading palette. */}
      <div
        className="adh-mv-content"
        data-mdv-theme={themeId}
        data-mdv-shiki-variant={activeTheme.shikiVariant}
        style={paletteStyle}
        // The bootstrap script mutates this element's attribute/style before
        // hydration; the SSR (default) vs client (persisted) difference is
        // intentional and reconciled by the script + matching client state.
        suppressHydrationWarning
      >
        {/* eslint-disable-next-line react/no-danger -- inline no-flash theme script (c8) */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />

        {fetchState.status === 'idle' && (
          <div className="adh-mv-state">
            <p className="adh-mv-state-detail">No document selected.</p>
          </div>
        )}

        {fetchState.status === 'loading' && (
          <div className="adh-mv-state" aria-live="polite" aria-busy="true">
            <svg
              className="adh-mv-state-icon"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="adh-mv-state-title">Loading…</p>
          </div>
        )}

        {fetchState.status === 'error' && (
          <div className="adh-mv-state adh-mv-state--error" role="alert">
            <svg
              className="adh-mv-state-icon"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p className="adh-mv-state-title">Failed to load document</p>
            <p className="adh-mv-state-detail">{fetchState.message}</p>
          </div>
        )}

        {fetchState.status === 'success' && !fetchState.data.content.trim() && (
          <div className="adh-mv-state">
            <svg
              className="adh-mv-state-icon"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="adh-mv-state-title">Empty document</p>
            <p className="adh-mv-state-detail">This document has no content yet.</p>
          </div>
        )}

        {fetchState.status === 'success' && fetchState.data.content.trim() !== '' && (
          <MarkdownRenderer content={fetchState.data.content} />
        )}
      </div>
    </div>
  )
}
