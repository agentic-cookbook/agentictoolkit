// NO "use client" — this is a React Server Component. It runs the SAME pipeline as
// {@link MarkdownRenderer} but on the server (at build / request time), so the rendered HTML is in
// the SSR payload: crawlable, and no client "Rendering…" flash. Use this in server components and
// prerendered routes (the docs sites). Reach for the client MarkdownRenderer only when the content
// is chosen at runtime on the client with no server round-trip.

import { processMarkdown } from '../lib/process-markdown'

export interface MarkdownContentProps {
  /** Raw markdown string (frontmatter, if any, is stripped). */
  content: string
  /** Extra class(es) appended to the always-present `adh-mv-prose`. */
  className?: string
}

/**
 * Server-render markdown to sanitised, shiki-highlighted HTML. Same output shape and CSS
 * (`adh-mv-prose`) as {@link MarkdownRenderer}, so a document renders identically whichever path
 * a host uses. Async (RSC): `await`s the shared unified pipeline; the shiki highlighter + frozen
 * processor are module-cached, so repeated calls in one process reuse them.
 */
export async function MarkdownContent({ content, className }: MarkdownContentProps) {
  const { html } = await processMarkdown(content)
  return (
    <div
      className={className ? `adh-mv-prose ${className}` : 'adh-mv-prose'}
      // `html` is ALWAYS rehype-sanitize output (processMarkdown's final step) — XSS-safe sink (c6).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
