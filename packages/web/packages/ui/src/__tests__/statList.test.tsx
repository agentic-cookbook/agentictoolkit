/** StatList / StatListRow (the shared status-list block) + the tone table it
 *  and Stat/StatusDot all read from (lib/tone). */

import * as React from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { StatList, StatListRow } from '../blocks/stat-list'
import { toneTextClass, TONE_TEXT_CLASS } from '../lib/tone'

describe('StatList / StatListRow', () => {
  it('renders a dot, a truncating label, and trailing content per row', () => {
    render(
      <StatList as="ul" divided data-testid="down-list">
        <StatListRow
          as="li"
          tone="error"
          label="app.example.com"
          labelTitle="app.example.com"
          trailing={<span className="font-bold">1h</span>}
        />
      </StatList>,
    )
    const list = screen.getByTestId('down-list')
    expect(list.tagName).toBe('UL')
    // divided adds the top border/padding.
    expect(list.className).toContain('border-t')
    const item = within(list).getByText('app.example.com')
    expect(item.getAttribute('title')).toBe('app.example.com')
    expect(item.className).toContain('truncate')
    expect(within(list).getByText('1h')).toBeInTheDocument()
    // The row's dot is decorative (no label) → aria-hidden, so the row's only
    // accessible text is its label + trailing.
    expect(list.querySelector('[role="img"]')).toBeNull()
  })

  it('renders as a div list by default and omits the divider unless asked', () => {
    render(
      <StatList>
        <StatListRow label="x" />
      </StatList>,
    )
    const label = screen.getByText('x')
    const list = label.closest('div.flex.flex-col')!
    expect(list.className).not.toContain('border-t')
  })
})

describe('tone table (lib/tone)', () => {
  it('maps each tone to its apt text token', () => {
    expect(toneTextClass('success')).toBe('text-apt-green')
    expect(toneTextClass('error')).toBe('text-apt-red')
    expect(toneTextClass('accent')).toBe('text-apt-gold')
    // neutral here is the full-strength reading (a Stat value's default).
    expect(toneTextClass('neutral')).toBe('text-apt-text')
    expect(toneTextClass()).toBe('text-apt-text')
  })

  it('is the single source Stat reads (no parallel map to drift)', () => {
    expect(TONE_TEXT_CLASS.blue).toBe('text-apt-blue')
    expect(TONE_TEXT_CLASS.orange).toBe('text-apt-orange')
    expect(TONE_TEXT_CLASS.muted).toBe('text-apt-text-dim')
  })
})
