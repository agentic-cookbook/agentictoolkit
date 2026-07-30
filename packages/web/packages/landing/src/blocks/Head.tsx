import type { ReactElement, ReactNode } from 'react'

/**
 * A section's heading block: an optional eyebrow — the same label a drawer
 * link uses, so a reader who jumped straight here can see they arrived — the
 * claim itself, and whatever follows (normally one or two `Lede`s).
 */
export function Head({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  children?: ReactNode
}): ReactElement {
  return (
    <div className="lp-head">
      {eyebrow !== undefined && <span className="lp-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {children}
    </div>
  )
}
