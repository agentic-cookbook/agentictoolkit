import type { ReactElement, ReactNode } from 'react'

/**
 * The flow parent of the bands — the deck's `Deck`, without the deck.
 *
 * Same two properties for the same two reasons: it does NOT scroll (the
 * document does), so it carries no height and no overflow; and `tabIndex={-1}`
 * keeps it focusable without putting it in the tab order, so a click on the
 * page leaves focus inside the content and keys then scroll the nearest
 * scrollable ancestor, which is the document.
 *
 * What it drops is everything the snap deck needed and a flow page does not:
 * no per-section viewport reservation, no snap alignment, no arming script.
 * See `Band` for what replaces a `Screen`.
 */
export function Flow({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <main tabIndex={-1} className={['lp-flow', className].filter(Boolean).join(' ')}>
      {children}
    </main>
  )
}
