import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SectionIndex } from '../SectionIndex'
import type { SiteEntry } from '@agentic-web-toolkit/model'

const mk = (slug: string, title: string): SiteEntry => ({
  slug,
  section: 'guides',
  raw: '',
  html: '',
  headings: [],
  frontmatter: { title },
})

describe('SectionIndex', () => {
  it('renders title, count, and ungrouped entries', () => {
    const { container } = render(
      <SectionIndex
        title="Guides"
        topLevelEntries={[mk('/guides/install', 'Install'), mk('/guides/configure', 'Configure')]}
        groups={[]}
      />,
    )
    expect(container.querySelector('.awt-section-index__title')?.textContent).toBe('Guides')
    expect(container.querySelector('.awt-section-index__count')?.textContent).toBe('2 documents')
    expect(container.querySelectorAll('.awt-entry-card').length).toBe(2)
  })

  it('renders subsection groups', () => {
    const { container } = render(
      <SectionIndex
        title="Guides"
        topLevelEntries={[]}
        groups={[
          { label: 'Setup', entries: [mk('/guides/setup/install', 'Install')] },
          { label: 'Tuning', entries: [mk('/guides/tuning/perf', 'Perf')] },
        ]}
      />,
    )
    const titles = Array.from(
      container.querySelectorAll('.awt-section-index__group-title'),
    ).map((n) => n.textContent)
    expect(titles).toEqual(['Setup', 'Tuning'])
    expect(container.querySelectorAll('.awt-entry-card').length).toBe(2)
  })
})
