/** ViewSourceDisclosure (HDV) — the reader's "View source" text toggle. */

import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import {
  ViewSourceDisclosure,
  VIEW_SOURCE_DISCLOSURE_CLASS,
  VIEW_SOURCE_PRE_CLASS,
  VIEW_SOURCE_TRIGGER_CLASS,
} from '../blocks/view-source-disclosure'

const SOURCE = '# Title\n\nBody with  two spaces and a <script> that is not one.'

const trigger = () => screen.getByRole('button')
const panel = (container: HTMLElement) => container.querySelector('pre')

describe('ViewSourceDisclosure', () => {
  it('starts collapsed — the source is absent, not merely hidden', () => {
    const { container } = render(<ViewSourceDisclosure source={SOURCE} />)
    expect(panel(container)).toBeNull()
    expect(screen.queryByText(SOURCE)).toBeNull()
  })

  it('reveals and re-hides the source on click', () => {
    const { container } = render(<ViewSourceDisclosure source={SOURCE} />)

    fireEvent.click(trigger())
    expect(panel(container)!.textContent).toBe(SOURCE)

    fireEvent.click(trigger())
    expect(panel(container)).toBeNull()
  })

  it('renders the source verbatim — never as markup', () => {
    // The panel is a <pre> with a text child: a document containing HTML shows
    // that HTML, it does not become part of the page. DocArticle is the only
    // block in the family that trusts its input.
    const { container } = render(
      <ViewSourceDisclosure source={SOURCE} defaultOpen />,
    )
    const pre = panel(container)!
    expect(pre.textContent).toBe(SOURCE)
    expect(pre.querySelector('script')).toBeNull()
    expect(pre.childElementCount).toBe(0)
  })

  it('can start open', () => {
    const { container } = render(
      <ViewSourceDisclosure source={SOURCE} defaultOpen />,
    )
    expect(panel(container)!.textContent).toBe(SOURCE)
  })

  it('reports its state to assistive tech and names the panel it controls', () => {
    // The site's original button carried neither attribute; a screen reader had
    // no way to know the control expanded anything.
    const { container } = render(<ViewSourceDisclosure source={SOURCE} />)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger())

    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('aria-controls')).toBe(panel(container)!.id)
    expect(panel(container)!.id).not.toBe('')
  })

  it('claims to control the panel only while the panel exists', () => {
    // `aria-controls` is an IDREF. While collapsed the <pre> is not rendered, so
    // pointing at its id would be a dangling reference — an authoring error
    // (axe: aria-valid-attr-value), not a harmless no-op. `aria-expanded` is
    // what announces the collapsed state.
    render(<ViewSourceDisclosure source={SOURCE} />)
    expect(trigger().hasAttribute('aria-controls')).toBe(false)

    fireEvent.click(trigger())
    expect(trigger().hasAttribute('aria-controls')).toBe(true)

    fireEvent.click(trigger())
    expect(trigger().hasAttribute('aria-controls')).toBe(false)
  })

  it('rotates the chevron only while open', () => {
    const { container } = render(<ViewSourceDisclosure source={SOURCE} />)
    const chevron = () => container.querySelector('svg')!

    expect(chevron().getAttribute('class')).not.toContain('rotate-90')
    fireEvent.click(trigger())
    expect(chevron().getAttribute('class')).toContain('rotate-90')
  })

  it('labels itself "View source", and lets a host relabel it', () => {
    const { rerender } = render(<ViewSourceDisclosure source={SOURCE} />)
    expect(trigger().textContent).toBe('View source')

    rerender(<ViewSourceDisclosure source={SOURCE} label="Raw markdown" />)
    expect(trigger().textContent).toBe('Raw markdown')
  })

  it('applies the row and trigger contracts verbatim — cn() must not rewrite them', () => {
    const { container } = render(
      <ViewSourceDisclosure data-testid="vs" source={SOURCE} defaultOpen />,
    )
    expect(screen.getByTestId('vs').className).toBe(VIEW_SOURCE_DISCLOSURE_CLASS)
    expect(trigger().className).toBe(VIEW_SOURCE_TRIGGER_CLASS)
    expect(panel(container)!.className).toBe(VIEW_SOURCE_PRE_CLASS)
  })

  it('keeps the row contract when the host adds classes', () => {
    render(
      <ViewSourceDisclosure data-testid="vs" source={SOURCE} className="mt-0" />,
    )
    const row = screen.getByTestId('vs')
    expect(row.className).toContain('border-t')
    expect(row.className).toContain('mt-0')
    // twMerge resolves the conflict rather than emitting both margins.
    expect(row.className).not.toContain('mt-8')
  })

  it('renders an empty source as an empty panel, not as nothing', () => {
    // A document with no body still HAS a source; the toggle must not lie about
    // whether one exists.
    const { container } = render(<ViewSourceDisclosure source="" defaultOpen />)
    expect(panel(container)).not.toBeNull()
    expect(panel(container)!.textContent).toBe('')
  })
})
