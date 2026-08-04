/** DocNavTree / DocNav (HDV) — the document tree and the column that carries it. */

import * as React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  DocNav,
  DocNavTree,
  DOC_NAV_ASIDE_CLASS,
  DOC_NAV_BRANCH_LIST_CLASS,
  DOC_NAV_DESKTOP_NAV_CLASS,
  DOC_NAV_DRAWER_CLASS,
  DOC_NAV_NAV_CLASS,
  DOC_NAV_OVERLAY_CLASS,
  DOC_NAV_SCRIM_CLASS,
  DOC_NAV_SECTION_LIST_CLASS,
} from '../blocks/doc-nav'
import type { HdvNavNode } from '../blocks/doc-types'

// principles/            ← section (collapses)
//   Overview             ← leaf
//   testing/             ← branch (never collapses)
//     Pyramid            ← leaf
const NODES: HdvNavNode[] = [
  {
    label: 'Principles',
    href: '/principles',
    children: [
      { label: 'Overview', href: '/principles/overview' },
      {
        label: 'Testing',
        href: '/principles/testing',
        children: [{ label: 'Pyramid', href: '/principles/testing/pyramid' }],
      },
    ],
  },
  { label: 'Recipes', href: '/recipes', children: [{ label: 'Soup', href: '/recipes/soup' }] },
]

const WITH_HEADINGS: HdvNavNode[] = [
  {
    label: 'Appendix',
    href: '/appendix',
    children: [
      {
        label: 'Decision 1',
        href: '/appendix/decisions/one',
        headings: [
          { id: 'context', text: 'Context', depth: 2 },
          { id: 'outcome', text: 'Outcome', depth: 2 },
        ],
      },
    ],
  },
]

const control = (name: string) => screen.getByRole('button', { name })

describe('DocNavTree', () => {
  it('collapses a section the reader is not inside', () => {
    render(<DocNavTree nodes={NODES} activePath="/" />)
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull()
    expect(control('Expand Principles').getAttribute('aria-expanded')).toBe('false')
  })

  it('opens the section the active page is inside, and only that one', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles/testing/pyramid" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Soup' })).toBeNull()
  })

  it('opens a section that IS the active page', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
  })

  it('toggles a section both ways, rotating its chevron', () => {
    const { container } = render(<DocNavTree nodes={NODES} activePath="/" />)
    const chevron = () => container.querySelector('svg')!

    expect(chevron().getAttribute('class')).not.toContain('rotate-90')
    fireEvent.click(control('Expand Principles'))

    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
    expect(chevron().getAttribute('class')).toContain('rotate-90')

    fireEvent.click(control('Collapse Principles'))
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull()
  })

  it("keeps the reader's own collapse decision when the route changes", () => {
    // Re-deriving `expanded` from activePath on every render would slam a
    // section shut under someone who had just opened it to browse.
    const { rerender } = render(<DocNavTree nodes={NODES} activePath="/" />)
    fireEvent.click(control('Expand Principles'))

    rerender(<DocNavTree nodes={NODES} activePath="/recipes/soup" />)

    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
  })

  it('shows a nested directory expanded — only the top level latches', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles" />)
    expect(screen.getByRole('link', { name: 'Testing' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pyramid' })).toBeTruthy()
    // One control for each section, and none for the nested directory.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('marks the active page and nothing else with aria-current', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles/testing/pyramid" />)
    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual(['Pyramid'])
  })

  it('moves the mark when the route changes', () => {
    const { rerender } = render(
      <DocNavTree nodes={NODES} activePath="/principles/overview" />,
    )
    expect(
      screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current'),
    ).toBe('page')

    rerender(<DocNavTree nodes={NODES} activePath="/principles/testing/pyramid" />)

    expect(
      screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current'),
    ).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Pyramid' }).getAttribute('aria-current'),
    ).toBe('page')
  })

  it('lists pages before directories, whatever order the host passed', () => {
    // The host's array puts the directory first; the tree still reads
    // pages-then-directories so every level scans the same way.
    render(<DocNavTree nodes={NODES} activePath="/principles" />)
    const list = screen.getByRole('link', { name: 'Overview' }).closest('ul')!
    const labels = within(list)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels.slice(0, 3)).toEqual(['Overview', 'Testing', 'Pyramid'])
  })

  it('routes every link through the host component', () => {
    const Link = ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
      <a href={to} data-router="host" {...rest}>
        {children}
      </a>
    )
    render(<DocNavTree nodes={NODES} activePath="/principles" LinkComponent={Link} />)
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((link) => link.getAttribute('data-router') === 'host')).toBe(true)
  })

  it('applies the list contracts verbatim at each level', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles" />)
    expect(screen.getByRole('link', { name: 'Overview' }).closest('ul')!.className).toBe(
      DOC_NAV_SECTION_LIST_CLASS,
    )
    expect(screen.getByRole('link', { name: 'Pyramid' }).closest('ul')!.className).toBe(
      DOC_NAV_BRANCH_LIST_CLASS,
    )
  })
})

