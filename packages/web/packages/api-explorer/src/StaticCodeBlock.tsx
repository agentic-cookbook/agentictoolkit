// NO 'use client' — a PURE server component (no client island), so the whole server reference
// bundle stays free of 'use client' modules and its server-safe helpers can't be mislabelled as
// client. It highlights the code at render time (build time, for a prerendered page) with the same
// isomorphic shiki helper the client CodeBlock uses, and emits the finished markup directly — so the
// reference's code is in the server HTML: crawlable, no client highlight pass, no flash. (The
// interactive CodeBlock keeps its copy button; the read-only reference is plain selectable text.)

// Package path (not relative): lib/highlight caches a lazy shiki highlighter
// promise shared with the client entry's own import of it — see the `external`
// entry + comment in tsup.config.ts for why a relative import here would fork it.
import { highlightToHtml, type HighlightLang } from '@agentic-toolkit/api-explorer/lib/highlight'

export interface StaticCodeBlockProps {
  code: string
  lang: HighlightLang
  className?: string
  ariaLabel?: string
}

export async function StaticCodeBlock({ code, lang, className, ariaLabel }: StaticCodeBlockProps) {
  // Highlighting can fail (transient shiki chunk/wasm issue at build) — fall back to the plain
  // <pre> so the code text is still present and crawlable, exactly like the client block's fallback.
  let html: string | null = null
  try {
    html = await highlightToHtml(code, lang)
  } catch {
    html = null
  }

  return (
    <div className={`adh-api-code${className ? ` ${className}` : ''}`}>
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
