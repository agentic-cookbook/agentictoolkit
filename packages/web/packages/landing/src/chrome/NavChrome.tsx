'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import type { NavChromeProps } from './types'

/**
 * The element id a same-page href names, or `null` if it names anything else.
 *
 * An href is a URL, not a CSS selector, and the two are not interchangeable:
 * `document.querySelector('mailto:hi@example.com')` throws a `SyntaxError`
 * rather than returning null, as does any `/path` with a dot in it. `go` below
 * says a host may legitimately pass an off-page link — so parsing the href as a
 * selector would blow up on exactly the links the code claims to tolerate.
 *
 * Resolving to an id and using `getElementById` is also what keeps an id like
 * `2024-results` working: legal in HTML, and a selector parse error.
 */
function fragmentId(href: string): string | null {
  // A bare '#' is the top of the page, which the browser already handles.
  if (!href.startsWith('#') || href.length === 1) return null
  const raw = href.slice(1)
  try {
    // Non-ASCII ids arrive percent-encoded; a hand-written href can also carry
    // a stray '%', on which decodeURIComponent throws.
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * Fixed bar, burger, drawer and scrim. Burger and drawer share one `open`
 * boolean, so they live in one client component.
 *
 * Two hosts now: the landing site this was extracted from, whose own wordmark
 * sits in this bar, and a host that already has a site header of its own and
 * wants only the burger and drawer under it. `brand` is what separates them,
 * and `--lp-chrome-top` (chrome.css) is what moves the whole chrome — bar,
 * scrim and drawer — down past that header. Nothing here reads a breakpoint or
 * a pixel: the offsets are the host's tokens.
 */
export function NavChrome({
  brand,
  links,
  footer,
  openLabel = 'Open menu',
  closeLabel = 'Close menu',
  navLabel = 'Site',
}: NavChromeProps): ReactElement {
  const [open, setOpen] = useState(false)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
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
   * render doesn't steal focus on page load — and `go()` clears it deliberately,
   * because a close that came from picking a link has already sent focus
   * somewhere better.
   */
  useEffect(() => {
    if (open) closeRef.current?.focus()
    else if (wasOpen.current) burgerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  /**
   * The two keys the open drawer owns, on one listener because they are one
   * contract: while it is up, the keyboard is inside it.
   *
   * **Escape** is the expected way out of any overlay, and the only exit that
   * works when the pointer never enters the picture.
   *
   * **Tab** is held inside. The scrim covers everything under the drawer, so
   * every control Tab would otherwise reach next is one the reader can neither
   * see nor click — they would be tabbing through the page they just asked to
   * leave, with no way of knowing where they are. The drawer is modal to the
   * pointer already; this is the same statement to the keyboard. (`inert`
   * covers the drawer while it is SHUT — the mirror image, and easy to mistake
   * for this.)
   *
   * On `document` rather than as an `onKeyDown` on the `<nav>`: a handler there
   * only sees Tab when focus is already inside, so focus landing anywhere else
   * — a stray click on the scrim, a browser restoring it after an alt-tab —
   * would step straight out into the covered page with nothing to catch it.
   * From here, "not inside" is just another case, and it pulls focus back to
   * the close button.
   *
   * The focusables are read from the DOM at the moment Tab is pressed rather
   * than held in refs: they are the close button, the links and whatever the
   * host put in the foot, all rendered right here, so a host adding a row costs
   * nothing. Escape and the close button are still real exits, so the hold
   * cannot strand anyone.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const nav = navRef.current
      if (!nav) return
      const focusable = nav.querySelectorAll<HTMLElement>('button, a[href]')
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (!nav.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
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
    const id = fragmentId(href)
    const target = id === null ? null : document.getElementById(id)
    if (!target) return // let the browser try; nothing to improve on
    event.preventDefault()
    // Clear the focus-return BEFORE handing focus to the target. The effect
    // above runs after this handler and returns focus to the burger on every
    // open→closed transition, so left set it would take the focus placed two
    // lines below and hand it straight back to the corner of the window,
    // announcing the menu button instead of the screen the reader chose. The
    // restore is for a dismissal; this is an arrival — and it stays set on the
    // off-page path above, where there is no arrival to announce.
    wasOpen.current = false
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.scrollIntoView()
  }

  return (
    <>
      {/* A plain div, not a <header>. It was one, and it read as a landmark
          only by accident: a <header> is a `banner` unless it descends from
          main/article/aside/nav/section, and what suppressed it was `Deck`
          rendering a <main> — which it no longer does, since every host shell
          already draws that landmark. Left as a <header> the bar would become a
          SECOND banner beside the host's own site header on every generated
          deck. It is a floating burger and an optional wordmark, so there is
          nothing here a landmark would be announcing. */}
      <div className="lp-bar">
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
        {brand !== undefined && <div className="lp-brand">{brand}</div>}
      </div>

      {/* A scrim, not a control: it dismisses on click for a pointer user, and
          is neither focusable nor announced. It was a labelled <button> here
          until the Tab trap above went in, and the trap is what settles it —
          focus is held inside the drawer while it is open, so a button out here
          can never be reached by keyboard however it is labelled, leaving only
          the cost: a full-viewport control read out as covering the page, with
          the same "close the menu" meaning as the button three lines below.
          `@agentic-toolkit/ui`'s DocNav drawer answers this the same way, and
          two drawers in one toolkit should not answer it differently. Escape
          and the close button are the keyboard paths. */}
      <div
        aria-hidden="true"
        className={`lp-scrim${open ? ' lp-scrim--show' : ''}`}
        onClick={() => setOpen(false)}
      />

      <nav
        ref={navRef}
        className={`lp-drawer${open ? ' lp-drawer--open' : ''}`}
        aria-label={navLabel}
        inert={!open}
      >
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
