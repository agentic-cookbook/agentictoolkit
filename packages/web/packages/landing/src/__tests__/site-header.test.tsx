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

// jsdom ships no ResizeObserver. SiteHeader only uses it to notice the drawer
// wrapper being hidden, which no test here exercises, so a no-op stub is the
// whole requirement.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver

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

  it('sits below the package chrome, so the fixed burger stays clickable', () => {
    // .lp-bar is 40, .lp-scrim 50, .lp-drawer 60 (chrome.css). Above any of
    // them this header covers the burger and, since it takes pointer events,
    // swallows its clicks — on the one viewport where the burger IS the nav.
    const rule = FLOW.slice(FLOW.indexOf('.lp-site-bar {'))
    const z = /z-index:\s*(\d+)/.exec(rule.slice(0, rule.indexOf('}')))
    expect(z).not.toBeNull()
    expect(Number(z?.[1])).toBeLessThan(40)
  })

  it('kills the bar gradient, which would strip across every band seam', () => {
    const rule = FLOW.slice(FLOW.indexOf('.lp-site-drawer-only {'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('--lp-bar-bg: none')
  })

  it('sends the burger to the far end, away from the wordmark', () => {
    // NavChrome renders the burger as .lp-bar's first child, so untouched it
    // lands in the same top-left corner as .lp-site-brand.
    expect(FLOW).toContain('.lp-site-drawer-only .lp-burger')
  })

  it('omits the brand element entirely when there is no brand', () => {
    const { container } = render(<SiteHeader links={LINKS} />)
    expect(container.querySelector('.lp-site-brand')).toBeNull()
  })

  it('remounts the drawer when it is hidden, so no Tab trap outlives it', () => {
    // NavChrome's Tab trap is keyed on `open`, not on visibility. Left open
    // across a resize past the breakpoint it preventDefault()s every Tab over a
    // display:none subtree — Tab does nothing on the page until Escape.
    expect(SRC).toContain('ResizeObserver')
    expect(SRC).toMatch(/key=\{generation\}/)
    // The breakpoint must NOT be restated in JS; flow.css is its one home.
    // Comments come out first: the one above the observer NAMES matchMedia in
    // order to say why it is not used, and a bare substring search cannot tell
    // an anti-pattern being ruled out from one being written.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('matchMedia')
  })
})
