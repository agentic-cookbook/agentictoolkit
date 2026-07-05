/** InfoPanel host-attribute passthrough — remaining HTML attributes (data-*,
 *  id, handlers) spread onto the panel's root <section> so hosts can tag it
 *  for tests/analytics without a wrapper element. */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { InfoPanel } from '../blocks/info-panel'

describe('InfoPanel', () => {
  it('spreads host attributes onto the root section', () => {
    render(
      <InfoPanel title="Fleet" data-testid="panel" data-kind="monitor" id="fleet-panel">
        body
      </InfoPanel>,
    )
    const panel = screen.getByTestId('panel')
    expect(panel.tagName).toBe('SECTION')
    expect(panel).toHaveAttribute('data-kind', 'monitor')
    expect(panel).toHaveAttribute('id', 'fleet-panel')
  })

  it('keeps the computed accessible name despite the spread', () => {
    render(
      <InfoPanel title="Fleet" data-testid="panel">
        body
      </InfoPanel>,
    )
    expect(screen.getByRole('region', { name: 'Fleet' })).toBeInTheDocument()
  })

  it('honors a raw aria-label when the title is not a string (no clobber)', () => {
    render(
      <InfoPanel title={<span>Fleet</span>} aria-label="Traffic overview">
        body
      </InfoPanel>,
    )
    // The raw aria-label must survive the {...rest} spread, not be overridden by
    // the computed (undefined) label from a non-string title.
    expect(screen.getByRole('region', { name: 'Traffic overview' })).toBeInTheDocument()
  })

  it('prefers the explicit ariaLabel prop over a raw aria-label', () => {
    render(
      <InfoPanel title="ignored" ariaLabel="Explicit" aria-label="Raw">
        body
      </InfoPanel>,
    )
    expect(screen.getByRole('region', { name: 'Explicit' })).toBeInTheDocument()
  })
})
