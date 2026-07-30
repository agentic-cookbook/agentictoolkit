import type { ReactElement, ReactNode } from 'react'

/**
 * The flow parent of the screens. It does NOT scroll — the document does — so
 * it carries no height and no overflow.
 *
 * `tabIndex={-1}` keeps it focusable without putting it in the tab order, so a
 * click on the page leaves focus inside the content rather than on <body>, and
 * keys then scroll the nearest scrollable ancestor: the document.
 */
export function Deck({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <main tabIndex={-1} className={['lp-deck', className].filter(Boolean).join(' ')}>
      {children}
    </main>
  )
}
