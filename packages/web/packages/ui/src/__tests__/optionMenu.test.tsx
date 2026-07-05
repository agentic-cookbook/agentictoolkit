/** Unit tests for OptionMenu. Real Base-UI Popover in jsdom (rect stubs come
 *  from vitest.setup). Interactions use fireEvent (no userEvent). Keyboard is
 *  dispatched on the listbox; DOM focus is verified in Playwright, not here. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OptionMenu } from '../components/option-menu'

const ITEMS = [
  { value: 'a', label: 'Search engine' },
  { value: 'b', label: 'Social media' },
  { value: 'c', label: 'Blog post' },
]

function open(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Source' }))
  return screen.getByRole('listbox', { name: 'Source' })
}

describe('OptionMenu (base)', () => {
  it('commits the highlighted item on Enter after arrow nav', () => {
    const onChange = vi.fn()
    render(<OptionMenu items={ITEMS} value={null} onChange={onChange} ariaLabel="Source" placeholder="Select…" />)
    const list = open()
    fireEvent.keyDown(list, { key: 'ArrowDown' }) // a -> b
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('b', { isOther: false })
  })

  it('commits an item on click', () => {
    const onChange = vi.fn()
    render(<OptionMenu items={ITEMS} value={null} onChange={onChange} ariaLabel="Source" />)
    open()
    fireEvent.click(screen.getByRole('option', { name: 'Blog post' }))
    expect(onChange).toHaveBeenCalledWith('c', { isOther: false })
  })

  it('closes on Escape without committing', () => {
    const onChange = vi.fn()
    render(<OptionMenu items={ITEMS} value={null} onChange={onChange} ariaLabel="Source" />)
    const list = open()
    fireEvent.keyDown(list, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows the committed item label on the trigger', () => {
    render(<OptionMenu items={ITEMS} value="a" onChange={vi.fn()} ariaLabel="Source" />)
    expect(screen.getByRole('button', { name: 'Source' })).toHaveTextContent('Search engine')
  })
})

// ── B-1: closed trigger + ArrowDown opens ────────────────────────────────────

describe('OptionMenu (B-1 — ArrowDown on closed trigger)', () => {
  it('opens the menu with ArrowDown when trigger is closed and highlights the first item', () => {
    render(<OptionMenu items={ITEMS} value={null} onChange={vi.fn()} ariaLabel="Source" placeholder="Select…" />)
    const trigger = screen.getByRole('button', { name: 'Source' })
    // Menu should not be open yet
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    // Menu should now be open
    const list = screen.getByRole('listbox', { name: 'Source' })
    // First item should be highlighted (aria-activedescendant points at 'a')
    const firstOption = screen.getByRole('option', { name: 'Search engine' })
    expect(list).toHaveAttribute('aria-activedescendant', firstOption.id)
  })
})

// ── B-2: allowOther + null value → first item highlighted (not Other) ─────────

describe('OptionMenu (B-2 — initial selection with allowOther + null value)', () => {
  it('highlights the first list item (not Other) when opened with no committed value', () => {
    render(
      <OptionMenu
        items={ITEMS}
        value={null}
        onChange={vi.fn()}
        ariaLabel="Source"
        allowOther
        otherLabel="Other"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    const list = screen.getByRole('listbox', { name: 'Source' })
    // The Other option should NOT be aria-selected (committed)
    const otherRow = screen.getByRole('option', { name: /Other/ })
    expect(otherRow).toHaveAttribute('aria-selected', 'false')
    // aria-activedescendant should point at the first list item, not Other
    const firstOption = screen.getByRole('option', { name: 'Search engine' })
    expect(list).toHaveAttribute('aria-activedescendant', firstOption.id)
  })

  it('moves the check to Other only once the user types', () => {
    render(
      <OptionMenu
        items={ITEMS}
        value={null}
        onChange={vi.fn()}
        ariaLabel="Source"
        allowOther
        otherLabel="Other"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    const otherRow = screen.getByRole('option', { name: /Other/ })
    // Before typing: Other not selected
    expect(otherRow).toHaveAttribute('aria-selected', 'false')
    const input = screen.getByRole('textbox', { name: 'Other' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Typed' } })
    // After typing: Other becomes selected (check moves)
    expect(otherRow).toHaveAttribute('aria-selected', 'true')
  })
})

// ── B-6: ArrowUp from Other input → last list item; subsequent arrow still works ──

describe('OptionMenu (B-6 — ArrowUp from Other input refocuses surface)', () => {
  it('moves selection to the last list item on ArrowUp from input, and ArrowUp again moves further up', () => {
    render(
      <OptionMenu
        items={ITEMS}
        value={null}
        onChange={vi.fn()}
        ariaLabel="Source"
        allowOther
        otherLabel="Other"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    const list = screen.getByRole('listbox', { name: 'Source' })
    // Move selection down to OTHER via ArrowDown from 'a' → 'b' → 'c' → OTHER
    fireEvent.keyDown(list, { key: 'ArrowDown' }) // a→b
    fireEvent.keyDown(list, { key: 'ArrowDown' }) // b→c
    fireEvent.keyDown(list, { key: 'ArrowDown' }) // c→OTHER
    // Confirm we're at Other
    const otherRow = screen.getByRole('option', { name: /Other/ })
    expect(list).toHaveAttribute('aria-activedescendant', otherRow.id)
    // ArrowUp from Other → move to last list item ('c' = Blog post)
    fireEvent.keyDown(list, { key: 'ArrowUp' })
    const lastListOption = screen.getByRole('option', { name: 'Blog post' })
    expect(list).toHaveAttribute('aria-activedescendant', lastListOption.id)
    // ArrowUp again → should move to 'b' (Social media) — proving surface still responds
    fireEvent.keyDown(list, { key: 'ArrowUp' })
    const secondOption = screen.getByRole('option', { name: 'Social media' })
    expect(list).toHaveAttribute('aria-activedescendant', secondOption.id)
  })
})

describe('OptionMenu (aria-activedescendant)', () => {
  it('sets aria-activedescendant to the id of the highlighted option after ArrowDown', () => {
    render(<OptionMenu items={ITEMS} value={null} onChange={vi.fn()} ariaLabel="Source" placeholder="Select…" />)
    const list = open()
    fireEvent.keyDown(list, { key: 'ArrowDown' }) // moves from 'a' to 'b'
    const highlighted = screen.getByRole('option', { name: 'Social media' })
    expect(list).toHaveAttribute('aria-activedescendant', highlighted.id)
  })
})

describe('OptionMenu (Other)', () => {
  const onChange = vi.fn()
  beforeEach(() => onChange.mockReset())

  function openOther() {
    render(<OptionMenu items={ITEMS} value={null} onChange={onChange} ariaLabel="Source" allowOther otherLabel="Other" />)
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    return screen.getByRole('textbox', { name: 'Other' }) as HTMLInputElement
  }

  it('disables OK until the input is non-empty, then commits trimmed text on OK', () => {
    const input = openOther()
    const ok = screen.getByRole('button', { name: 'OK' })
    expect(ok).toBeDisabled()
    fireEvent.change(input, { target: { value: '  Reddit  ' } })
    expect(ok).not.toBeDisabled()
    fireEvent.click(ok)
    expect(onChange).toHaveBeenCalledWith('Reddit', { isOther: true })
  })

  it('commits the typed Other value on Enter', () => {
    const input = openOther()
    fireEvent.change(input, { target: { value: 'Hacker News' } })
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Source' }), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Hacker News', { isOther: true })
  })

  it('moves the check to Other once the user types', () => {
    const input = openOther()
    const otherRow = screen.getByRole('option', { name: /Other/ })
    expect(otherRow).toHaveAttribute('aria-selected', 'false')
    fireEvent.change(input, { target: { value: 'X' } })
    expect(otherRow).toHaveAttribute('aria-selected', 'true')
  })

  it('prefills the input when the committed value is free text', () => {
    render(<OptionMenu items={ITEMS} value="Reddit" onChange={vi.fn()} ariaLabel="Source" allowOther />)
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    expect((screen.getByRole('textbox', { name: 'Other' }) as HTMLInputElement).value).toBe('Reddit')
  })
})
