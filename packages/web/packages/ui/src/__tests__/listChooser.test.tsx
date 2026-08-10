/** Unit tests for ListChooser. Real Base-UI Popover in jsdom (rect stubs come
 *  from vitest.setup). Interactions use fireEvent (no userEvent). Keyboard is
 *  dispatched on the filter input; DOM focus is verified in Playwright, not here. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ListChooser } from '../components/list-chooser'

const ITEMS = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
]

const LABELS = { ariaLabel: 'Framework', inputLabel: 'Filter or add framework' }

function open(): { input: HTMLInputElement; list: HTMLElement } {
  fireEvent.click(screen.getByRole('button', { name: 'Framework' }))
  return {
    input: screen.getByRole('combobox', { name: 'Filter or add framework' }) as HTMLInputElement,
    list: screen.getByRole('listbox', { name: 'Framework' }),
  }
}

describe('ListChooser — filtering', () => {
  it('narrows the list to case-insensitive substring matches as the user types', () => {
    render(<ListChooser items={ITEMS} value={null} onChange={vi.fn()} {...LABELS} />)
    const { input } = open()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(input, { target: { value: 'sv' } })
    expect(screen.getByRole('option', { name: 'Svelte' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'React' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Vue' })).toBeNull()
  })

  it('shows the empty message when nothing matches and creation is off', () => {
    render(<ListChooser items={ITEMS} value={null} onChange={vi.fn()} allowCreate={false} emptyLabel="No frameworks" {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByText('No frameworks')).toBeInTheDocument()
  })
})

describe('ListChooser — keyboard navigation', () => {
  it('moves the roving highlight with ArrowDown/Up and syncs the highlighted label into the field', () => {
    render(<ListChooser items={ITEMS} value={null} onChange={vi.fn()} {...LABELS} />)
    const { input, list } = open()
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // → React
    let first = screen.getByRole('option', { name: 'React' })
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(input.value).toBe('React') // highlighted value synced into the field
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // → Vue
    const second = screen.getByRole('option', { name: 'Vue' })
    expect(input).toHaveAttribute('aria-activedescendant', second.id)
    expect(input.value).toBe('Vue')
    fireEvent.keyDown(input, { key: 'ArrowUp' }) // → React
    first = screen.getByRole('option', { name: 'React' })
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(input.value).toBe('React')
    expect(list).toBeInTheDocument()
  })

  it('accepts the highlighted item on Enter (isNew:false) and closes', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // React
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // Vue
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('vue', { isNew: false })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('cancels on Escape without committing', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'Re' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('ListChooser — add new', () => {
  it('adds the typed text as a new entry on Enter when it matches no item (isNew:true)', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: '  Angular  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Angular', { isNew: true })
  })

  it('shows and commits the create row when typed text matches no item', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'Solid' } })
    const createRow = screen.getByRole('option', { name: /Add .*Solid/ })
    fireEvent.click(createRow)
    expect(onChange).toHaveBeenCalledWith('Solid', { isNew: true })
  })

  it('resolves typed text equal to an item to that item, not a new entry', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'react' } }) // case-insensitive match of "React"
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('react', { isNew: false })
  })

  it('does not create when allowCreate is false and text matches nothing', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} allowCreate={false} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'Nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ListChooser — OK / Cancel buttons', () => {
  it('OK is disabled until something is selectable, then commits like Enter', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    const ok = screen.getByRole('button', { name: 'OK' })
    expect(ok).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Vue' } })
    expect(ok).not.toBeDisabled()
    fireEvent.click(ok)
    expect(onChange).toHaveBeenCalledWith('vue', { isNew: false })
  })

  it('Cancel closes without committing (mirrors Escape)', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('ListChooser — keepOpenOnCommit', () => {
  it('keeps the list up after Enter and resets the field for the next entry', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} keepOpenOnCommit {...LABELS} />)
    const { input } = open()
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // React
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('react', { isNew: false })
    expect(screen.getByRole('listbox', { name: 'Framework' })).toBeInTheDocument()
    expect(input.value).toBe('') // field cleared, highlight dropped — ready for the next
    fireEvent.change(input, { target: { value: 'Vue' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenNthCalledWith(2, 'vue', { isNew: false })
    expect(screen.getByRole('listbox', { name: 'Framework' })).toBeInTheDocument()
  })

  it('keeps the list up after a click too', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} keepOpenOnCommit {...LABELS} />)
    open()
    fireEvent.click(screen.getByRole('option', { name: 'Svelte' }))
    expect(onChange).toHaveBeenCalledWith('svelte', { isNew: false })
    expect(screen.getByRole('listbox', { name: 'Framework' })).toBeInTheDocument()
  })

  it('dismisses on Shift+Enter without committing', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} keepOpenOnCommit {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'Vue' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('still closes on Shift+Enter-less accept when keepOpenOnCommit is off', () => {
    const onChange = vi.fn()
    render(<ListChooser items={ITEMS} value={null} onChange={onChange} {...LABELS} />)
    const { input } = open()
    fireEvent.change(input, { target: { value: 'Vue' } })
    // Shift is not a modifier this mode reads, so it must not swallow the accept.
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onChange).toHaveBeenCalledWith('vue', { isNew: false })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('ListChooser — trigger label', () => {
  it('shows the committed item label on the trigger', () => {
    render(<ListChooser items={ITEMS} value="svelte" onChange={vi.fn()} {...LABELS} />)
    expect(screen.getByRole('button', { name: 'Framework' })).toHaveTextContent('Svelte')
  })

  it('shows free text on the trigger when the committed value matches no item', () => {
    render(<ListChooser items={ITEMS} value="Ember" onChange={vi.fn()} {...LABELS} />)
    expect(screen.getByRole('button', { name: 'Framework' })).toHaveTextContent('Ember')
  })
})
