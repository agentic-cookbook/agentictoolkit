import type { ReactElement, ReactNode } from 'react'

/**
 * Single source of truth for the legal-page chrome shared by every site
 * that renders the Agentic Developer Hub footer. The matching styles ship
 * via `@agentic-toolkit/adh/legal.css` and are self-contained (theme vars
 * with on-brand fallbacks), so the pages render correctly on any host.
 */

export const LEGAL_EFFECTIVE_DATE = 'May 19, 2026'
export const LEGAL_CONTACT_EMAIL = 'hello@agenticdeveloperhub.com'

export type LegalPageShellProps = {
  prefix: string
  title: string
  children: ReactNode
}

export function LegalPageShell({ prefix, title, children }: LegalPageShellProps): ReactElement {
  return (
    <div className="adh-legal">
      <div className="adh-legal__hero">
        <div className="adh-legal__prefix">{prefix}</div>
        <div className="adh-legal__title">{title}</div>
        <div className="adh-legal__rule" />
      </div>
      <article className="adh-legal-doc">
        <p className="adh-legal-doc__meta">Effective {LEGAL_EFFECTIVE_DATE}</p>
        {children}
      </article>
    </div>
  )
}
