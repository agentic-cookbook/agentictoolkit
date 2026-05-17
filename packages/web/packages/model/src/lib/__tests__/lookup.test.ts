import { describe, it, expect } from 'vitest'
import { findBySlug, getBySection, getByDomain } from '../lookup'
import type { SiteEntry } from '../../types'

const make = (overrides: Partial<SiteEntry> & { slug: string; section: string }): SiteEntry => ({
  raw: '',
  html: '',
  headings: [],
  frontmatter: { title: overrides.slug },
  ...overrides,
})

const entries: SiteEntry[] = [
  make({ slug: '/g/a', section: 'g', domain: 'd1', frontmatter: { title: 'A' } }),
  make({ slug: '/g/b', section: 'g', domain: 'd1', frontmatter: { title: 'B' } }),
  make({ slug: '/h/c', section: 'h', domain: 'd2', frontmatter: { title: 'C' } }),
]

describe('lookup helpers', () => {
  it('findBySlug returns the matching entry', () => {
    expect(findBySlug(entries, '/g/b')?.frontmatter.title).toBe('B')
  })

  it('findBySlug returns undefined for misses', () => {
    expect(findBySlug(entries, '/nope')).toBeUndefined()
  })

  it('getBySection returns all entries for a section in source order', () => {
    expect(getBySection(entries, 'g').map((e) => e.slug)).toEqual(['/g/a', '/g/b'])
  })

  it('getByDomain filters by domain field', () => {
    expect(getByDomain(entries, 'd2').map((e) => e.slug)).toEqual(['/h/c'])
  })
})
