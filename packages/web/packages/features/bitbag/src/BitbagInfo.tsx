'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * Where else bitbag lives. He's a persona, not a feature of whatever site he's
 * docked on — he has a home of his own and an entry in the registry — so the dock
 * carries a way out to both rather than pretending he belongs to the host.
 *
 * The URL is shown scheme-less: the address is the label, not a string to parse.
 * Absolute, and deliberately not host-configurable — these are HIS addresses, the
 * same two from every site he appears on, including his own.
 */
const LINKS: readonly { label: string; href: string; shown: string }[] = [
  {
    label: 'visit Bitbag’s home page',
    href: 'https://bitbag.ai',
    shown: 'bitbag.ai',
  },
  {
    label: 'visit Bitbag’s public profile',
    href: 'https://agenticpersonaregistry.com/bitbag',
    shown: 'agenticpersonaregistry.com/bitbag',
  },
]

/**
 * The `i` on the corner of the chat box, and the panel it opens.
 *
 * It owns its own open state and its own dismissal — a pointer down anywhere
 * outside it, or Escape — so the dock doesn't have to know it exists beyond
 * giving it a corner to sit on. Both listeners are on the document, because the
 * gesture that closes a popup is by definition one that lands somewhere else.
 */
export function BitbagInfo(): ReactNode {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // Ties the trigger to the panel for `aria-controls`. Per-instance rather than a
  // module constant: the dock is a shared component and nothing stops a page from
  // mounting two.
  const popId = useId()

  // Announcing a dialog and then leaving focus behind the button that opened it
  // means a screen reader hears "expanded" and lands nowhere — the two links are
  // reachable only by guessing that Tab now goes somewhere new. Focus follows the
  // panel in, and comes back to the `i` when it closes, so the keyboard path in
  // and out is the same one the pointer takes. Deliberately NOT `aria-modal`: the
  // panel does not trap focus and should not (the chat behind it stays live), and
  // claiming modality that isn't implemented is worse than not claiming it.
  const opened = useRef(false)
  useEffect(() => {
    if (open) {
      opened.current = true
      popRef.current?.focus()
    } else if (opened.current) {
      // Only ever RETURN focus, never claim it: this effect also runs on mount
      // with `open` false, and focusing the `i` there would yank the caret out of
      // whatever the visitor was doing the moment any footer rendered.
      opened.current = false
      btnRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const root = rootRef.current
    // `pointerdown`, not `click`: the chat's own sizing hook folds the box on
    // pointerdown too, so closing on the same phase keeps the two in step
    // instead of leaving the panel hanging over a collapsing box.
    const onPointerDown = (e: PointerEvent): void => {
      if (!root?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="bb-info" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="bb-info__btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popId}
        aria-label="About bitbag"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <div
          ref={popRef}
          id={popId}
          // Focusable as a container, not as a stop: -1 takes focus programmatically
          // (above) while leaving the Tab order to the links inside it.
          tabIndex={-1}
          className="bb-info__pop"
          role="dialog"
          aria-label="About bitbag"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              className="bb-info__link"
              href={link.href}
              // A NEW TAB, because bitbag is a guest here. He is docked on a site
              // that is about something else, and following him home in the same
              // tab throws that site away mid-task — a half-filled form, a scroll
              // position, the chat the visitor was having with him — for what reads
              // as a footnote about the mascot. `noopener` because these open with
              // `target`, and the opener reference is not theirs to have.
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              {link.label}
              <span className="bb-info__url">{link.shown}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
