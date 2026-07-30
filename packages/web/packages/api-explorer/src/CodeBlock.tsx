'use client'

import { useEffect, useState } from 'react'
import { cn } from '@agentic-toolkit/ui'
import { CopyButton } from './CopyButton'
// Package path (not relative): see the matching comment in StaticCodeBlock.tsx / tsup.config.ts.
import { highlightToHtml, type HighlightLang } from '@agentic-toolkit/api-explorer/lib/highlight'

/**
 * Shiki-highlighted, copyable code. Renders a plain <pre> immediately (correct
 * text, no flash of empty), then swaps in the highlighted markup once shiki
 * resolves. Theme (light/dark) follows the app's `.dark` class via the package
 * CSS — no re-highlight on theme change.
 */
export function CodeBlock({
  code,
  lang,
  className,
  ariaLabel,
}: {
  code: string
  lang: HighlightLang
  className?: string
  ariaLabel?: string
}) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // Clear stale markup so the plain-text fallback shows the CURRENT code while
    // the (async) re-highlight is in flight, rather than the previous code's HTML.
    setHtml(null)
    highlightToHtml(code, lang)
      .then((markup) => {
        if (active) setHtml(markup)
      })
      .catch(() => {
        if (active) setHtml(null)
      })
    return () => {
      active = false
    }
  }, [code, lang])

  return (
    <div className={cn('adh-api-code group relative', className)}>
      <CopyButton code={code} />
      {html ? (
        <div aria-label={ariaLabel} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto rounded-lg border border-apt-border bg-apt-surface p-3 text-sm text-apt-text">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
