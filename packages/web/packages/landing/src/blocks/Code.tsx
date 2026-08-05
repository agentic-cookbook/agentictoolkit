import type { ReactElement } from 'react'

/**
 * A block of literal text — a shell transcript, an invocation, a config
 * fragment — set in the deck's mono face and left exactly as written.
 *
 * The prop is a plain string rather than children on purpose. Everything else
 * in this package takes `ReactNode` so a host can put emphasis and links
 * inside it; here the whole point is that nothing is interpreted, and a
 * `ReactNode` would invite a host to pass marked-up prose that then renders
 * as code. `Code` never wraps: a wrapped command line is a different command
 * line, so the block scrolls instead.
 */
export function Code({ text }: { text: string }): ReactElement {
  return (
    <pre className="lp-code">
      <code>{text}</code>
    </pre>
  )
}
