// NO "use client" — a pure, synchronous inject with no hooks, so it renders on either side:
// server (the docs sites' DocTopic) or inside a client tree (the Help modal's MarkdownTopic).
//
// The HTML is PRE-RENDERED processMarkdown output baked into content.generated.ts at build time
// (see help/content.generated.ts, produced by tools/gen-help-content.py). Injecting it directly —
// instead of processing markdown at render time — is what makes the modal flash-free and keeps the
// sites from re-running the pipeline every build. The `adh-mv-prose` wrapper is the same class the
// runtime renderers (@agenticdevelopertoolkit/markdown's MarkdownContent / MarkdownRenderer) put on their
// output, so the prose styles apply identically whichever path produced the HTML.

export interface MarkdownHtmlProps {
  /** Pre-rendered, sanitised HTML — MUST be processMarkdown output (rehype-sanitize's final step). */
  html: string
  /** Extra class(es) appended to the always-present `adh-mv-prose`. */
  className?: string
}

export function MarkdownHtml({ html, className }: MarkdownHtmlProps) {
  return (
    <div
      className={className ? `adh-mv-prose ${className}` : 'adh-mv-prose'}
      // `html` is ALWAYS processMarkdown's rehype-sanitize output — the only writer is the build-time
      // generator, never user input reaching this sink at runtime. XSS-safe (c6).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
