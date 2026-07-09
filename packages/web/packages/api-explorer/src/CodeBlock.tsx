'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@agentic-toolkit/ui'
import { useClipboard } from '@agentic-toolkit/ui/hooks/useClipboard'
import { highlightToHtml, type HighlightLang } from './lib/highlight'

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
  const { copied, copy } = useClipboard()

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
      <button
        type="button"
        onClick={() => void copy(code)}
        className="absolute right-2 top-2 z-10 rounded-md border border-apt-border bg-apt-surface/85 p-1.5 text-apt-text-muted opacity-0 transition hover:text-apt-text focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
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
