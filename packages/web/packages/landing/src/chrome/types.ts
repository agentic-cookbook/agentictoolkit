import type { ReactNode } from 'react'

export interface NavLink {
  href: string
  label: string
}

export interface NavChromeProps {
  /**
   * The wordmark, rendered centred in the fixed bar. Optional: a host that
   * already has its own site header has no second wordmark to draw, and an
   * empty `.lp-brand` would still occupy the middle of the bar. Omit it and
   * the bar carries the burger alone — see `--lp-chrome-top` in chrome.css
   * for putting that burger below the host's header rather than over it.
   */
  brand?: ReactNode
  links: NavLink[]
  /** Rendered in the drawer's foot — a mailto, a byline, whatever. */
  footer?: ReactNode
  /** Accessible name for the open button. Default "Open menu". */
  openLabel?: string
  /** Accessible name for the close button. Default "Close menu". */
  closeLabel?: string
  /** Accessible name for the drawer's <nav> landmark. Default "Site". */
  navLabel?: string
}
