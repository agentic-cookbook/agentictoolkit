import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchFilterBar } from '../components/search-filter-bar'

function baseSearch(overrides: Partial<Parameters<typeof SearchFilterBar>[0]['search']> = {}) {
  return {
    value: '',
    onChange: vi.fn(),
    label: 'Search documents',
    placeholder: 'Search…',
    ...overrides,
  }
}

describe('SearchFilterBar', () => {
  it('wraps its controls in a role="search" region', () => {
    render(<SearchFilterBar search={baseSearch()} />)
    expect(screen.getByRole('search')).toBeInTheDocument()
  })

  it('labels the search field and reports each keystroke', () => {
    const onChange = vi.fn()
    render(<SearchFilterBar search={baseSearch({ onChange })} />)
    const box = screen.getByRole('searchbox', { name: 'Search documents' })
    fireEvent.change(box, { target: { value: 'agents' } })
    expect(onChange).toHaveBeenCalledWith('agents')
  })

  it('renders no filter row when no filters are configured', () => {
    render(<SearchFilterBar search={baseSearch()} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders one labelled select per filter, each with a leading all-pass option', () => {
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'category',
            label: 'Filter by category',
            value: '',
            options: ['Agents', 'Retrieval'],
            allLabel: 'All categories',
            onChange: vi.fn(),
          },
          {
            name: 'tag',
            label: 'Filter by tag',
            value: '',
            options: ['rag'],
            allLabel: 'All tags',
            onChange: vi.fn(),
          },
        ]}
      />,
    )
    const category = screen.getByRole('combobox', { name: 'Filter by category' })
    const tag = screen.getByRole('combobox', { name: 'Filter by tag' })
    // All-pass entry first, then every option.
    expect(within(category).getByRole('option', { name: 'All categories' })).toBeInTheDocument()
    expect(within(category).getByRole('option', { name: 'Agents' })).toBeInTheDocument()
    expect(within(category).getByRole('option', { name: 'Retrieval' })).toBeInTheDocument()
    expect(within(tag).getByRole('option', { name: 'All tags' })).toBeInTheDocument()
  })

  it('reflects the controlled value and reports a filter change', () => {
    const onChange = vi.fn()
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'category',
            label: 'Filter by category',
            value: 'Agents',
            options: ['Agents', 'Retrieval'],
            allLabel: 'All categories',
            onChange,
          },
        ]}
      />,
    )
    const category = screen.getByRole('combobox', { name: 'Filter by category' }) as HTMLSelectElement
    expect(category.value).toBe('Agents')
    fireEvent.change(category, { target: { value: 'Retrieval' } })
    expect(onChange).toHaveBeenCalledWith('Retrieval')
  })

  it('selecting the all-pass option reports the empty value', () => {
    const onChange = vi.fn()
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'category',
            label: 'Filter by category',
            value: 'Agents',
            options: ['Agents'],
            allLabel: 'All categories',
            onChange,
          },
        ]}
      />,
    )
    const category = screen.getByRole('combobox', { name: 'Filter by category' })
    fireEvent.change(category, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })
})
