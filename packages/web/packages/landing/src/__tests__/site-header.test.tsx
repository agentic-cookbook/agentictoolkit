import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteHeader } from '../flow/SiteHeader'

const LINKS = [
  { href: '#one', label: 'One' },
  { href: '#two', label: 'Two' },
]
const SRC = readFileSync(join(__dirname, '..', 'flow', 'SiteHeader.tsx'), 'utf8')
const FLOW = readFileSync(join(__dirname, '..', 'css', 'flow.css'), 'utf8')

describe('SiteHeader', () => {
  it('is a client module', () => {
    expect(SRC.startsWith("'use client'")).toBe(true)
  })

  it('renders the brand and an inline nav link for every drawer link', () => {
    const { container } = render(<SiteHeader brand={<span>Brand</span>} links={LINKS} />)
    expect(screen.getByText('Brand')).toBeTruthy()
    // Asserted against the inline nav specifically, not by counting links on the
    // page. NavChrome renders the same links again in its drawer, but guards it
    // with `inert` while shut, and jsdom's `inert` support in the accessibility
    // tree is not something to hang a count on. A later task also gives the bar
    // its own shorter link list, which a global count would break.
    const nav = container.querySelector('.lp-site-nav')!
    expect(nav.querySelectorAll('a').length).toBe(LINKS.length)
    expect(nav.textContent).toContain('One')
    expect(container.querySelector('.lp-site-drawer-only')).not.toBeNull()
  })

  it('renders an action slot when given one', () => {
    render(<SiteHeader brand={<span>Brand</span>} links={LINKS} action={<a href="#x">Get it</a>} />)
    expect(screen.getByRole('link', { name: 'Get it' })).toBeTruthy()
  })

  it('scrolls away rather than sticking — nothing fixes the bar', () => {
    const rule = FLOW.slice(FLOW.indexOf('.lp-site-bar {'))
    expect(rule.slice(0, rule.indexOf('}'))).not.toMatch(/position:\s*(fixed|sticky)/)
  })
})
