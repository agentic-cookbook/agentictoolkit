'use client'

import Link from 'next/link'

export type FooterLink = {
  label: string
  href: string
}

export type AdhFooterProps = {
  links?: FooterLink[]
  copyright?: string
}

const DEFAULT_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
]

export function AdhFooter({ links = DEFAULT_LINKS, copyright }: AdhFooterProps) {
  return (
    <footer className="adh-footer" role="contentinfo">
      <div className="adh-footer__container">
        {copyright && <span className="adh-footer__copyright">{copyright}</span>}
        {links.length > 0 && (
          <nav className="adh-footer__links" aria-label="Footer">
            {links.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="adh-footer__link"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  )
}
