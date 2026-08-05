import type { ReactElement, ReactNode } from 'react'

/**
 * A section's heading block: an optional eyebrow — the same label a drawer
 * link uses, so a reader who jumped straight here can see they arrived — an
 * optional claim (a section with no `###` subheading has none to show), and
 * whatever follows (normally one or two `Lede`s).
 */
export function Head({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  children?: ReactNode
}): ReactElement {
  return (
    <div className="lp-head">
      {eyebrow !== undefined && <span className="lp-eyebrow">{eyebrow}</span>}
      {title !== undefined && <h2>{title}</h2>}
      {children}
    </div>
  )
}
