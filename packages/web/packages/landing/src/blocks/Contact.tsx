import type { ReactElement, ReactNode } from 'react'
import { Closer } from './Closer'

export interface ContactProps {
  title: ReactNode
  children: ReactNode
  mail: { href: string; label: ReactNode }
  colophon?: ReactNode
}

/**
 * The page's last word: the closing argument, a mailto, and an optional
 * colophon. Composes `Closer` rather than duplicating its markup, so the
 * rendered element carries both `lp-closer` and `lp-contact` — the source
 * page has `class="closer contact"` on one div for the same reason. See the
 * `.lp-closer.lp-contact` comment in `css/blocks.css` for why that has to stay
 * a compound selector rather than a bare `.lp-contact`.
 */
export function Contact({ title, children, mail, colophon }: ContactProps): ReactElement {
  return (
    <Closer title={title} className="lp-contact">
      {children}
      <a className="lp-mail" href={mail.href}>
        {mail.label}
      </a>
      {colophon !== undefined && <p className="lp-colophon">{colophon}</p>}
    </Closer>
  )
}
