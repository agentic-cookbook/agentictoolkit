import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilteredList } from '../FilteredList'

type Service = { id: string; name: string; baseUrl: string }

const services: Service[] = [
  { id: '1', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: '2', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: '3', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
]

function setup(extra: Partial<React.ComponentProps<typeof FilteredList<Service>>> = {}) {
  const onSelect = vi.fn()
  const onHighlightChange = vi.fn()
  render(
    <FilteredList<Service>
      items={services}
      getId={(s) => s.id}
      getTitle={(s) => s.name}
      getDetails={(s) => s.baseUrl}
      onSelect={onSelect}
      onHighlightChange={onHighlightChange}
      {...extra}
    />,
  )
  return {
    input: screen.getByRole('combobox') as HTMLInputElement,
    onSelect,
    onHighlightChange,
  }
}

describe('FilteredList keyboard nav', () => {
  it('ArrowDown from empty highlight selects first item and fills input with its title', () => {
    const { input } = setup()
    expect(input.value).toBe('')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('Groq')
  })

  it('ArrowDown moves down through visible items', () => {
    const { input } = setup()
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // Groq
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // OpenAI
    expect(input.value).toBe('OpenAI')
  })

  it('ArrowUp moves up; from index 0 it clears the highlight back to the typed query', () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'a' } }) // filters to Anthropic + Groq + OpenAI? all contain 'a' lowercased
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).not.toBe('a')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('a')
  })

  it('Enter fires onSelect with the highlighted item', () => {
    const { input, onSelect } = setup()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: '2', name: 'OpenAI' })
  })

  it('Enter without a highlight does not fire onSelect', () => {
    const { input, onSelect } = setup()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('typing while highlighted clears the highlight and resumes filtering', () => {
    const { input } = setup()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('Groq')
    fireEvent.change(input, { target: { value: 'Anth' } })
    expect(input.value).toBe('Anth')
    // Only Anthropic matches.
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('onHighlightChange fires with the item, then null when cleared', () => {
    const { input, onHighlightChange } = setup()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Escape' })
    const calls = onHighlightChange.mock.calls.map((c) => c[0])
    expect(calls).toContainEqual(expect.objectContaining({ id: '1' }))
    expect(calls).toContain(null)
  })

  it('clicking a row fires onSelect', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('button', { name: /OpenAI/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: '2' })
  })
})
