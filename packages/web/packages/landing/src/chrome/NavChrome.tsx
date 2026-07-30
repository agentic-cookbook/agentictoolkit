'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import type { NavChromeProps } from './types'

/**
 * Fixed header, burger, drawer and scrim. Burger and drawer share one `open`
 * boolean, so they live in one client component.
 */
export function NavChrome({
  brand,
  links,
  footer,
  openLabel = 'Open menu',
  closeLabel = 'Close menu',
  dismissLabel = 'Dismiss menu',
  navLabel = 'Site',
}: NavChromeProps): ReactElement {
  const [open, setOpen] = useState(false)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  /**
   * A closed drawer is only moved off-screen by a transform, and a transform
   * doesn't take anything out of the tab order — so without `inert` below, the
   * close button, every link and the mailto stay reachable by Tab while
   * invisible, stranding a keyboard reader on controls they cannot see. `inert`
   * hides them from assistive tech too, which `tabIndex={-1}` alone would not.
   *
   * Focus then has to follow the drawer by hand: into it on open, back to the
   * burger that summoned it on close. `wasOpen` gates the return so the first
   * render doesn't steal focus on page load.
   */
  useEffect(() => {
    if (open) closeRef.current?.focus()
    else if (wasOpen.current) burgerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  // Escape is the expected way out of any overlay, and it's the only exit that
  // works when the pointer never enters the picture.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  /**
   * Drive the jump ourselves rather than letting the browser follow the hash.
   * The href stays real, so this still degrades to a plain anchor with JS off.
   * The trip itself needs no code at all any more — `scroll-behavior: smooth`
   * on the host's `html` eases it — so all that's left here is the one thing
   * CSS cannot do: move focus onto the target so a screen reader announces
   * where the reader has arrived, instead of silently re-reading the page.
   * `tabindex="-1"` is what makes an arbitrary target focusable at all; it's
   * set here rather than in static markup because it exists only for this
   * handler.
   */
  const go = (event: MouseEvent<HTMLAnchorElement>, href: string): void => {
    // Closing the drawer is unconditional — a host can legitimately pass a
    // link whose target isn't on THIS page (an off-page href, or a same-page
    // anchor that doesn't resolve), and the drawer must not stay open just
    // because the enhancement below has nothing to attach to. Only the jump
    // itself is conditional on finding a target.
    setOpen(false)
    const target = document.querySelector<HTMLElement>(href)
    if (!target) return // let the browser try; nothing to improve on
    event.preventDefault()
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.scrollIntoView()
  }

  return (
    <>
      <header className="lp-bar">
        <button
          ref={burgerRef}
          type="button"
          className="lp-burger"
          aria-label={openLabel}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="lp-brand">{brand}</div>
      </header>

      <button
        type="button"
        className={`lp-scrim${open ? ' lp-scrim--show' : ''}`}
        // The original component gave this the same "Close menu" label as the
        // dedicated close button below, which is fine for a sighted pointer
        // user but leaves two controls with an identical accessible name for
        // anyone finding them by label — a real, if minor, port fix rather
        // than a behaviour change: this button still closes the drawer either
        // way, it's just distinguishable now.
        aria-label={dismissLabel}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <nav className={`lp-drawer${open ? ' lp-drawer--open' : ''}`} aria-label={navLabel} inert={!open}>
        <button
          ref={closeRef}
          type="button"
          className="lp-burger lp-drawer-close"
          aria-label={closeLabel}
          onClick={() => setOpen(false)}
        >
          {/* Two bars, crossed into an X by .lp-drawer-close in chrome.css —
              where the bar geometry they're derived from lives. */}
          <span />
          <span />
        </button>
        {links.map(({ href, label }) => (
          <a key={href} className="lp-nav" href={href} onClick={(event) => go(event, href)}>
            {label}
          </a>
        ))}
        {footer !== undefined && <div className="lp-foot">{footer}</div>}
      </nav>
    </>
  )
}
