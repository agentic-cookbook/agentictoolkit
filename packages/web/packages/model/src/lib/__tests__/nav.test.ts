import { describe, it, expect } from 'vitest'
import { buildNavTree } from '../nav'
import type { SiteEntry, NavSectionConfig } from '../../types'

const entries: SiteEntry[] = [
  {
    slug: '/guides/install',
    section: 'guides',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Install' },
  },
  {
    slug: '/guides/configure',
    section: 'guides',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Configure' },
  },
  {
    slug: '/api/overview',
    section: 'api',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'API Overview' },
  },
]

const sections: NavSectionConfig[] = [
  { key: 'guides', label: 'Guides', path: '/guides' },
  { key: 'api', label: 'API', path: '/api' },
]

describe('buildNavTree', () => {
  it('groups entries under their section nodes in declared order', () => {
    const tree = buildNavTree(entries, sections)
    expect(tree).toHaveLength(2)
    expect(tree[0]).toMatchObject({ label: 'Guides', path: '/guides' })
    expect(tree[1]).toMatchObject({ label: 'API', path: '/api' })
    expect(tree[0].children).toHaveLength(2)
    const guideLabels = tree[0].children.map((c) => c.label).sort()
    expect(guideLabels).toEqual(['Configure', 'Install'])
    expect(tree[1].children).toHaveLength(1)
    expect(tree[1].children[0]).toMatchObject({ label: 'API Overview', path: '/api/overview' })
  })

  it('returns declared sections even when they have no entries', () => {
    const tree = buildNavTree([], sections)
    expect(tree).toHaveLength(2)
    expect(tree[0].children).toEqual([])
  })

  it('creates an orphan section node for entries whose section is not declared', () => {
    const orphan: SiteEntry = {
      slug: '/misc/extra',
      section: 'misc',
      raw: '',
      html: '',
      headings: [],
      frontmatter: { title: 'Extra' },
    }
    const tree = buildNavTree([...entries, orphan], sections)
    const miscSection = tree.find((n) => n.path === '/misc')
    expect(miscSection).toBeDefined()
    expect(miscSection!.children).toHaveLength(1)
    expect(miscSection!.children[0].label).toBe('Extra')
  })

  it('skips the root entry "/"', () => {
    const root: SiteEntry = {
      slug: '/',
      section: 'guides',
      raw: '',
      html: '',
      headings: [],
      frontmatter: { title: 'Home' },
    }
    const tree = buildNavTree([root, ...entries], sections)
    expect(tree[0].children.find((c) => c.path === '/')).toBeUndefined()
  })
})
