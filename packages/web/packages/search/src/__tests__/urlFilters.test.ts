import { describe, expect, it } from 'vitest'
import { filtersFromSearch, filtersToSearch } from '../data/useUrlFilters'

describe('filtersFromSearch', () => {
  it('parses q/tag/category and trims q', () => {
    expect(filtersFromSearch('?q=%20agents%20&tag=llm&category=theory')).toEqual({
      q: 'agents',
      tag: 'llm',
      category: 'theory',
    })
  })

  it('yields empty axes when params are absent', () => {
    expect(filtersFromSearch('')).toEqual({ q: '', tag: '', category: '' })
    expect(filtersFromSearch('?other=1')).toEqual({ q: '', tag: '', category: '' })
  })
})

describe('filtersToSearch', () => {
  it('omits empty axes and trims q', () => {
    expect(filtersToSearch({ q: '  agents  ', tag: '', category: '' })).toBe('q=agents')
    expect(filtersToSearch({ q: '', tag: '', category: '' })).toBe('')
  })

  it('serializes every active axis', () => {
    const qs = filtersToSearch({ q: 'x', tag: 'llm', category: 'theory' })
    const p = new URLSearchParams(qs)
    expect(p.get('q')).toBe('x')
    expect(p.get('tag')).toBe('llm')
    expect(p.get('category')).toBe('theory')
  })

  it('round-trips through filtersFromSearch', () => {
    const filters = { q: 'multi word', tag: 'a', category: 'b' }
    expect(filtersFromSearch(`?${filtersToSearch(filters)}`)).toEqual(filters)
  })
})
