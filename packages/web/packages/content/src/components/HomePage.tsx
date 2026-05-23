import type { ReactNode } from 'react'
import type { HeroConfig, NavSectionConfig, ExternalLink } from '@agentic-toolkit/model'
import { SectionCard } from './SectionCard'

export type HomePageSectionEntry = {
  section: NavSectionConfig
  count: number
}

export type HomePageProps = {
  hero: HeroConfig
  sections: HomePageSectionEntry[]
  entryCount: number
  externalLinks?: ExternalLink[]
  metaSlot?: ReactNode
}

export function HomePage({
  hero,
  sections,
  entryCount,
  externalLinks,
  metaSlot,
}: HomePageProps) {
  return (
    <div className="awt-home">
      <div className="awt-home__hero">
        <h1 className="awt-home__heading">{hero.heading}</h1>

        {externalLinks && externalLinks.length > 0 && (
          <div className="awt-home__external">
            {externalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="awt-home__external-link"
              >
                {link.icon && <span className="awt-home__external-icon">{link.icon}</span>}
                <span>
                  <span className="awt-home__external-label">{link.label}</span>
                  {link.description && (
                    <span className="awt-home__external-description">{link.description}</span>
                  )}
                </span>
              </a>
            ))}
          </div>
        )}

        {hero.body && (
          <div className="awt-home__body">
            <div className="awt-home__body-text">{hero.body}</div>
          </div>
        )}

        <div className="awt-home__meta">
          {metaSlot ?? hero.meta ?? (
            <>
              <span>{entryCount} documents</span>
              <span className="awt-home__meta-divider">|</span>
              <span>{sections.length} sections</span>
            </>
          )}
        </div>
      </div>

      <hr className="awt-home__rule" />

      <div className="awt-home__sections">
        {sections.map(({ section, count }) => (
          <SectionCard key={section.key} section={section} count={count} />
        ))}
      </div>
    </div>
  )
}
