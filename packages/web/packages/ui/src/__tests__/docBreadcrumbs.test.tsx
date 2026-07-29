/** DocBreadcrumbs (HDV) — the document reader's breadcrumb trail. These assert the
 *  extracted markup still matches what the cookbook site rendered before the move;
 *  the extraction is a move, not a redesign, so a class change here is a bug. */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { DocBreadcrumbs } from '../blocks/doc-breadcrumbs'
import type { DocLinkComponent } from '../blocks/doc-types'

const CRUMBS = [
  { label: 'Principles', path: '/principles' },
  { label: 'Simplicity', path: '/principles/simplicity' },
]

describe('DocBreadcrumbs', () => {
  it('renders nothing at the root, where a lone Home crumb would be noise', () => {
    const { container } = render(<DocBreadcrumbs crumbs={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Home, then a crumb per ancestor, with separators between', () => {
    render(<DocBreadcrumbs crumbs={CRUMBS} />)
    const nav = screen.getByLabelText('Breadcrumb')
    expect(nav.tagName).toBe('NAV')
    expect(nav.className).toContain('mb-4')

    const list = nav.querySelector('ol')!
    expect(list.className).toContain('font-mono')
    expect(list.className).toContain('text-[var(--color-text-dim)]')
    // Home + one <li> per crumb.
    expect(list.querySelectorAll('li')).toHaveLength(CRUMBS.length + 1)
    // One separator per crumb (never before Home).
    const separators = [...list.querySelectorAll('span')].filter(
      (el) => el.textContent === '/',
    )
    expect(separators).toHaveLength(CRUMBS.length)
    expect(separators[0]!.className).toBe('text-[var(--color-border)]')
  })

  it('links every crumb but the last — the current page is plain text', () => {
    render(<DocBreadcrumbs crumbs={CRUMBS} />)
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/principles',
    ])
    const current = screen.getByText('Simplicity')
    expect(current.tagName).toBe('SPAN')
    expect(current.className).toBe('text-[var(--color-text-secondary)]')
  })

  it('routes through the injected LinkComponent, never a hardcoded router', () => {
    const RouterLink: DocLinkComponent = ({ to, children, ...rest }) => (
      <a data-router="yes" href={`#${to}`} {...rest}>
        {children}
      </a>
    )
    render(<DocBreadcrumbs crumbs={CRUMBS} LinkComponent={RouterLink} />)
    const routed = screen.getAllByRole('link')
    expect(routed).toHaveLength(2)
    routed.forEach((a) => expect(a.getAttribute('data-router')).toBe('yes'))
    // The className HDV passes must survive the adapter's prop spread.
    expect(routed[0]!.className).toBe('hover:text-[var(--color-text-secondary)]')
  })

  it('lets the host rename and re-point the home crumb', () => {
    render(<DocBreadcrumbs crumbs={CRUMBS} homeLabel="Docs" homeHref="/docs" />)
    const home = screen.getByText('Docs')
    expect(home.getAttribute('href')).toBe('/docs')
  })
})
