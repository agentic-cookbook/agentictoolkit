/** Unit tests for Combobox (wraps Base-UI Autocomplete). Real Base-UI floating
 *  parts render in jsdom thanks to the rect/getComputedStyle stubs in
 *  vitest.setup. Base UI opens its listbox on a real keyboard interaction, so we
 *  set the query with change() and open with an ArrowDown keydown (the first
 *  ArrowDown opens, the next highlights). DOM focus is left to Playwright. */
/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Combobox } from '../components/combobox'

const ITEMS = ['React', 'Vue', 'Svelte', 'Angular']

function Harness({ initial = '' }: { initial?: string }): React.ReactElement {
  const [value, setValue] = React.useState(initial)
  return (
    <Combobox
      items={ITEMS}
      value={value}
      onValueChange={setValue}
      ariaLabel="Framework"
      placeholder="Type a framework…"
    />
  )
}

function input(): HTMLInputElement {
  return screen.getByRole('combobox', { name: 'Framework' }) as HTMLInputElement
}

/** Set the query (filters items) and open the popup via a keyboard interaction. */
async function open(el: HTMLInputElement, text: string): Promise<void> {
  fireEvent.change(el, { target: { value: text } })
  fireEvent.keyDown(el, { key: 'ArrowDown' }) // opens the listbox
  await waitFor(() => expect(el).toHaveAttribute('aria-expanded', 'true'))
}

describe('Combobox — ARIA', () => {
  it('renders the input with role="combobox" and starts collapsed', () => {
    render(<Harness />)
    const el = input()
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Combobox — suggestions', () => {
  it('shows only the matching suggestions for the current query', async () => {
    render(<Harness />)
    const el = input()
    await open(el, 'Vu')
    expect(await screen.findByRole('option', { name: 'Vue' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'React' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Svelte' })).toBeNull()
  })

  it('points aria-controls at the rendered listbox when open', async () => {
    render(<Harness />)
    const el = input()
    await open(el, 'S')
    const listbox = await screen.findByRole('listbox')
    expect(el.getAttribute('aria-controls')).toBe(listbox.id)
  })
})

describe('Combobox — keyboard', () => {
  it('moves the active option with ArrowDown (aria-activedescendant) and picks it on Enter', async () => {
    render(<Harness />)
    const el = input()
    await open(el, 'S') // filtered to Svelte; popup open, nothing highlighted yet
    const opt = await screen.findByRole('option', { name: 'Svelte' })
    fireEvent.keyDown(el, { key: 'ArrowDown' }) // highlight the first option
    await waitFor(() => expect(el).toHaveAttribute('aria-activedescendant', opt.id))
    fireEvent.keyDown(el, { key: 'Enter' }) // pick it
    await waitFor(() => expect(el.value).toBe('Svelte'))
    expect(el).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the popup on Escape', async () => {
    render(<Harness />)
    const el = input()
    await open(el, 'V')
    fireEvent.keyDown(el, { key: 'Escape' })
    await waitFor(() => expect(el).toHaveAttribute('aria-expanded', 'false'))
  })
})
