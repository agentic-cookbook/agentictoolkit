import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, renderHook, act } from '@testing-library/react'
import { SearchDialog } from '../SearchDialog'
import { createSearchIndex } from '@agentic-web-toolkit/model'
import { useSearchState } from '@agentic-web-toolkit/model'
import type { SiteEntry } from '@agentic-web-toolkit/model'

const entries: SiteEntry[] = [
  {
    slug: '/guides/install',
    section: 'guides',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Install', summary: 'How to install' },
  },
  {
    slug: '/api/auth',
    section: 'api',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Authentication', summary: 'API auth' },
  },
]

function makeState() {
  const index = createSearchIndex(entries)
  return renderHook(() => useSearchState(index))
}

describe('SearchDialog', () => {
  it('renders nothing when closed', () => {
    const { result } = makeState()
    const { container } = render(
      <SearchDialog open={false} onClose={() => {}} state={result.current} onSelect={() => {}} />,
    )
    expect(container.querySelector('.awt-search-dialog')).toBeNull()
  })

  it('renders panel and input when open', () => {
    const { result } = makeState()
    const { container } = render(
      <SearchDialog open={true} onClose={() => {}} state={result.current} onSelect={() => {}} />,
    )
    expect(container.querySelector('.awt-search-dialog')).not.toBeNull()
    expect(container.querySelector('.awt-search-dialog__input')).not.toBeNull()
  })

  it('calls onClose when backdrop clicked', () => {
    const { result } = makeState()
    const onClose = vi.fn()
    const { container } = render(
      <SearchDialog open={true} onClose={onClose} state={result.current} onSelect={() => {}} />,
    )
    fireEvent.click(container.querySelector('.awt-search-dialog__backdrop')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows results after typing', () => {
    const { result } = makeState()
    act(() => {
      result.current.setQuery('install')
    })
    const { container } = render(
      <SearchDialog open={true} onClose={() => {}} state={result.current} onSelect={() => {}} />,
    )
    const titles = Array.from(container.querySelectorAll('.awt-search-dialog__result-title')).map(
      (n) => n.textContent,
    )
    expect(titles).toContain('Install')
  })

  it('calls onSelect with entry on Enter', () => {
    const { result } = makeState()
    act(() => {
      result.current.setQuery('install')
    })
    const onSelect = vi.fn()
    const { container } = render(
      <SearchDialog open={true} onClose={() => {}} state={result.current} onSelect={onSelect} />,
    )
    const input = container.querySelector('.awt-search-dialog__input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].slug).toBe('/guides/install')
  })

  it('calls onClose on Escape', () => {
    const { result } = makeState()
    const onClose = vi.fn()
    const { container } = render(
      <SearchDialog open={true} onClose={onClose} state={result.current} onSelect={() => {}} />,
    )
    const input = container.querySelector('.awt-search-dialog__input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty state when no results', () => {
    const { result } = makeState()
    act(() => {
      result.current.setQuery('xyzzy-no-match')
    })
    const { container } = render(
      <SearchDialog open={true} onClose={() => {}} state={result.current} onSelect={() => {}} />,
    )
    expect(container.querySelector('.awt-search-dialog__empty')).not.toBeNull()
  })
})
