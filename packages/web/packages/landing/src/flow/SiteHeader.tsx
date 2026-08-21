'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { NavChrome } from '../chrome/NavChrome'
import type { NavChromeProps } from '../chrome/types'

export interface SiteHeaderProps extends NavChromeProps {
  /**
   * A call to action pinned to the right of the bar, ABOVE the breakpoint only
   * — the same rule the inline nav follows, and not a cosmetic one: below it
   * the bar is the burger and the wordmark, and the wordmark is centred by
   * being the row's only visible item. A third control on that line moves the
   * centre off the viewport's, on the one viewport where the arrangement is
   * load-bearing. `flow.css`'s `.lp-site-action` carries the full account. A
   * host whose action is a link to a section should therefore make sure that
   * section is also in `links`, since the drawer is the narrow viewport's only
   * route to it.
   */
  action?: ReactNode
  /**
   * The inline bar's own link list, shorter than `links`. Defaults to
   * `links` — a host with few enough links to fit the bar and the drawer
   * both need not supply two lists. The drawer always renders the full
   * `links`; only the bar substitutes this one.
   *
   * Read only when `bar` is `'nav'`; the drawer arrangement renders no inline
   * list at all.
   */
  barLinks?: NavChromeProps['links']
  /**
   * Which navigation the header carries, and the choice is about the WIDE
   * viewport — below the breakpoint both settings are the burger and the
   * drawer, because that is the only arrangement that fits.
   *
   * `'nav'` (default) puts the link row and the action in the bar above the
   * breakpoint and drops the burger there. `'drawer'` keeps the burger at
   * every width, renders no link row, and lets the drawer be the whole
   * navigation — the arrangement `NavChrome` has always had on its own, with
   * this header supplying the wordmark and the action around it.
   *
   * It is a real editorial choice rather than a density fallback: a link row
   * advertises the page's sections to a reader who is scanning, and a burger
   * keeps the top of the page quiet and asks them to open it. A host with
   * twelve sections and one thesis usually wants the second.
   */
  bar?: 'nav' | 'drawer'
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
 *
 * `bar="drawer"` stops that hiding: the burger then stays at every width and
 * the link row is never rendered. See the prop's own doc for when a host wants
 * that.
 */
export function SiteHeader({
  brand,
  links,
  barLinks = links,
  footer,
  action,
  bar = 'nav',
  ...nav
}: SiteHeaderProps): ReactElement {
  const drawerAlways = bar === 'drawer'
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
    // decision rather than restating it. Under `bar="drawer"` the wrapper is
    // never hidden, so the observer simply never sees the transition — which is
    // correct, not a case to special-case: there is no breakpoint to cross.
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
      <header className={drawerAlways ? 'lp-site-bar lp-site-bar--drawer' : 'lp-site-bar'}>
        {brand !== undefined && <div className="lp-site-brand">{brand}</div>}
        {/* Not rendered at all under `bar="drawer"`, rather than hidden in CSS:
            the row's links are real anchors, and a `display: none` list is a
            dozen duplicate in-page destinations that a crawler still reads and
            an assistive reader can still reach through a rotor. The drawer's
            copy is the one that should be found. */}
        {!drawerAlways && (
          <nav className="lp-site-nav" aria-label={nav.navLabel ?? 'Site'}>
            {barLinks.map(({ href, label }) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        )}
        {action !== undefined && <div className="lp-site-action">{action}</div>}
      </header>
      {/* The burger and drawer — for the viewport the inline nav does not fit,
          and for every viewport under `bar="drawer"`. `brand` is deliberately
          NOT passed: this header already shows it, and a second copy inside the
          drawer's own bar would render a wordmark on top of the one above it. */}
      <div
        className={drawerAlways ? 'lp-site-drawer-only lp-site-drawer-only--always' : 'lp-site-drawer-only'}
        ref={drawerRef}
      >
        <NavChrome key={generation} links={links} footer={footer} {...nav} />
      </div>
    </>
  )
}
