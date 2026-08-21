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

  it('hides the action below the breakpoint, where the centred wordmark owns the row', () => {
    // Below the breakpoint the bar is the burger and the wordmark, and
    // `.lp-site-brand` centres by `margin-inline: auto` on the row's ONLY
    // visible item. Render the action too and the auto margins centre the
    // wordmark in what is left beside it, not in the bar — chip-left,
    // wordmark-centred stops being true on the one viewport it was built for.
    //
    // The rule predates that arrangement: it went in when the burger was sent
    // to the right gutter and painted over a host's CTA there (z-index 40
    // against this bar's 30), so a tap on the button's right third opened the
    // drawer instead of following the link. That collision is gone with the
    // burger; the rule is kept for the reason above.
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

  it('leaves the burger in the left gutter — nothing here moves it', () => {
    // NavChrome renders the burger as .lp-bar's first child, so left is where
    // it lands untouched, and left is where the drawer's ✕ opens: both read the
    // same `--lp-bar-pad-*` pair, so the chip becomes the ✕ in place. This sheet
    // sent it to the far end once, when the wordmark still started at the left
    // gutter; the wordmark centres now, and the push has to be gone rather than
    // merely unused, since it would put the two controls back in one corner.
    //
    // Asserted as "no rule in this sheet reaches the burger at all", not as "no
    // rule sets an auto margin on it". The narrow form is the vacuous one: with
    // the rule deleted there are no subjects left, so a per-rule check finds no
    // failures however it is written, and passes just as happily on a sheet
    // someone emptied. The broad form has a subject either way — the list of
    // burger-touching selectors, which must be empty. It is also the truer
    // claim: the arrangement is chrome.css's own default now, so this header
    // has nothing left to say about that control.
    //
    // Comments come out first: the rule's history is written where the rule
    // used to be, and a substring search cannot tell an account of a deleted
    // rule from the rule.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const touching = [...rules.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .map(([, selector]) => selector!.trim())
      .filter((selector) => /\.lp-burger\b/.test(selector))
    expect(touching).toEqual([])
  })

  it('centres the wordmark below the breakpoint, clear of the burger on both sides', () => {
    // The centring is `margin-inline: auto` on the row's only visible item, and
    // the `max-width` is what keeps that centre the VIEWPORT's: it reserves the
    // 32px chip's column on both sides, so a long wordmark wraps rather than
    // running under the button — and reserving only the left would shift the
    // whole mark right by half a chip. Assert the doubling explicitly; a
    // one-sided reserve satisfies "there is a max-width".
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const bare = /(^|[},])\s*\.lp-site-brand\s*\{([^}]*)\}/m.exec(rules)
    expect(bare).not.toBeNull()
    expect(bare![2]).toMatch(/margin-inline:\s*auto/)
    expect(bare![2]).toMatch(/max-width:\s*calc\(100% - 2 \*/)

    // …and goes back to the left end above it, where there is no burger and the
    // nav needs the room. Same cascade requirement as the action rule: the
    // centring must come FIRST.
    //
    // Anchored on the reset itself and then walked BACK to its enclosing media
    // block, rather than on `lastIndexOf('@media …')`. The sheet now ends with a
    // second 62rem block — the drawer variant's — and a search from the end
    // lands in that one, where the brand's margin is `auto` again; the test
    // would fail while describing something true.
    const resetAt = rules.indexOf('margin-left: 0')
    expect(resetAt).toBeGreaterThan(bare!.index)
    const mediaAt = rules.lastIndexOf('@media (min-width: 62rem)', resetAt)
    expect(mediaAt).toBeGreaterThan(bare!.index)
  })

  it('renders no inline link row under bar="drawer"', () => {
    // Absent from the DOM, not hidden: a display:none row is a dozen duplicate
    // in-page anchors that a crawler reads and a rotor reaches anyway.
    const { container } = render(<SiteHeader brand={<span>Brand</span>} links={LINKS} bar="drawer" />)
    expect(container.querySelector('.lp-site-nav')).toBeNull()
    expect(screen.getByText('Brand')).toBeTruthy()
    // …while the drawer still carries every link.
    // `.lp-nav` is on the anchor itself in NavChrome, not on a list around it.
    expect(container.querySelectorAll('a.lp-nav')).toHaveLength(LINKS.length)
  })

  it('marks both the bar and the drawer wrapper for the variant, and neither by default', () => {
    const drawer = render(<SiteHeader links={LINKS} bar="drawer" />).container
    expect(drawer.querySelector('.lp-site-bar--drawer')).not.toBeNull()
    expect(drawer.querySelector('.lp-site-drawer-only--always')).not.toBeNull()

    const dflt = render(<SiteHeader links={LINKS} />).container
    expect(dflt.querySelector('.lp-site-bar--drawer')).toBeNull()
    expect(dflt.querySelector('.lp-site-drawer-only--always')).toBeNull()
    expect(dflt.querySelector('.lp-site-nav')).not.toBeNull()
  })

  it('keeps the burger above the breakpoint for the variant, by not matching the hide', () => {
    // The hide has to be written so it EXCLUDES the variant. Re-showing it with
    // a second rule of the same (0,1,0) weight would leave the cascade to source
    // order — the one thing the package's renamed-selector rule says not to lean
    // on. So assert the shape, not just that the variant appears somewhere.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(rules).toMatch(/\.lp-site-drawer-only:not\(\.lp-site-drawer-only--always\)\s*\{[^}]*display:\s*none/)
    // And nothing anywhere sets `display` on the bare wrapper, which would hide
    // the variant too.
    const bareHide = /(^|[},])\s*\.lp-site-drawer-only\s*\{([^}]*)\}/m.exec(rules)
    expect(bareHide?.[2] ?? '').not.toMatch(/display:/)
  })

  it('re-centres the wordmark above the breakpoint for the variant, after the default resets it', () => {
    // The variant has a burger at every width, so the column reserve and the
    // centring are both live at every width — which means undoing BOTH halves of
    // the default block's reset (`margin-left: 0` and `max-width: none`), and
    // doing it after that block rather than before, since the two selectors
    // decide on weight only if the reset is not later.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const resetAt = rules.indexOf('margin-left: 0')
    const variant = /\.lp-site-bar--drawer \.lp-site-brand\s*\{([^}]*)\}/.exec(rules)
    expect(variant).not.toBeNull()
    expect(variant!.index).toBeGreaterThan(resetAt)
    expect(variant![1]).toMatch(/margin-left:\s*auto/)
    expect(variant![1]).toMatch(/max-width:\s*calc\(100% - 2 \*/)
  })

  it('takes the variant’s action out of flow, so it is not a flex item beside the wordmark', () => {
    // This is the whole reason the action can come back at all up here. The
    // wordmark centres by `margin-inline: auto` on the row's only in-flow item;
    // an action left in the flex row would re-centre it in the space beside the
    // button. Absolutely positioned, it is not a flex item and the centre stays
    // the viewport's.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const action = /\.lp-site-bar--drawer \.lp-site-action\s*\{([^}]*)\}/.exec(rules)
    expect(action).not.toBeNull()
    expect(action![1]).toMatch(/position:\s*absolute/)
    expect(action![1]).toMatch(/display:\s*block/)
  })

  it('outweighs the base bar rule rather than relying on coming after it', () => {
    // `.lp-site-bar.lp-site-bar--drawer` is (0,2,0) against `.lp-site-bar`'s
    // (0,1,0). Written as a lone `.lp-site-bar--drawer` the two would tie and
    // the full-bleed override would hold only while it stays below in the file.
    // Matched with the innermost-braces walk the burger test uses, not a lone
    // regex: `[^{}]*\{` from the top of the sheet would capture the enclosing
    // `@media` line as the selector.
    const rules = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')
    const bleed = [...rules.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(([, , body]) =>
      /width:\s*auto/.test(body!),
    )
    expect(bleed.map(([, selector]) => selector!.trim())).toEqual(['.lp-site-bar.lp-site-bar--drawer'])
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
