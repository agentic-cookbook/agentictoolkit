/** The studio's mark, which is a logotype and not just a name: its casing, its spacing
 *  and its two halves are all load-bearing, and all three are things a well-meaning
 *  edit "tidies" away. Every assertion here is one of those. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import { StudioWordmark } from '../StudioWordmark'

// This package's vitest config has no auto-cleanup setup file, so each render must be
// torn down explicitly or the next test's queries see both mounted trees.
afterEach(cleanup)

describe('StudioWordmark', () => {
  it('is set lowercase in the DOM, not uppercased back by CSS', () => {
    // `text-transform` would leave the accessible name, the copied text and any
    // translation carrying a casing the studio does not use. The mark IS lowercase,
    // so the DOM has to say so.
    render(<StudioWordmark />)
    expect(screen.getByRole('link')).toHaveTextContent(/^agentic development studio$/)
  })

  it('keeps the space between its two halves', () => {
    // JSX drops whitespace between elements on separate lines, so the space is an
    // explicit `{' '}`. Delete it and the mark silently reads "agentic
    // developmentstudio" — which no snapshot of the styling would catch, because it
    // still renders in the right font at the right size.
    render(<StudioWordmark />)
    expect(screen.getByRole('link').textContent).toBe('agentic development studio')
  })

  it('splits the name from the kind, which is what the two tones hang off', () => {
    // The bold/dim split is the mark's signature. It is done with two spans rather
    // than a `::first-line` or a nth-word hack, so the CSS has something real to
    // target — collapse them into one string and the mark goes flat with no error.
    render(<StudioWordmark />)
    const link = screen.getByRole('link')
    expect(link.querySelector('.adh-nav-popover__wordmark-name')).toHaveTextContent(
      'agentic development',
    )
    expect(link.querySelector('.adh-nav-popover__wordmark-kind')).toHaveTextContent('studio')
  })

  it('points at the studio, in place, with noopener', () => {
    // The studio has no registry entry by design (an entry would re-add the origin to
    // the OAuth return-origin allowlist), so this href is a literal and nothing
    // generated will notice if it rots. It opens in the same window because the menu
    // is a launcher and every other destination in it navigates the same way.
    render(<StudioWordmark />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://agenticdevelopmentstudio.com')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link).not.toHaveAttribute('target')
  })
})
