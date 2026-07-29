/** DocTableOfContents (HDV) — the scrollspy right rail. */

import * as React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  DocTableOfContents,
  DOC_TABLE_OF_CONTENTS_CLASS,
} from '../blocks/doc-table-of-contents'
import type { HeadingEntry } from '../blocks/doc-types'
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
  restoreIntersectionObserver,
} from './fakeIntersectionObserver'

const HEADINGS: HeadingEntry[] = [
  { id: 'why', text: 'Why', depth: 2 },
  { id: 'how', text: 'How', depth: 3 },
  { id: 'change-history', text: 'Change History', depth: 2 },
]

let headingHost: HTMLElement | null = null

beforeEach(installIntersectionObserver)
afterEach(() => {
  restoreIntersectionObserver()
  headingHost?.remove()
  headingHost = null
})

/**
 * The rail links to real headings, so the spy needs them in the document. Their
 * text deliberately does NOT repeat the heading's — the rail is queried by role,
 * and identical text would make every link query ambiguous.
 */
function renderWithHeadings(ui: React.ReactElement) {
  headingHost = document.createElement('div')
  headingHost.innerHTML = HEADINGS.map(
    (h) => `<h${h.depth} id="${h.id}">${h.id} target</h${h.depth}>`,
  ).join('')
  document.body.appendChild(headingHost)
  return render(ui)
}

const link = (name: string) => screen.getByRole('link', { name })

describe('DocTableOfContents', () => {
  it('renders nothing when the document has no headings', () => {
    const { container } = render(<DocTableOfContents headings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('lists EVERY heading when excludeIds is omitted', () => {
    // Parity trap: HDV holds no opinion about which headings are chrome.
    // Cookbook hides its change history; another host will want it listed.
    renderWithHeadings(<DocTableOfContents headings={HEADINGS} />)
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Why',
      'How',
      'Change History',
    ])
  })

  it('drops exactly the excluded ids, and observes only what it lists', () => {
    renderWithHeadings(
      <DocTableOfContents headings={HEADINGS} excludeIds={['change-history']} />,
    )
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Why', 'How'])
    expect(screen.queryByRole('link', { name: 'Change History' })).toBeNull()
    expect(FakeIntersectionObserver.current.observed.map((el) => el.id)).toEqual([
      'why',
      'how',
    ])
  })

  it('renders nothing when every heading is excluded', () => {
    const { container } = render(
      <DocTableOfContents headings={HEADINGS} excludeIds={HEADINGS.map((h) => h.id)} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('indents depth-3 headings and links each to its anchor', () => {
    renderWithHeadings(<DocTableOfContents headings={HEADINGS} />)
    const why = link('Why')
    const how = link('How')
    expect(why.getAttribute('href')).toBe('#why')
    expect(why.className).toContain('pl-3')
    expect(how.className).toContain('pl-6')
  })

  it('moves the marker to whichever heading the reader reaches', () => {
    renderWithHeadings(<DocTableOfContents headings={HEADINGS} />)

    expect(link('Why').className).toContain('border-transparent')

    act(() => FakeIntersectionObserver.current.enter('how'))

    const how = link('How')
    expect(how.className).toContain('border-[var(--color-accent)]')
    expect(how.className).toContain('text-[var(--color-text-primary)]')
    expect(how.className).toContain('font-medium')
    expect(how.className).not.toContain('border-transparent')
    // The marker MOVES — it isn't additive.
    expect(link('Why').className).toContain('border-transparent')
  })

  it('observes with a sticky-header-aware band', () => {
    renderWithHeadings(<DocTableOfContents headings={HEADINGS} />)
    expect(FakeIntersectionObserver.current.options).toEqual({
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    })
  })

  it('scrolls smoothly instead of jumping the browser to the anchor', () => {
    renderWithHeadings(<DocTableOfContents headings={HEADINGS} />)
    const scrollIntoView = vi.fn()
    document.getElementById('how')!.scrollIntoView = scrollIntoView

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(link('How'), event)

    expect(event.defaultPrevented).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('applies the rail contract verbatim — cn() must not rewrite it', () => {
    renderWithHeadings(<DocTableOfContents data-testid="toc" headings={HEADINGS} />)
    expect(screen.getByTestId('toc').className).toBe(DOC_TABLE_OF_CONTENTS_CLASS)
  })

  it('keeps the rail contract when the host adds classes, and labels itself', () => {
    renderWithHeadings(
      <DocTableOfContents
        data-testid="toc"
        headings={HEADINGS}
        className="pl-2"
        title="Contents"
      />,
    )
    const aside = screen.getByTestId('toc')
    expect(aside.className).toContain('sticky')
    expect(aside.className).toContain('pl-2')
    expect(aside.querySelector('h4')!.textContent).toBe('Contents')
  })
})
