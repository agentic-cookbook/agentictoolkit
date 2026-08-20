'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { NavChrome } from '../chrome/NavChrome'
import type { NavChromeProps } from '../chrome/types'

export interface SiteHeaderProps extends NavChromeProps {
  /** A call to action pinned to the right of the bar. */
  action?: ReactNode
  /**
   * The inline bar's own link list, shorter than `links`. Defaults to
   * `links` — a host with few enough links to fit the bar and the drawer
   * both need not supply two lists. The drawer always renders the full
   * `links`; only the bar substitutes this one.
   */
  barLinks?: NavChromeProps['links']
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
export function SiteHeader({ brand, links, barLinks = links, footer, action, ...nav }: SiteHeaderProps): ReactElement {
  const drawerRef = useRef<HTMLDivElement>(null)
  // Bumped to remount NavChrome, which is the only way to reset its `open`
  // state from out here — it owns that state and exposes no way to close.
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const el = drawerRef.current
    if (el === null) return
    // Why observe the box instead of matching the breakpoint in JS: the
    // wrapper's visibility is decided by a media query in flow.css, and a
    // `matchMedia('(min-width: 62rem)')` here would be a SECOND statement of
    // that breakpoint which a later edit can update in only one place. A
    // display:none element reports a 0x0 box, so the observer reads the CSS's
    // decision rather than restating it.
    //
    // What it fixes: NavChrome's Tab trap is keyed on `open`, not on whether
    // the drawer can be seen. Left open across a resize past the breakpoint,
    // the listener stays attached over a display:none subtree, preventDefault()
    // fires on every Tab, and focus() on a hidden element is a no-op — Tab does
    // nothing on the entire page until Escape is pressed. Remounting on the
    // way out drops the listener with the component.
    let visible = el.getBoundingClientRect().width > 0
    const ro = new ResizeObserver(() => {
      const now = el.getBoundingClientRect().width > 0
      if (visible && !now) setGeneration((n) => n + 1)
      visible = now
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <header className="lp-site-bar">
        {brand !== undefined && <div className="lp-site-brand">{brand}</div>}
        <nav className="lp-site-nav" aria-label={nav.navLabel ?? 'Site'}>
          {barLinks.map(({ href, label }) => (
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
      <div className="lp-site-drawer-only" ref={drawerRef}>
        <NavChrome key={generation} links={links} footer={footer} {...nav} />
      </div>
    </>
  )
}
