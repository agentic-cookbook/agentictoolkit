import type { ReactElement, ReactNode } from 'react'

/**
 * The flow parent of the screens. It does NOT scroll — the document does — so
 * it carries no height and no overflow.
 *
 * `tabIndex={-1}` keeps it focusable without putting it in the tab order, so a
 * click on the page leaves focus inside the content rather than on <body>, and
 * keys then scroll the nearest scrollable ancestor: the document.
 *
 * It is a `<div>`, and NOT a `<main>`. It was one, and that shipped: every
 * consumer renders the deck as a page inside a host shell that already draws the
 * page's `<main>` landmark, so the deck put a second one inside the first. Two
 * `main`s is invalid HTML and, worse, is announced as two "main" landmarks with
 * no way to tell which holds the page — a screen reader jumping to the main
 * content gets a choice it should never have been offered. A host that has no
 * shell of its own can give the deck the landmark from outside, which is the
 * only place that can know whether one is already there. The class is what the
 * CSS is written against (`base.css` gates the whole file on `:has(.lp-deck)`),
 * so nothing visual rests on the element.
 */
export function Deck({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return (
    <div tabIndex={-1} className={['lp-deck', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
