import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EntryCard } from '../EntryCard'
import type { SiteEntry } from '@agentic-web-toolkit/model'

const entry: SiteEntry = {
  slug: '/guides/install',
  section: 'guides',
  raw: '',
  html: '',
  headings: [],
  frontmatter: { title: 'Install', summary: 'How to install' },
}

describe('EntryCard', () => {
  it('renders the title and summary', () => {
    const { container } = render(<EntryCard entry={entry} />)
    expect(container.querySelector('.awt-entry-card__title')?.textContent).toBe('Install')
    expect(container.querySelector('.awt-entry-card__summary')?.textContent).toBe('How to install')
  })

  it('omits summary when missing', () => {
    const e: SiteEntry = { ...entry, frontmatter: { title: 'No summary' } }
    const { container } = render(<EntryCard entry={e} />)
    expect(container.querySelector('.awt-entry-card__summary')).toBeNull()
  })

  it('links to the entry slug', () => {
    const { container } = render(<EntryCard entry={entry} />)
    const a = container.querySelector('a.awt-entry-card') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/guides/install')
  })
})
