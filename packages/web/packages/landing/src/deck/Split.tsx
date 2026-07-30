import type { ReactElement, ReactNode } from 'react'

/**
 * Two panels side by side above a wide enough viewport — a prose column
 * beside its illustration — and stacked below it. See css/base.css for the
 * breakpoint.
 */
export function Split({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={['lp-split', className].filter(Boolean).join(' ')}>{children}</div>
}
