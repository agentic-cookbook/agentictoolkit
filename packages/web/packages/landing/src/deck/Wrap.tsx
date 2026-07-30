import type { ReactElement, ReactNode } from 'react'

/**
 * The content column. Every screen's children sit in one of these rather than
 * the screen itself being width-limited, so a screen can still paint edge to
 * edge while its content stays in the column.
 */
export function Wrap({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={['lp-wrap', className].filter(Boolean).join(' ')}>{children}</div>
}
