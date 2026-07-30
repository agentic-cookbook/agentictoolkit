import type { ReactElement, ReactNode } from 'react'

/**
 * The trust strip: the things a visitor wants settled before they read a
 * feature list. Deliberately not `Cards` — these are claims, not features,
 * and boxing them would give them the same weight as the product's actual
 * capabilities.
 */
export function Trust({ items }: { items: ReactNode[] }): ReactElement {
  return (
    <ul className="lp-trust">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