describe('DocNavTree — a leaf with its own headings', () => {
  const replaceState = vi.fn()
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    replaceState.mockClear()
    scrollIntoView.mockClear()
  })

  it('renders every heading it is given — HDV filters none of them', () => {
    render(<DocNavTree nodes={WITH_HEADINGS} activePath="/appendix" />)
    expect(screen.getByRole('link', { name: 'Context' }).getAttribute('href')).toBe(
      '/appendix/decisions/one#context',
    )
    expect(screen.getByRole('link', { name: 'Outcome' })).toBeTruthy()
  })

  it('routes an inlined heading through the host component too', () => {
    // A heading link that skips the router is a full document load — the reader
    // sees a white flash and loses the tree's state, to reach a heading that was
    // already on screen. It was a plain <a> until this was asserted.
    const Link = ({ to, children, ...rest }: { to: string; children?: React.ReactNode }) => (
      <a href={to} data-router="host" {...rest}>
        {children}
      </a>
    )
    render(<DocNavTree nodes={WITH_HEADINGS} activePath="/appendix" LinkComponent={Link} />)
    expect(screen.getByRole('link', { name: 'Context' }).getAttribute('data-router')).toBe('host')
  })

  it('renders no heading list for a leaf without headings', () => {
    render(<DocNavTree nodes={NODES} activePath="/principles" />)
    expect(
      screen.getByRole('link', { name: 'Overview' }).parentElement!.querySelector('ul'),
    ).toBeNull()
  })

  it('scrolls instead of navigating when its page is already open', () => {
    render(
      <DocNavTree nodes={WITH_HEADINGS} activePath="/appendix/decisions/one" />,
    )
    const target = document.createElement('h2')
    target.id = 'context'
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    screen.getByRole('link', { name: 'Context' }).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    // The position stays linkable even though navigation was cancelled.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/appendix/decisions/one#context')

    target.remove()
  })

  it('navigates normally from a different page', () => {
    render(<DocNavTree nodes={WITH_HEADINGS} activePath="/appendix" />)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    screen.getByRole('link', { name: 'Context' }).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(replaceState).not.toHaveBeenCalled()
  })
})

