/** Unit tests for EntityChooser. It composes the real ListChooser (Base-UI Popover
 *  in jsdom; rect stubs from vitest.setup). Interactions use fireEvent. These assert
 *  the selection semantics EntityChooser adds (single value vs. set + chips); the
 *  list/keyboard behavior itself is covered by listChooser.test.tsx. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EntityChooser, EntitySelectionChips } from '../components/entity-chooser'

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

  it('stays open across accepts so a set is built in one visit', () => {
    const onChange = vi.fn()
    render(<EntityChooser multiple options={TAGS} value={[]} onChange={onChange} ariaLabel="Tags" />)
    const input = openBrowser('Tags')
    fireEvent.click(screen.getByRole('option', { name: 'attention' }))
    expect(onChange).toHaveBeenCalledWith(['attention'])
    expect(input).toBeInTheDocument() // browser still up for the next tag
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(input).not.toBeInTheDocument() // Shift+Enter is the way out
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

describe('EntityChooser — multi, selectionPlacement="host"', () => {
  // Inline, the trigger is one item flowing among the chips, so it hugs its content and
  // `className` sizes the GROUP. Handed to a host, the trigger is the whole control this
  // renders — so `className` has to reach it, or a caller that sizes its column (TagSetField's
  // `w-44 shrink-0`, matching CategoryField's) silently gets a content-width button instead.
  it('renders ONLY the trigger, sized by the caller', () => {
    const { container } = render(
      <EntityChooser
        multiple
        selectionPlacement="host"
        options={TAGS}
        value={['vision']}
        onChange={vi.fn()}
        ariaLabel="Tags"
        className="w-44 shrink-0"
      />,
    )
    expect(container.querySelector('[role="group"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove vision' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tags' }).closest('.w-44')).not.toBeNull()
  })

  it('leaves the inline layout exactly as it was', () => {
    const { container } = render(
      <EntityChooser
        multiple
        options={TAGS}
        value={['vision']}
        onChange={vi.fn()}
        ariaLabel="Tags"
        className="min-w-64"
      />,
    )
    const group = container.querySelector('[role="group"]') as HTMLElement
    expect(group.className).toContain('min-w-64')
    expect(group).toContainElement(screen.getByRole('button', { name: 'Remove vision' }))
    expect(group).toContainElement(screen.getByRole('button', { name: 'Tags' }))
  })
})

describe('EntitySelectionChips', () => {
  it('renders the set as removable chips in a group named for it', () => {
    const onRemove = vi.fn()
    render(<EntitySelectionChips values={['vision', 'rag']} ariaLabel="Tags" onRemove={onRemove} />)
    const group = screen.getByRole('group', { name: 'Tags' })
    expect(group).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove rag' }))
    expect(onRemove).toHaveBeenCalledWith('rag')
  })

  // An empty row still costs height, and a field with no selection should cost none — the rule
  // CategoryField's breadcrumb row already follows.
  it('renders nothing at all for an empty set with no empty-state label', () => {
    const { container } = render(
      <EntitySelectionChips values={[]} ariaLabel="Tags" onRemove={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the empty-state label when the host asks for one', () => {
    render(
      <EntitySelectionChips
        values={[]}
        ariaLabel="Labels"
        emptySelectionLabel="Any labels"
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByText('Any labels')).toBeInTheDocument()
  })
})
