'use client'

import { useLink } from '@agentic-web-toolkit/model'
import type { NavSectionConfig } from '@agentic-web-toolkit/model'

export type SectionCardProps = {
  section: NavSectionConfig
  count: number
}

export function SectionCard({ section, count }: SectionCardProps) {
  const Link = useLink()
  return (
    <Link to={section.path} className="awt-section-card">
      <div className="awt-section-card__row">
        {section.icon && <div className="awt-section-card__icon">{section.icon}</div>}
        <div className="awt-section-card__body">
          <div className="awt-section-card__head">
            <h2 className="awt-section-card__title">{section.label}</h2>
            <span className="awt-section-card__count">{count}</span>
          </div>
          {section.description && (
            <p className="awt-section-card__description">{section.description}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
