/** Unit tests for EntityChooser. It composes the real ListChooser (Base-UI Popover
 *  in jsdom; rect stubs from vitest.setup). Interactions use fireEvent. These assert
 *  the selection semantics EntityChooser adds (single value vs. set + chips); the
 *  list/keyboard behavior itself is covered by listChooser.test.tsx. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EntityChooser } from '../components/entity-chooser'

const CATEGORIES = ['architecture', 'engineering', 'research']
const TAGS = ['attention', 'transformers', 'vision']

function openBrowser(name: string): HTMLInputElement {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('combobox') as HTMLInputElement
}

describe('EntityChooser — single', () => {
  it('selects an existing option and reports it via onChange', () => {
    const onChange = vi.fn()
    render(<EntityChooser options={CATEGORIES} value={null} onChange={onChange} ariaLabel="Category" />)
    const input = openBrowser('Category')
    fireEvent.click(screen.getByRole('option', { name: 'engineering' }))
    expect(onChange).toHaveBeenCalledWith('engineering')
    expect(input).not.toBeInTheDocument() // browser closed on accept
  })

  it('adds a typed value that matches no option as a new entry', () => {
    const onChange = vi.fn()
    render(<EntityChooser options={CATEGORIES} value={null} onChange={onChange} ariaLabel="Category" />)
    const input = openBrowser('Category')
    fireEvent.change(input, { target: { value: 'design' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('design')
  })

  it('does not create when allowCreate is false', () => {
    const onChange = vi.fn()
    render(
      <EntityChooser options={CATEGORIES} value={null} onChange={onChange} ariaLabel="Category" allowCreate={false} />,
    )
    const input = openBrowser('Category')
    fireEvent.change(input, { target: { value: 'nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the committed value on the trigger', () => {
    render(<EntityChooser options={CATEGORIES} value="research" onChange={vi.fn()} ariaLabel="Category" />)
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('research')
  })
})

describe('EntityChooser — multi', () => {
  it('renders the current set as chips and shows the empty hint when nothing is selected', () => {
    const { rerender } = render(
      <EntityChooser multiple options={TAGS} value={[]} onChange={vi.fn()} ariaLabel="Tags" />,
    )
    expect(screen.getByText('Nothing selected yet')).toBeInTheDocument()
    rerender(<EntityChooser multiple options={TAGS} value={['vision']} onChange={vi.fn()} ariaLabel="Tags" />)
    expect(screen.queryByText('Nothing selected yet')).toBeNull()
    expect(screen.getByText('vision')).toBeInTheDocument()
  })

  it('adds a chosen option to the set (existing ones preserved)', () => {
    const onChange = vi.fn()
    render(<EntityChooser multiple options={TAGS} value={['vision']} onChange={onChange} ariaLabel="Tags" />)
    openBrowser('Tags')
    fireEvent.click(screen.getByRole('option', { name: 'attention' }))
    expect(onChange).toHaveBeenCalledWith(['vision', 'attention'])
  })

  it('hides already-selected options from the browser', () => {
    render(<EntityChooser multiple options={TAGS} value={['vision']} onChange={vi.fn()} ariaLabel="Tags" />)
    openBrowser('Tags')
    expect(screen.queryByRole('option', { name: 'vision' })).toBeNull() // already chosen
    expect(screen.getByRole('option', { name: 'attention' })).toBeInTheDocument()
  })

  it('removes a tag via its Remove control', () => {
    const onChange = vi.fn()
    render(
      <EntityChooser
        multiple
        options={TAGS}
        value={['vision', 'attention']}
        onChange={onChange}
        ariaLabel="Tags"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove vision' }))
    expect(onChange).toHaveBeenCalledWith(['attention'])
  })

  it('does not re-add an option already in the set', () => {
    const onChange = vi.fn()
    // 'vision' is filtered out of the browser, but the guard also protects a typed dup.
    render(<EntityChooser multiple options={TAGS} value={['vision']} onChange={onChange} ariaLabel="Tags" />)
    const input = openBrowser('Tags')
    fireEvent.change(input, { target: { value: 'vision' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
