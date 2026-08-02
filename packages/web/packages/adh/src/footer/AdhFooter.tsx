'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

export type FooterLink =
  /** A real navigation link. `onSelect` is optional progressive enhancement: it runs on a
   *  plain left-click and may `preventDefault()` to handle the click itself. The `href`
   *  stays in the server HTML either way, so the link is never dead without JS.
   *  `prefetch` is passed straight through to next/link — leave it `undefined` to keep
   *  Next's own default (host decides per-link; the toolkit takes no position). */
  | {
      label: string
      href: string
      onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void
      prefetch?: boolean
    }
  /** A native popover trigger: `popovertarget` opens the panel with NO client JS. Carries
   *  the `adh-footer__sites-trigger` class, which a host stylesheet may use to hide it in
   *  browsers without the Popover API — where it cannot degrade to anything. */
  | { label: string; popoverTarget: string; ariaLabel?: string }

export type AdhFooterProps = {
  links?: FooterLink[]
  copyright?: ReactNode
  /** Build identity, rendered last INSIDE the container. Deliberately a prop and
   *  not an env read: this is the registry-free primitive and stays free of adh
   *  knowledge — the host decides what a version even is. */
  version?: ReactNode
  trailing?: ReactNode
}

export function AdhFooter({ links = [], copyright, version, trailing }: AdhFooterProps) {
  return (
    <footer className="adh-footer" role="contentinfo">
      <div className="adh-footer__container">
        {copyright && <span className="adh-footer__copyright">{copyright}</span>}
        {links.length > 0 && (
          <nav className="adh-footer__links" aria-label="Footer">
            {links.map((link) =>
              'popoverTarget' in link ? (
                <button
                  key={`popover:${link.popoverTarget}`}
                  type="button"
                  popoverTarget={link.popoverTarget}
                  aria-label={link.ariaLabel}
                  className="adh-footer__link adh-footer__sites-trigger"
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={`href:${link.href}:${link.label}`}
                  href={link.href}
                  className="adh-footer__link"
                  onClick={link.onSelect}
                  prefetch={link.prefetch}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        )}
        {version && <span className="adh-footer__version">{version}</span>}
      </div>
      {trailing}
    </footer>
  )
}
