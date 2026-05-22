'use client'

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
      <div className="adh-footer__container">
        {copyright && <span className="adh-footer__copyright">{copyright}</span>}
        <nav className="adh-footer__links" aria-label="Footer">
          {links.map((link) => (
            <a key={link.href + link.label} href={link.href} className="adh-footer__link">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
