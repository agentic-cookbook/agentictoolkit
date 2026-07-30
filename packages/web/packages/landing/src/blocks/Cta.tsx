import type { ReactElement, ReactNode } from 'react'

/** The button row under a `Hero`'s tagline, or a `Closer`'s. */
export function Cta({ children }: { children: ReactNode }): ReactElement {
  return <div className="lp-cta">{children}</div>
}
