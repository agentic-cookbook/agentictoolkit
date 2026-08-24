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

  it('shows an option pair by its label and reports its value', () => {
    // An axis over RECORDS filters by id and reads as a name — so the option the user
    // sees ("Todo") and the value the host gets back ("st-1") are different strings.
    const onChange = vi.fn()
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'status',
            label: 'Filter by status',
            value: '',
            options: [
              { value: 'st-1', label: 'Todo' },
              { value: 'st-2', label: 'Done' },
            ],
            allLabel: 'All statuses',
            onChange,
          },
        ]}
      />,
    )
    const status = screen.getByRole('combobox', { name: 'Filter by status' })
    expect(within(status).getByRole('option', { name: 'Todo' })).toBeInTheDocument()
    expect(within(status).queryByRole('option', { name: 'st-1' })).toBeNull()
    fireEvent.change(status, { target: { value: 'st-2' } })
    expect(onChange).toHaveBeenCalledWith('st-2')
  })

  it('mixes bare strings and option pairs on one axis', () => {
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'iteration',
            label: 'Filter by iteration',
            value: '',
            options: ['Backlog', { value: 'it-1', label: 'Sprint 3' }],
            allLabel: 'All iterations',
            onChange: vi.fn(),
          },
        ]}
      />,
    )
    const axis = screen.getByRole('combobox', { name: 'Filter by iteration' })
    const backlog = within(axis).getByRole('option', { name: 'Backlog' }) as HTMLOptionElement
    const sprint = within(axis).getByRole('option', { name: 'Sprint 3' }) as HTMLOptionElement
    expect(backlog.value).toBe('Backlog')
    expect(sprint.value).toBe('it-1')
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

  it('renders extra controls in the filter row, beside the selects', () => {
    render(
      <SearchFilterBar
        search={baseSearch()}
        filters={[
          {
            name: 'category',
            label: 'Filter by category',
            value: '',
            options: ['Agents'],
            allLabel: 'All categories',
            onChange: vi.fn(),
          },
        ]}
      >
        <button type="button">Platforms</button>
      </SearchFilterBar>,
    )
    // Same row as the select — the slot is an extra AXIS, not a second bar.
    // Anchored on the child, whose parent IS the row: `Select` wraps its own
    // `<select>` in a relative div for the chevron, so walking up from the
    // combobox lands one level short.
    const row = screen.getByRole('button', { name: 'Platforms' }).parentElement!
    expect(within(row).getByRole('combobox', { name: 'Filter by category' })).toBeInTheDocument()
  })

  it('draws the filter row for children alone, with no selects configured', () => {
    render(
      <SearchFilterBar search={baseSearch()}>
        <button type="button">Platforms</button>
      </SearchFilterBar>,
    )
    expect(screen.getByRole('button', { name: 'Platforms' })).toBeInTheDocument()
  })

  it('draws no filter row for a child a host conditioned away', () => {
    // `{cond && <X/>}` passes `false`, not nothing. Testing the PROP for presence
    // would draw an empty row that still takes its gap.
    const { container } = render(
      <SearchFilterBar search={baseSearch()}>{false}</SearchFilterBar>,
    )
    expect(container.querySelectorAll('[role="search"] > div')).toHaveLength(1)
  })

  it('stacks by default and lays out in one row when asked to', () => {
    const { container, rerender } = render(<SearchFilterBar search={baseSearch()} />)
    const root = () => container.querySelector('[role="search"]')!
    expect(root().className).toContain('flex-col')

    rerender(<SearchFilterBar search={baseSearch()} orientation="inline" />)
    expect(root().className).not.toContain('flex-col')
    expect(root().className).toContain('flex-wrap')
    // The field takes the slack, with a floor — an empty search box has no content
    // width of its own to hold a `flex-1` open.
    const field = screen.getByRole('searchbox').parentElement!
    expect(field.className).toContain('flex-1')
    expect(field.className).toContain('min-w-48')
  })

  it('roots on a div by default and on a form when asked to', () => {
    // The form is an autofill fix, not a submission mechanism: a field with no
    // form ancestor is scoped for autofill against the whole document, so a page
    // carrying contact-shaped content can offer "AutoFill Contact" over a search
    // box. The default stays a div because a bar inside a host's own form would
    // nest one, and the parser resolves that by dropping it.
    const { container, rerender } = render(<SearchFilterBar search={baseSearch()} />)
    const root = () => container.querySelector('[role="search"]')!
    expect(root().tagName).toBe('DIV')

    rerender(<SearchFilterBar search={baseSearch()} asForm />)
    expect(root().tagName).toBe('FORM')
    // Still exactly one landmark — the role moves with the root, it is not added.
    expect(screen.getAllByRole('search')).toHaveLength(1)
  })

  it('cancels a submit rather than letting the form navigate', () => {
    // Every axis is already live through `onChange`, so a submit has nothing to
    // do — and an uncancelled one reloads the page with the field in the query
    // string. `fireEvent` reports a cancelled event as `false`.
    const { container } = render(<SearchFilterBar search={baseSearch()} asForm />)
    expect(fireEvent.submit(container.querySelector('form')!)).toBe(false)
  })

  it('keeps the autofill attribute bag on the field', () => {
    // The form is one half of the fix; the attributes the shared `Input` applies
    // are the other, and they are what the password managers read. Asserted here
    // because a field that quietly loses them looks identical.
    render(<SearchFilterBar search={baseSearch()} asForm />)
    const box = screen.getByRole('searchbox')
    expect(box).toHaveAttribute('autocomplete', 'off')
    expect(box).toHaveAttribute('data-1p-ignore')
    expect(box).toHaveAttribute('data-lpignore')
  })
})
