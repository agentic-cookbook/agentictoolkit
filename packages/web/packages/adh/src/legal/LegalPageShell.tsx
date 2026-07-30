import type { ReactElement, ReactNode } from 'react'

/**
 * Single source of truth for the legal-page chrome shared by every site in
 * a family that renders one common legal footer. The matching styles ship
 * via `@agentic-toolkit/adh/legal.css` and are self-contained (theme vars
 * with on-brand fallbacks), so the pages render correctly on any host.
 */

export type LegalPageShellProps = {
  prefix: string
  title: string
  /** Rendered as "Effective <date>". Supplied by the host — the date is the
   *  host's legal fact, not the shell's. */
  effectiveDate: string
  children: ReactNode
}

export function LegalPageShell({
  prefix,
  title,
  effectiveDate,
  children,
}: LegalPageShellProps): ReactElement {
  return (
    <div className="adh-legal">
      <div className="adh-legal__hero">
        <div className="adh-legal__prefix">{prefix}</div>
        <div className="adh-legal__title">{title}</div>
        <div className="adh-legal__rule" />
      </div>
      <article className="adh-legal-doc">
        <p className="adh-legal-doc__meta">Effective {effectiveDate}</p>
        {children}
      </article>
    </div>
  )
}
