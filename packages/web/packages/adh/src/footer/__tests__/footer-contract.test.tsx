import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdhFooter } from '../AdhFooter'

// Stub next/link so the (otherwise DOM-invisible) `prefetch` prop can be observed —
// the real component destructures `prefetch` before spreading the rest onto the
// anchor (next/dist/client/link.js), so it never reaches the DOM on its own. The
// stub forwards everything else (href, onClick, className, children) unchanged so
// every other assertion in this file still exercises real link behavior.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, ...rest }: { href: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest} />
  ),
}))

describe('AdhFooter (identity-free)', () => {
  it('renders the copyright it is given, with no hardcoded brand', () => {
    render(<AdhFooter copyright={<span>© 2026 Example Co</span>} />)
    expect(screen.getByText('© 2026 Example Co')).toBeTruthy()
  })

  it('renders trailing as the last child of <footer>, a sibling of the container — not nested inside it', () => {
    render(<AdhFooter trailing={<span>chat</span>} />)
    const footer = screen.getByRole('contentinfo')
    const trailing = screen.getByText('chat')
    // Node identity, not a substring match: if `trailing` were moved inside
    // .adh-footer__container, footer.lastElementChild would be the container div
    // (whose textContent would still happen to include "chat"), not the trailing
    // node itself — a toHaveTextContent check alone would not catch that.
    expect(footer.lastElementChild).toBe(trailing)
  })

  it('renders a native popover trigger for popoverTarget entries', () => {
    render(<AdhFooter links={[{ label: 'Sites', popoverTarget: 'panel-1', ariaLabel: 'Sites — overview' }]} />)
    const btn = screen.getByRole('button', { name: 'Sites — overview' })
    expect(btn.getAttribute('popovertarget')).toBe('panel-1')
    expect(btn.className).toContain('adh-footer__sites-trigger')
  })

  it('keeps the href on onSelect entries so they still work without JS', () => {
    let opened = false
    render(
      <AdhFooter
        links={[{ label: 'Terms', href: '/terms', onSelect: (e) => { e.preventDefault(); opened = true } }]}
      />,
    )
    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link.getAttribute('href')).toBe('/terms')
    link.click()
    expect(opened).toBe(true)
  })

  it('renders nothing brand-specific when given no props', () => {
    const { container } = render(<AdhFooter />)
    expect(container.textContent).not.toMatch(/FishLamp/)
  })

  it('renders no navigation links at all when unconfigured — there is no hard-coded default set', () => {
    render(<AdhFooter />)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('passes prefetch through to the rendered anchor when given, and leaves it alone otherwise', () => {
    render(
      <AdhFooter
        links={[
          { label: 'Terms', href: '/terms', prefetch: false },
          { label: 'GitHub', href: 'https://example.com' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('data-prefetch')).toBe('false')
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('data-prefetch')).toBe('undefined')
  })
})
