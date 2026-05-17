import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFilteredList } from '../useFilteredList'

type Service = { id: string; name: string; providerKind: string; baseUrl: string }

const services: Service[] = [
  { id: '1', name: 'OpenAI', providerKind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { id: '2', name: 'Anthropic', providerKind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { id: '3', name: 'Groq', providerKind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
]

function setup(initialQuery = '') {
  return renderHook(() =>
    useFilteredList<Service>({
      items: services,
      getId: (s) => s.id,
      getTitle: (s) => s.name,
      getSubtitle: (s) => s.providerKind,
      getDetails: (s) => s.baseUrl,
      initialQuery,
    }),
  )
}

describe('useFilteredList', () => {
  it('returns all items when query is empty', () => {
    const { result } = setup()
    expect(result.current.visible).toHaveLength(3)
    expect(result.current.total).toBe(3)
    expect(result.current.empty).toBe(false)
  })

  it('matches against title (case-insensitive)', () => {
    const { result } = setup()
    act(() => result.current.setQuery('GROQ'))
    expect(result.current.visible.map((s) => s.id)).toEqual(['3'])
  })

  it('matches against subtitle (providerKind)', () => {
    const { result } = setup()
    act(() => result.current.setQuery('anthropic'))
    // Anthropic matches both name and providerKind. Single result expected.
    expect(result.current.visible.map((s) => s.id)).toEqual(['2'])
  })

  it('matches against details (baseUrl)', () => {
    const { result } = setup()
    act(() => result.current.setQuery('groq.com'))
    expect(result.current.visible.map((s) => s.id)).toEqual(['3'])
  })

  it('reports empty when nothing matches', () => {
    const { result } = setup()
    act(() => result.current.setQuery('nope'))
    expect(result.current.visible).toHaveLength(0)
    expect(result.current.empty).toBe(true)
    expect(result.current.total).toBe(3)
  })

  it('treats whitespace-only query as empty', () => {
    const { result } = setup('   ')
    expect(result.current.visible).toHaveLength(3)
  })

  it('honors a custom matcher', () => {
    const { result } = renderHook(() =>
      useFilteredList<Service>({
        items: services,
        getId: (s) => s.id,
        getTitle: (s) => s.name,
        match: (s, q) => s.providerKind.toLowerCase() === q,
      }),
    )
    act(() => result.current.setQuery('openai'))
    expect(result.current.visible.map((s) => s.id)).toEqual(['1', '3'])
  })

  it('searches getSearchableExtras', () => {
    const { result } = renderHook(() =>
      useFilteredList<Service>({
        items: services,
        getId: (s) => s.id,
        getTitle: (s) => s.name,
        getSearchableExtras: (s) => [`tag:${s.providerKind}`],
      }),
    )
    act(() => result.current.setQuery('tag:anthropic'))
    expect(result.current.visible.map((s) => s.id)).toEqual(['2'])
  })
})
