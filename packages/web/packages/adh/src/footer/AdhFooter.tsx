'use client'

import { Fragment } from 'react'

export type FooterLink = {
  label: string
  href: string
}

export type AdhFooterProps = {
  links?: FooterLink[]
  copyright?: string
}

const DEFAULT_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/legal/privacy' },
]

export function AdhFooter({ links = DEFAULT_LINKS, copyright }: AdhFooterProps) {
  return (
    <footer className="adh-footer" role="contentinfo">
      <nav aria-label="Footer">
        {copyright && <span>{copyright}</span>}
        {links.map((link, i) => (
          <Fragment key={link.href + link.label}>
            {(copyright || i > 0) && <span className="adh-footer__sep" aria-hidden="true" />}
            <a href={link.href} className="adh-footer__link">
              {link.label}
            </a>
          </Fragment>
        ))}
      </nav>
    </footer>
  )
}
