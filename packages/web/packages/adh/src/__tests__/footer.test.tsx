import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteFooter } from '../footer/SiteFooter'

// Stub next/link so `prefetch` — which the real component destructures away before
// spreading the rest onto the anchor (next/dist/client/link.js) and so never reaches
// the DOM on its own — can be observed here. Forwards href/onClick/className/children
// unchanged so the pre-existing href assertions below still exercise real behavior.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, ...rest }: { href: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest} />
  ),
}))

describe('adh SiteFooter', () => {
  it('always renders the FishLamp brand line', () => {
    render(<SiteFooter />)
    // Scoped to the link role (not a bare getByText): the registry's own
    // "Studio & consulting" group lists FishLamp Design among the family sites
    // too (see @agentic-toolkit/adh-registry SITES), so the copyright's brand link is not the
    // only element carrying this text — pre-existing, unrelated to this task.
    expect(screen.getByRole('link', { name: 'FishLamp Design' })).toHaveAttribute(
      'href',
      'https://fishlamp.com/',
    )
  })

  it('always offers the legal links, even with no links passed — with their hrefs intact', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: /terms/i }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: /privacy/i }).getAttribute('href')).toBe('/privacy')
  })

  it('always offers the sites popover trigger, before any passed links', () => {
    render(<SiteFooter links={[{ label: 'GitHub', href: 'https://example.com' }]} />)
    const nav = screen.getByRole('navigation', { name: 'Footer' })
    const labels = Array.from(nav.children).map((el) => el.textContent)
    expect(labels).toEqual(['Sites', 'GitHub', 'Terms', 'Privacy'])
  })

  it('labels the sites trigger with the exact family-overview aria-label', () => {
    render(<SiteFooter />)
    expect(
      screen.getByRole('button', { name: 'Sites — Agentic Developer family overview' }),
    ).toBeInTheDocument()
  })

  it('disables prefetch on the legal links (sticky footer means they are always in-viewport), and leaves a site-passed link unaffected', () => {
    render(<SiteFooter links={[{ label: 'GitHub', href: 'https://example.com' }]} />)
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('data-prefetch', 'false')
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('data-prefetch', 'false')
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('data-prefetch', 'undefined')
  })
})
