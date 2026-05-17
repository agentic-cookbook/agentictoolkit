import { describe, it, expect } from 'vitest'
import { createSearchIndex } from '../search'
import type { SiteEntry } from '../../types'

const entries: SiteEntry[] = [
  {
    slug: '/g/install',
    section: 'g',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Install Guide', summary: 'How to install' },
  },
  {
    slug: '/g/config',
    section: 'g',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Configuration', summary: 'Configure the app' },
  },
  {
    slug: '/api/auth',
    section: 'api',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Authentication', summary: 'API auth flows' },
  },
]

describe('createSearchIndex', () => {
  it('returns a SearchIndex with a query method', () => {
    const idx = createSearchIndex(entries)
    expect(typeof idx.query).toBe('function')
  })

  it('finds matches in frontmatter.title', () => {
    const results = createSearchIndex(entries).query('install')
    expect(results.map((r) => r.entry.slug)).toContain('/g/install')
  })

  it('finds matches in frontmatter.summary', () => {
    const results = createSearchIndex(entries).query('auth flows')
    expect(results[0]?.entry.slug).toBe('/api/auth')
  })

  it('returns empty array for empty query', () => {
    expect(createSearchIndex(entries).query('')).toEqual([])
  })
})
