import type { ReactElement, ReactNode } from 'react'

/**
 * A pill-shaped call-to-action link. `primary` (the default) is filled with
 * `--lp-accent` and the one the page wants clicked first; `ghost` is outlined
 * only.
 */
export function Btn({
  href,
  variant = 'primary',
  children,
}: {
  href: string
  variant?: 'primary' | 'ghost'
  children: ReactNode
}): ReactElement {
  return (
    <a className={['lp-btn', `lp-btn--${variant}`].join(' ')} href={href}>
      {children}
    </a>
  )
}
