'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

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
        type="button"
        className="bb-info__btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="About bitbag"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <div className="bb-info__pop" role="dialog" aria-label="About bitbag">
          {LINKS.map((link) => (
            <a
              key={link.href}
              className="bb-info__link"
              href={link.href}
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
