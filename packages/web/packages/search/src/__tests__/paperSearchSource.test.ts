import { describe, expect, it } from 'vitest'
import { buildFacetUrl, buildSearchUrl } from '../data/useDocumentSearch'
import { paperSearchSource } from '../components/PaperSearchView'

describe('paperSearchSource', () => {
  it('defaults to the same-origin BFF proxy and the public paper endpoints', () => {
    const s = paperSearchSource()
    expect(s.baseUrl).toBe('/api')
    expect(s.endpoints.results).toBe('/public/papers')
    expect(s.endpoints.tags).toBe('/public/papers/tags')
    expect(s.endpoints.categories).toBe('/public/papers/categories')
    expect(s.fixedParams).toBeUndefined()
  })

  it('scopes to one author when asked', () => {
    const s = paperSearchSource({ authorSlug: 'Ada' })
    expect(s.fixedParams).toEqual({ author: 'ada' })
    expect(buildSearchUrl(s, { q: '', category: '', tag: '' }, 1)).toContain('author=ada')
    expect(buildFacetUrl(s, 'categories')).toContain('author=ada')
  })

  it('reads live, never a cached corpus', () => {
    expect(paperSearchSource().fetchInit).toEqual({ cache: 'no-store' })
  })
})
