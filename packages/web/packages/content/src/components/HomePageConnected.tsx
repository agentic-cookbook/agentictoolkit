'use client'

import { useContent } from '@agentic-toolkit/model'
import { useSiteConfig } from '@agentic-toolkit/model'
import { HomePage } from './HomePage'

export function HomePageConnected() {
  const { entries, getBySection } = useContent()
  const { hero, nav } = useSiteConfig()
  const sections = nav.sections.map((section) => ({
    section,
    count: section.fixedCount ?? getBySection(section.key).length,
  }))
  return (
    <HomePage
      hero={hero}
      sections={sections}
      entryCount={entries.length}
      externalLinks={nav.externalLinks}
    />
  )
}
