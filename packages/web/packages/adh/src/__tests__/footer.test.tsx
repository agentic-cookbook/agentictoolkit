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
  it('always renders the studio brand line', () => {
    render(<SiteFooter />)
    // Agentic Development Studio, which replaced FishLamp Design in the copyright.
    // FishLamp is still a family site with its own row in the sites overview — this
    // is scoped to the link role and to this exact name so the two stay distinct.
    expect(screen.getByRole('link', { name: 'Agentic Development Studio' })).toHaveAttribute(
      'href',
      'https://agenticdevelopmentstudio.com/',
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
