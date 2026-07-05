'use client'

import { useEffect, useState } from 'react'
import { processMarkdown } from '../lib/process-markdown'

export interface MarkdownRendererProps {
  /** Raw markdown string (frontmatter may or may not be present — it is stripped). */
  content: string
}

type RenderState =
  | { phase: 'rendering' }
  | { phase: 'ready'; html: string }
  | { phase: 'error' }

/**
 * Converts raw markdown to highlighted, sanitised HTML and renders it.
 *
 * Rendering is async (shiki highlighter init + unified pipeline) and runs ONCE
 * per content change — it is theme-independent. Code-block colors are emitted as
 * dual-theme CSS variables, so switching the reading theme repaints via CSS with
 * no re-processing (and therefore no "Rendering…" flash on theme change).
 *
 * A pipeline failure renders a centered error pane (consistent with the viewer's
 * other states), NOT injected HTML — so the dangerouslySetInnerHTML sink below
 * only ever receives rehype-sanitize output.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): React.JSX.Element {
  const [render, setRender] = useState<RenderState>({ phase: 'rendering' })

  useEffect(() => {
    let cancelled = false
    setRender({ phase: 'rendering' })

    processMarkdown(content)
      .then((result) => {
        if (!cancelled) setRender({ phase: 'ready', html: result.html })
      })
      .catch(() => {
        if (!cancelled) setRender({ phase: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [content])

  if (render.phase === 'rendering') {
    // Brief processing phase — the document is already loaded; only the render
    // pipeline is running, so a subtle inline note (not a full spinner) suffices.
    return (
      <div className="adh-mv-state" aria-live="polite" aria-busy="true">
        <span className="adh-mv-state-detail">Rendering…</span>
      </div>
    )
  }

  if (render.phase === 'error') {
    return (
      <div className="adh-mv-state adh-mv-state--error" role="alert">
        <p className="adh-mv-state-title">Failed to render document</p>
        <p className="adh-mv-state-detail">The document content could not be rendered.</p>
      </div>
    )
  }

  return (
    <div
      className="adh-mv-prose"
      // `render.html` is ALWAYS rehype-sanitize output — the error path renders a
      // separate React pane above, never this sink. XSS-safe (c6).
      dangerouslySetInnerHTML={{ __html: render.html }}
    />
  )
}
