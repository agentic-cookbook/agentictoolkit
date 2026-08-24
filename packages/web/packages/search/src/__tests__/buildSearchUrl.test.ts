import { describe, expect, it } from 'vitest'
import { buildSearchUrl, buildFacetUrl, filterKeyOf, sourceKeyOf } from '../data/useDocumentSearch'
import type { SearchSource } from '../types'

const PUBLIC_PAPERS: SearchSource = {
  baseUrl: '/api',
  endpoints: {
    results: '/public/papers',
    tags: '/public/papers/tags',
    categories: '/public/papers/categories',
  },
}

describe('buildSearchUrl', () => {
  it('joins baseUrl + results path and always sends page + pageSize', () => {
    const url = buildSearchUrl(PUBLIC_PAPERS, { q: '', tag: '', category: '' }, 1)
    expect(url).toBe('/api/public/papers?page=1&pageSize=50')
  })

  it('includes only the non-empty filter axes, trimming q', () => {
    const url = buildSearchUrl(
      PUBLIC_PAPERS,
      { q: '  agents  ', tag: 'llm', category: 'theory' },
      2,
    )
    const params = new URL(url, 'http://x').searchParams
    expect(params.get('q')).toBe('agents')
    expect(params.get('tag')).toBe('llm')
    expect(params.get('category')).toBe('theory')
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('50')
  })

  it('honors a source pageSize and custom query-param names', () => {
    const custom: SearchSource = {
      baseUrl: 'https://api.example.com/',
      endpoints: { results: 'search' },
      params: { q: 'query' },
      pageSize: 10,
    }
    const url = buildSearchUrl(custom, { q: 'x', tag: '', category: '' }, 1)
    expect(url).toBe('https://api.example.com/search?query=x&page=1&pageSize=10')
  })
})

describe('buildFacetUrl', () => {
  it('builds the facet URL or returns null when the source omits it', () => {
    expect(buildFacetUrl(PUBLIC_PAPERS, 'tags')).toBe('/api/public/papers/tags')
    expect(buildFacetUrl({ baseUrl: '/api', endpoints: { results: '/x' } }, 'tags')).toBeNull()
  })
})

describe('fixedParams', () => {
  const scoped: SearchSource = {
    baseUrl: '/api',
    endpoints: { results: '/public/papers', tags: '/public/papers/tags' },
    fixedParams: { author: 'ada' },
  }

  it('rides on the results request', () => {
    const url = buildSearchUrl(scoped, { q: 'edge', category: '', tag: '' }, 1)
    expect(url).toContain('author=ada')
    expect(url).toContain('q=edge')
  })

  it('rides on a facet request', () => {
    expect(buildFacetUrl(scoped, 'tags')).toBe('/api/public/papers/tags?author=ada')
  })

  it('is absent when the source sets none', () => {
    const plain: SearchSource = { baseUrl: '/api', endpoints: { results: '/public/papers', tags: '/t' } }
    expect(buildFacetUrl(plain, 'tags')).toBe('/api/t')
  })

  it('WINS over a same-named user filter — the scope must not be widened', () => {
    // A source that (wrongly, or by a param-name collision) puts a filter axis's name in
    // `fixedParams` must still have the scope hold: the fixed value overwrites the user's, not
    // the other way round. `category` is a real filter axis; a source scoping to one
    // category via `fixedParams` must not let the reader escape it by picking another.
    const scopedByCategory: SearchSource = {
      baseUrl: '/api',
      endpoints: { results: '/public/papers' },
      fixedParams: { category: 'theory' },
    }
    const url = buildSearchUrl(scopedByCategory, { q: '', tag: '', category: 'other' }, 1)
    const params = new URL(url, 'http://x').searchParams
    expect(params.get('category')).toBe('theory')
  })
})

describe('sourceKeyOf', () => {
  it('differs when fixedParams differs — two scoped sources must not share a cache key', () => {
    // Two `PaperSearchView`s on one page, differing only by `authorSlug`, produce sources that
    // differ only in `fixedParams`. If this line were ever dropped, `useDocumentSearch`'s effect
    // (keyed on `sourceKeyOf`) would treat them as the SAME source and share results/state.
    const base: SearchSource = { baseUrl: '/api', endpoints: { results: '/public/papers' } }
    const scopedA: SearchSource = { ...base, fixedParams: { author: 'ada' } }
    const scopedB: SearchSource = { ...base, fixedParams: { author: 'ford' } }
    expect(sourceKeyOf(scopedA)).not.toBe(sourceKeyOf(scopedB))
    expect(sourceKeyOf(scopedA)).not.toBe(sourceKeyOf(base))
  })
})

describe('filterKeyOf', () => {
  it('separates filter states a space-joined key could not', () => {
    // Tags and categories are free-text NAMES, not slugs — the facet endpoint serves the
    // distinct values as the author typed them, spaces and all. `q + ' ' + tag + ' ' + cat`
    // spelled these two states identically, and `useDocumentSearch`'s fetch effect depends on
    // this key: a collision leaves the previous query's hits under the new query's chips.
    const a = { q: 'agentic systems', tag: '', category: 'notes' }
    const b = { q: 'agentic', tag: 'systems', category: 'notes' }
    expect(filterKeyOf(a)).not.toBe(filterKeyOf(b))
  })

  it('is stable for equal filters built as different objects', () => {
    // The key is recomputed every render from a fresh `filters` object; if it were not a pure
    // function of the three VALUES, every render would retrigger the fetch.
    expect(filterKeyOf({ q: 'a', tag: 'b', category: 'c' })).toBe(
      filterKeyOf({ q: 'a', tag: 'b', category: 'c' }),
    )
  })
})
