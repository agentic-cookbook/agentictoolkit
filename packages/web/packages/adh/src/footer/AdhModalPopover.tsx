'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export type AdhModalPopoverProps = {
  /** DOM id — triggers open it via `popovertarget={id}` (or showPopover()). */
  id: string
  /** Heading shown in the modal header (left of the close box). */
  title: string
  children: ReactNode
  /** Extra class on the scrollable body wrapper (e.g. for legal prose). */
  bodyClassName?: string
}

/**
 * A modal dialog built on the native HTML Popover API (top layer + backdrop +
 * Escape + light-dismiss, all native), styled with a header (title + close box)
 * and a scrollable body. Used by the footer's Sites / Terms / Privacy triggers.
 *
 * Popover (not <dialog>) so it stays declarative — a `popovertarget` button opens
 * it and the header's `popovertargetaction="hide"` button closes it with no JS —
 * and so the header site-switcher keeps opening the sites overview via the same
 * id. role/aria make it announce as a modal dialog.
 */
export function AdhModalPopover({ id, title, children, bodyClassName }: AdhModalPopoverProps) {
  const titleId = `${id}-title`
  return (
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // Focusable so a programmatic opener (the switcher's "?" / "help") can move
      // focus in, enabling native Escape-to-dismiss.
      tabIndex={-1}
      className="adh-modal"
    >
      <div className="adh-modal__header">
        <h2 id={titleId} className="adh-modal__title">
          {title}
        </h2>
        <button
          type="button"
          className="adh-modal__close"
          popoverTarget={id}
          popoverTargetAction="hide"
          aria-label="Close"
        >
          <X className="adh-modal__close-icon" aria-hidden />
        </button>
      </div>
      <div className={`adh-modal__body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {children}
      </div>
    </div>
  )
}
