import type { SiteEntry } from '@agentic-toolkit/model'
import { EntryCard } from './EntryCard'

export type SubsectionGroup = {
  label: string
  entries: SiteEntry[]
}

export type SectionIndexProps = {
  title: string
  topLevelEntries: SiteEntry[]
  groups: SubsectionGroup[]
  countLabel?: string
}

export function SectionIndex({
  title,
  topLevelEntries,
  groups,
  countLabel,
}: SectionIndexProps) {
  const total =
    topLevelEntries.length +
    groups.reduce((acc, g) => acc + g.entries.length, 0)
  const label = countLabel ?? `${total} document${total === 1 ? '' : 's'}`
  return (
    <div className="awt-section-index">
      <div className="awt-section-index__head">
        <h1 className="awt-section-index__title">{title}</h1>
        <p className="awt-section-index__count">{label}</p>
      </div>
      <div className="awt-section-index__groups">
        {topLevelEntries.length > 0 && (
          <div className="awt-section-index__grid">
            {topLevelEntries.map((entry) => (
              <EntryCard key={entry.slug} entry={entry} />
            ))}
          </div>
        )}
        {groups.map(({ label: groupLabel, entries }) => (
          <div key={groupLabel}>
            <h2 className="awt-section-index__group-title">{groupLabel}</h2>
            <div className="awt-section-index__grid">
              {entries.map((entry) => (
                <EntryCard key={entry.slug} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