describe('DocNav', () => {
  const TOP = [
    { label: 'Overview', href: '/' },
    { label: 'Projects', href: '/projects' },
  ]

  it('renders the fixed rows above the tree, with a rule between', () => {
    const { container } = render(
      <DocNav nodes={NODES} activePath="/" topLinks={TOP} />,
    )
    expect(screen.getByRole('link', { name: 'Projects' })).toBeTruthy()
    expect(container.querySelectorAll('nav > div.border-t')).toHaveLength(1)
  })

  it('drops the rule along with the rows', () => {
    // The rule separates the fixed rows from the tree; with no rows it would
    // read as an empty first section.
    const { container } = render(<DocNav nodes={NODES} activePath="/" />)
    expect(container.querySelectorAll('nav > div.border-t')).toHaveLength(0)
  })

  it('marks the active fixed row', () => {
    const { container } = render(
      <DocNav nodes={NODES} activePath="/projects" topLinks={TOP} />,
    )
    const marks = container.querySelectorAll('h3 > span.bg-\\[var\\(--color-accent\\)\\]')
    expect(marks).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Projects' }).closest('h3')!.contains(marks[0]!)).toBe(
      true,
    )
  })

  it('shows only the desktop column when closed', () => {
    const { container } = render(<DocNav nodes={NODES} activePath="/" />)
    const asides = container.querySelectorAll('aside')
    expect(asides).toHaveLength(1)
    expect(asides[0]!.className).toBe(DOC_NAV_ASIDE_CLASS)
    expect(container.querySelector('nav')!.className).toBe(
      `${DOC_NAV_NAV_CLASS} ${DOC_NAV_DESKTOP_NAV_CLASS}`,
    )
  })

  it('adds the drawer when open, with the same nav inside', () => {
    const { container } = render(<DocNav nodes={NODES} activePath="/" open />)
    const asides = Array.from(container.querySelectorAll('aside'))
    expect(asides.map((aside) => aside.className)).toEqual([
      DOC_NAV_ASIDE_CLASS,
      DOC_NAV_DRAWER_CLASS,
    ])
    expect(container.querySelectorAll('nav')).toHaveLength(2)
  })

  it('stops rows wrapping in the column, and lets them wrap in the drawer', () => {
    // A wrapped row in a tree reads as two entries. The column is wide and can
    // scroll sideways, so nothing there wraps; the drawer is a phone's whole
    // width, where a second line beats dragging a row sideways to finish it.
    // `white-space` inherits, so the ONE declaration on the nav does every depth.
    const { container } = render(<DocNav nodes={NODES} activePath="/" open />)
    const [column, drawer] = Array.from(container.querySelectorAll('nav'))

    expect(column!.className).toContain('whitespace-nowrap')
    expect(column!.className).toContain('overflow-x-auto')
    expect(drawer!.className).toBe(DOC_NAV_NAV_CLASS)
    expect(drawer!.className).not.toContain('whitespace-nowrap')
  })

  it('renders the fixed rows below the tree, with the rule above them', () => {
    // The mirror of `topLinks`: same row, other end, and the rule moves with it —
    // above the rows rather than below, because down there it OPENS them.
    const { container } = render(
      <DocNav nodes={NODES} activePath="/" bottomLinks={[{ label: 'Cookbook Project', href: '/projects' }]} />,
    )
    const children = Array.from(container.querySelector('nav')!.children)
    const rule = children.findIndex((el) => el.className.includes('border-t'))
    const row = children.findIndex((el) => el.querySelector('h3'))

    expect(rule).toBeGreaterThan(-1)
    expect(row).toBe(rule + 1)
    expect(screen.getByRole('link', { name: 'Cookbook Project' })).toBeTruthy()
  })

  it('draws a rule at each end when both ends carry rows', () => {
    const { container } = render(
      <DocNav
        nodes={NODES}
        activePath="/"
        topLinks={TOP}
        bottomLinks={[{ label: 'Cookbook Project', href: '/projects' }]}
      />,
    )
    expect(container.querySelectorAll('nav > div.border-t')).toHaveLength(2)
  })

  it('opens the drawer BELOW the header, never over or under it', () => {
    // The overlay used to be `fixed inset-0 z-50` — the same z-index the shared
    // header carries, so DOM order decided which won and the drawer painted over
    // the header, burying the toggle that had just been pressed. The fix is
    // geometric, not a restack: the overlay starts one header-height down, so the
    // two boxes cannot overlap however their z-indexes drift. Asserting all three
    // legs, because losing any one silently restores the collision.
    const { container } = render(<DocNav nodes={NODES} activePath="/" open />)
    const overlay = container.querySelector('div.z-40')!

    expect(overlay.className).toBe(DOC_NAV_OVERLAY_CLASS)
    // Below the header, and never reaching back up over it. The offset READS the
    // header's own height rather than restating it: the adh header is a bar plus a
    // preview strip, so any literal here is a copy that goes stale the next time the
    // header grows — which is exactly how this drawer came to be off by 1.125rem.
    expect(overlay.className).toContain('top-[var(--adh-header-height,3.5rem)]')
    expect(overlay.className).not.toMatch(/\btop-\d/)
    expect(overlay.className).not.toContain('inset-0')
    // Under the header in the stack too, so the header stays clickable.
    expect(overlay.className).toContain('z-40')
    // Both children position against the overlay, not the viewport — a `fixed`
    // scrim or panel here would climb back over the header on its own.
    expect(DOC_NAV_SCRIM_CLASS.startsWith('absolute ')).toBe(true)
    expect(DOC_NAV_DRAWER_CLASS.startsWith('absolute ')).toBe(true)
  })

  it('gates the drawer on `open` alone — no responsive gate anywhere', () => {
    // The overlay was `lg:hidden` while the host's toggle was `lg:hidden` too, so
    // the pair only agreed by coincidence. A host that shows the button at every
    // width (cookbook now does) got a control that did nothing above 1024px, with
    // no failing test anywhere to say so. `open` is the only gate there is.
    const { container } = render(<DocNav nodes={NODES} activePath="/" open />)
    const overlay = container.querySelector('div.z-40')!

    for (const cls of overlay.className.split(' ')) {
      expect(cls).not.toMatch(/^(sm|md|lg|xl|2xl):/)
    }
    expect(DOC_NAV_SCRIM_CLASS).not.toMatch(/\b(sm|md|lg|xl|2xl):/)
    expect(DOC_NAV_DRAWER_CLASS).not.toMatch(/\b(sm|md|lg|xl|2xl):/)
  })

  it('offers exactly ONE announced dismiss control', () => {
    // The scrim used to be a full-screen <button> carrying `closeLabel` too, so
    // a screen reader met two identically-named controls and a button covering
    // the whole page. Asserting the count is what keeps that from coming back.
    render(<DocNav nodes={NODES} activePath="/" open onClose={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(1)
  })

  it('still dismisses from the scrim, which is not in the a11y tree', () => {
    const onClose = vi.fn()
    const { container } = render(
      <DocNav nodes={NODES} activePath="/" open onClose={onClose} />,
    )

    // A scrim, not a control: it dismisses for a pointer user, but it is
    // neither focusable nor announced. The X is the keyboard/SR path.
    const scrim = container.querySelector(
      `div.${DOC_NAV_SCRIM_CLASS.split(' ').join('.').replace('/', '\\/')}`,
    )!
    expect(scrim.getAttribute('aria-hidden')).toBe('true')
    expect(scrim.tagName).toBe('DIV')
    expect(scrim.hasAttribute('tabindex')).toBe(false)

    fireEvent.click(scrim)
    fireEvent.click(control('Close navigation'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('lets the host rename the drawer and its dismiss control', () => {
    render(
      <DocNav
        nodes={NODES}
        activePath="/"
        open
        title="Contents"
        closeLabel="Dismiss"
      />,
    )
    expect(screen.getByText('Contents')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1)
  })

  it('keeps a drawer expansion after the drawer closes', () => {
    // The tree's open/closed state is hoisted above both shells because the two
    // shells are two component INSTANCES of one element description. Held inside
    // the tree, the drawer's copy would die with the `open &&` unmount and every
    // mobile expansion would be lost the moment the reader closed the drawer.
    const { rerender } = render(<DocNav nodes={NODES} activePath="/" open />)

    // Two shells ⇒ two controls with this name; either one drives both.
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand Principles' })[0]!)
    expect(screen.getAllByRole('link', { name: 'Overview' })).toHaveLength(2)

    rerender(<DocNav nodes={NODES} activePath="/" />)
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
  })

  it('merges a host className onto the desktop column and spreads its attributes', () => {
    render(
      <DocNav nodes={NODES} activePath="/" className="w-96" data-testid="nav" />,
    )
    const aside = screen.getByTestId('nav')
    expect(aside.className).toContain('w-96')
    expect(aside.className).not.toContain('w-80')
    expect(aside.className).toContain('sticky')
  })
})
