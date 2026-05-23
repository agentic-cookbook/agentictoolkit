'use client'

import { useLink } from '@agentic-toolkit/model'
import type { SiteEntry } from '@agentic-toolkit/model'

export type EntryCardProps = {
  entry: SiteEntry
}

export function EntryCard({ entry }: EntryCardProps) {
  const Link = useLink()
  const summary = entry.frontmatter.summary
  return (
    <Link to={entry.slug} className="awt-entry-card">
      <h3 className="awt-entry-card__title">{entry.frontmatter.title}</h3>
      {summary && <p className="awt-entry-card__summary">{String(summary)}</p>}
    </Link>
  )
}
