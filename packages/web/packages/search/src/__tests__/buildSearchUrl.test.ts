import { describe, expect, it } from 'vitest'
import { buildSearchUrl, buildFacetUrl } from '../data/useDocumentSearch'
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
})
