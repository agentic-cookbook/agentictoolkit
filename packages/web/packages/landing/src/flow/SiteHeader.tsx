'use client'

import type { ReactElement, ReactNode } from 'react'
import { NavChrome } from '../chrome/NavChrome'
import type { NavChromeProps } from '../chrome/types'

export interface SiteHeaderProps extends NavChromeProps {
  /** A call to action pinned to the right of the bar. */
  action?: ReactNode
}

/**
 * The flow page's header: a wordmark, an inline nav on a wide viewport, and an
 * optional action — over the drawer the deck already ships.
 *
 * It SCROLLS AWAY. That is the substantive difference from `.lp-bar`, and it is
 * why the deck's chrome could not simply be reused: a fixed bar over a flow
 * page has to be opaque enough to read against ten different band grounds
 * passing under it, which means a solid strip permanently covering the top of
 * every band's diagonal seam — the one piece of geometry the layout is built
 * on. A bar that leaves with the hero costs a reader one flick to the top and
 * keeps the seams intact.
 *
 * The drawer stays for the narrow viewport, and it is `NavChrome`'s, unchanged:
 * its focus trap, its `inert` handling while shut, and its focus-on-arrival are
 * correct and were reasoned about at length. This renders `NavChrome` and hides
 * only its BAR above the breakpoint, so the burger and drawer keep working
 * below it and nothing is reimplemented here.
 */
export function SiteHeader({ brand, links, footer, action, ...nav }: SiteHeaderProps): ReactElement {
  return (
    <>
      <header className="lp-site-bar">
        <div className="lp-site-brand">{brand}</div>
        <nav className="lp-site-nav" aria-label={nav.navLabel ?? 'Site'}>
          {links.map(({ href, label }) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        {action !== undefined && <div className="lp-site-action">{action}</div>}
      </header>
      {/* The burger and drawer, for the viewport the inline nav does not fit.
          `brand` is deliberately NOT passed: this header already shows it, and a
          second copy inside the drawer's own bar would render a wordmark on top
          of the one above it. */}
      <div className="lp-site-drawer-only">
        <NavChrome links={links} footer={footer} {...nav} />
      </div>
    </>
  )
}
