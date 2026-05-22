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
    <footer
      className="flex h-14 items-center gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text-secondary)]"
      role="contentinfo"
    >
      {copyright && <span>{copyright}</span>}
      <div className="flex-1" />
      <nav className="flex items-center gap-4" aria-label="Footer">
        {links.map((link) => (
          <a
            key={link.href + link.label}
            href={link.href}
            className="hover:text-[var(--color-accent)]"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  )
}
