import type { ReactElement } from 'react'

/**
 * The hero's glow. Purely decorative — `aria-hidden` and no children — see
 * css/base.css for why its offset is derived from the hero's own padding
 * variables rather than a measured constant.
 */
export function Glow({ className }: { className?: string }): ReactElement {
  return <div aria-hidden className={['lp-glow', className].filter(Boolean).join(' ')} />
}
