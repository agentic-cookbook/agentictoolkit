import type { ReactNode } from 'react'

export interface NavLink {
  href: string
  label: string
}

export interface NavChromeProps {
  /** The wordmark. Rendered inside the fixed bar; not a control. */
  brand: ReactNode
  links: NavLink[]
  /** Rendered in the drawer's foot — a mailto, a byline, whatever. */
  footer?: ReactNode
  /** Accessible name for the open button. Default "Open menu". */
  openLabel?: string
  /** Accessible name for the close button. Default "Close menu". */
  closeLabel?: string
  /** Accessible name for the scrim that dismisses the drawer. Default "Dismiss menu". */
  dismissLabel?: string
  /** Accessible name for the drawer's <nav> landmark. Default "Site". */
  navLabel?: string
}
