import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteHeader } from '../flow/SiteHeader'

const LINKS = [
  { href: '#one', label: 'One' },
  { href: '#two', label: 'Two' },
]
const SRC = readFileSync(join(__dirname, '..', 'flow', 'SiteHeader.tsx'), 'utf8')
const FLOW = readFileSync(join(__dirname, '..', 'css', 'flow.css'), 'utf8')

// jsdom ships no ResizeObserver, and the workspace setup file installs a no-op
// shim for every test. That shim is not enough here: the remount test has to
// FIRE the observer, so this one hands the callback back. Assigned rather than
// `??=`d, precisely because the shim is already there and would win.
const observers: ResizeObserverCallback[] = []
globalThis.ResizeObserver = class {
  constructor(cb: ResizeObserverCallback) {
    observers.push(cb)
  }
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

  it('renders barLinks in the bar while the drawer still renders all of links', () => {
    const BAR = [LINKS[0]!]
    const { container } = render(<SiteHeader brand={<span>Brand</span>} links={LINKS} barLinks={BAR} />)
    const nav = container.querySelector('.lp-site-nav')!
    expect(nav.querySelectorAll('a').length).toBe(BAR.length)
    expect(nav.textContent).toContain('One')
    expect(nav.textContent).not.toContain('Two')

    // The drawer is NavChrome's own <nav>, not `.lp-site-nav` — it keeps the
    // full list regardless of what the bar was given.
    const drawer = container.querySelector('.lp-site-drawer-only')!
    const drawerLinks = drawer.querySelectorAll('a[href]')
    expect(drawerLinks.length).toBe(LINKS.length)
    expect(drawer.textContent).toContain('Two')
  })

  it('renders an action slot when given one', () => {
    render(<SiteHeader brand={<span>Brand</span>} links={LINKS} action={<a href="#x">Get it</a>} />)
    expect(screen.getByRole('link', { name: 'Get it' })).toBeTruthy()
  })

  it('hides the action below the breakpoint, where the fixed burger owns that corner', () => {
    // `.lp-bar` is `position: fixed` with `--lp-bar-pad-x`'s 1.25rem right
    // gutter, and `.lp-site-bar`'s `min(100% - 2.5rem, …)` centred is the same
    // 1.25rem inset — two right-aligned controls on one line with nothing
    // reserving space for either. The burger is z-index 40 against this bar's
    // 30, so it painted over a host's CTA and took the clicks on its right
    // third: a tap there opened the drawer instead of following the link.
    //
    // Asserted on the DECLARATION, not just the selector: a `.lp-site-action`
    // rule setting something else would satisfy a substring search while
    // leaving the overlap exactly where it was.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const bare = /(^|[},])\s*\.lp-site-action\s*\{([^}]*)\}/m.exec(rules)
    expect(bare).not.toBeNull()
    expect(bare![2]).toMatch(/display:\s*none/)

    // …and comes back above it, where the burger is gone. Two `62rem` blocks
    // exist (the other is `.lp-bleed`'s) and the header's is the later one;
    // nothing after it touches `.lp-site-action`, so searching from there is
    // enough — but the hiding rule must come FIRST or the cascade inverts.
    const mediaAt = rules.lastIndexOf('@media (min-width: 62rem)')
    expect(mediaAt).toBeGreaterThan(bare!.index)
    expect(rules.slice(mediaAt)).toMatch(/\.lp-site-action\s*\{[^}]*display:\s*block/)
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
    // lands in the same top-left corner as .lp-site-brand. Read the rule's
    // BODY, not just its selector: a rule with this selector and some other
    // property would satisfy a bare substring search while leaving the burger
    // exactly where the bug put it.
    const rule = FLOW.slice(FLOW.indexOf('.lp-site-drawer-only .lp-burger {'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('margin-left: auto')
  })

  it('omits the brand element entirely when there is no brand', () => {
    const { container } = render(<SiteHeader links={LINKS} />)
    expect(container.querySelector('.lp-site-brand')).toBeNull()
  })

  it('remounts the drawer when it is hidden, so no Tab trap outlives it', () => {
    // NavChrome's Tab trap is keyed on `open`, not on visibility. Left open
    // across a resize past the breakpoint it preventDefault()s every Tab over a
    // display:none subtree — Tab does nothing on the page until Escape.
    //
    // Drive the observer rather than pinning the source text: "the file
    // mentions ResizeObserver" passes on a component that observes the wrong
    // element or never raises `generation`. A remount is observable as the
    // drawer's DOM node being replaced, which is exactly what drops the old
    // instance's listener.
    //
    // jsdom lays nothing out, so every box is already 0x0 — which is what the
    // component reads as "hidden". The width has to be real BEFORE the effect
    // runs, because that is where the observer's first `visible` is read; a
    // stub applied after render leaves it already false and no transition
    // happens. Hence the prototype patch around the render, restored after.
    const real = Element.prototype.getBoundingClientRect
    let width = 320
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      return { ...real.call(this), width } as DOMRect
    }
    // `observers` is module-scoped and every earlier render in this file has
    // already pushed one, so count the delta rather than the total.
    const seen = observers.length
    try {
      const { container } = render(<SiteHeader links={LINKS} />)
      const before = container.querySelector('.lp-drawer')
      expect(before).not.toBeNull()
      expect(observers.length).toBe(seen + 1)

      width = 0
      act(() => {
        observers[seen]?.([], {} as ResizeObserver)
      })

      const after = container.querySelector('.lp-drawer')
      expect(after).not.toBeNull()
      expect(after).not.toBe(before)
    } finally {
      Element.prototype.getBoundingClientRect = real
    }
  })

  it('does not restate the breakpoint in JavaScript', () => {
    // flow.css is the breakpoint's one home. Comments come out first: the one
    // above the observer NAMES matchMedia in order to say why it is not used,
    // and a bare substring search cannot tell an anti-pattern being ruled out
    // from one being written.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('matchMedia')
  })
})
