import type { ReactElement, ReactNode } from 'react'

/**
 * A small standalone pill — a `Hero`'s shipping status, or (same shape,
 * deliberately) one of `Chips`'s model providers. `free` marks the one status
 * that gets the accented treatment — `--lp-status-free-border` around
 * `--lp-accent-dim`.
 */
export function StatusPill({ children, free }: { children: ReactNode; free?: boolean }): ReactElement {
  const cls = ['lp-status', free === true ? 'lp-status--free' : ''].filter(Boolean).join(' ')
  return <p className={cls}>{children}</p>
}
