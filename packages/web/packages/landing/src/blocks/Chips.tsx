import type { ReactElement, ReactNode } from 'react'

/**
 * One chip in a `Chips` list. `open` marks a provider as available today —
 * note the asymmetry: the `li` carries no base chip class of its own, only
 * `lp-chip--open` when set, matching the source it was ported from.
 */
export interface ChipEntry {
  label: ReactNode
  open?: boolean
}

/**
 * A wrapped row of provider chips. `soon` swaps the list to the dashed,
 * dimmed, accent-free treatment used for planned agents — see the `.lp-roadmap`
 * comment in `css/blocks.css` for why that separation is structural rather
 * than a caveat in prose.
 */
export function Chips({ entries, soon }: { entries: ChipEntry[]; soon?: boolean }): ReactElement {
  const listCls = ['lp-chips', soon === true ? 'lp-chips--soon' : ''].filter(Boolean).join(' ')
  return (
    <ul className={listCls}>
      {entries.map((entry, i) => (
        <li key={i} className={entry.open === true ? 'lp-chip--open' : undefined}>
          {entry.label}
        </li>
      ))}
    </ul>
  )
}
