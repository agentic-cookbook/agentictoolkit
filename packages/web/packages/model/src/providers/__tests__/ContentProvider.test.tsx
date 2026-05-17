import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ContentProvider, useContent } from '../ContentProvider'
import { SiteConfigProvider } from '../SiteConfigProvider'
import type { SiteConfig, SiteEntry } from '../../types'

const config: SiteConfig = {
  branding: { title: 't' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: 'h', body: 'b' },
  nav: { sections: [{ key: 'g', label: 'Guides', path: '/g' }] },
}

const entries: SiteEntry[] = [
  {
    slug: '/g/a',
    section: 'g',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'A' },
  },
]

describe('ContentProvider', () => {
  it('derives navTree from entries + config sections', () => {
    const { result } = renderHook(() => useContent(), {
      wrapper: ({ children }) => (
        <SiteConfigProvider config={config}>
          <ContentProvider entries={entries}>{children}</ContentProvider>
        </SiteConfigProvider>
      ),
    })
    expect(result.current.entries).toBe(entries)
    expect(result.current.navTree).toHaveLength(1)
    expect(result.current.navTree[0].children).toHaveLength(1)
    expect(result.current.navTree[0].children[0].label).toBe('A')
  })

  it('exposes findBySlug bound to current entries', () => {
    const { result } = renderHook(() => useContent(), {
      wrapper: ({ children }) => (
        <SiteConfigProvider config={config}>
          <ContentProvider entries={entries}>{children}</ContentProvider>
        </SiteConfigProvider>
      ),
    })
    expect(result.current.findBySlug('/g/a')?.frontmatter.title).toBe('A')
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useContent())).toThrow(/ContentProvider/)
  })
})
