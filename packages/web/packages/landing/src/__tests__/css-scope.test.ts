import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A host imports this package's stylesheets ONCE, site-wide, from its
 * `globals.css` — that is the only place a Next app has to put them. So every
 * rule in them is live on every route the host serves, not just on the deck,
 * and a rule that addresses the document repaints pages this package has never
 * heard of.
 *
 * That shipped. `base.css` declared bare `html`, `body`, `::selection` and a
 * `prefers-reduced-motion` `*` reset, and the three pilot sites' privacy, terms
 * and docs routes went to the deck's 87.5% root size and `--lp-font` stack
 * while the same routes on `main` stayed at the browser default and the theme
 * face. Nothing failed: the deck itself looked right, which is all any test or
 * screenshot of this package was looking at.
 *
 * The invariant below is what makes that unrepresentable rather than merely
 * fixed — every selector this package ships names `.lp-`, so a rule can only
 * reach an element the package put on the page or a document that currently
 * holds a deck. It is asserted over the SOURCE files because that is what a
 * person edits; `build:css` copies them to `dist/` verbatim.
 */
const CSS_DIR = join(__dirname, '..', 'css')
const SHEETS = ['base.css', 'chrome.css', 'blocks.css'] as const

/** Every selector list in a sheet, with comments and at-rule preludes dropped. */
function selectors(sheet: string): string[] {
  const css = readFileSync(join(CSS_DIR, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  for (const [, , list] of css.matchAll(/(^|[}\n])\s*([^{}@][^{}]*?)\s*\{/g)) {
    for (const one of list.split(',')) {
      const sel = one.replace(/\s+/g, ' ').trim()
      // An at-rule PRELUDE — `@media (min-width: 62rem)` — is not a selector
      // and has nothing to scope; the rules nested inside it are matched
      // separately and are what this file is about.
      if (sel.startsWith('@')) continue
      out.push(sel)
    }
  }
  return out
}

describe('the package never styles anything it did not put on the page', () => {
  it.each(SHEETS)('%s names .lp- in every selector', (sheet) => {
    const found = selectors(sheet)
    // Guard the guard: a regex that matched nothing would pass vacuously.
    expect(found.length).toBeGreaterThan(10)
    expect(found.filter((s) => !s.includes('.lp-'))).toEqual([])
  })
})

describe('the document-level rules are gated on the deck, at their original weight', () => {
  const base = selectors('base.css')

  // Asserted as whole selectors rather than as substrings of the file: the
  // gated spellings all CONTAIN the ungated ones, so `not.toContain('body')`
  // would fail on the fix and `toContain('body')` passes on the defect.
  it.each([
    // `html:where(:has(.lp-deck))` is (0,0,1) — what a bare `html` was.
    // `html:has(.lp-deck)` would be (0,1,1) and start beating host overrides
    // it loses to today; `:where(html:has(.lp-deck))` alone would be (0,0,0)
    // and lose to rules it currently beats. Both look like scoping and are
    // cascade changes, and neither is visible to a test that only asks whether
    // the rules still apply on a deck.
    ['html', 'html:where(:has(.lp-deck))'],
    ['html[data-snap]', 'html[data-snap]:where(:has(.lp-deck))'],
    // `:where(html:has(.lp-deck)) body` is (0,0,1) — what a bare `body` was.
    ['body', ':where(html:has(.lp-deck)) body'],
    ['::selection', ':where(html:has(.lp-deck)) ::selection'],
    // `* { animation: none !important }` from a package a host imported for
    // one route is the loudest rule in this file: it cancels every animation
    // and transition the HOST wrote, everywhere, and `!important` means no
    // host rule can win it back.
    ['*', ':where(html:has(.lp-deck)) *'],
    ['*::before', ':where(html:has(.lp-deck)) *::before'],
    ['*::after', ':where(html:has(.lp-deck)) *::after'],
  ])('%s is written %s', (ungated, gated) => {
    expect(base).toContain(gated)
    expect(base).not.toContain(ungated)
  })

  // The two above are assertions about the TEXT. These run the gated selectors
  // through a real selector engine against a real document, because a gate that
  // is spelled right and matches nothing is the same defect the other way up:
  // the deck would lose its own type, snapping and ground, and every assertion
  // in this file would still pass.
  //
  // `querySelector` cannot match a pseudo-element, so each gate is probed for
  // its ORIGINATING element: `… ::selection` and `… *::before` both ask about
  // `… *`. Dropping the pseudo rather than skipping the rule keeps ::selection
  // and the reduced-motion reset — two of the four rules that leaked — in the
  // set being checked.
  const gates = base
    .filter((s) => s.includes('.lp-deck') && !s.startsWith('.lp-deck'))
    .map((s) => s.replace(/::[a-z-]+/g, '').replace(/(^|\s)$/, '$1*'))

  it('matches the document while a deck is mounted', () => {
    expect(gates.length).toBeGreaterThan(5)
    document.body.innerHTML =
      '<main><div class="lp-deck"><section class="lp-screen"></section></div></main>'
    // Both flags DeckScript stamps on <html>, because a gate is only reachable once its flag is
    // armed: `data-snap` by ARM_SNAPPING, `data-smooth` by ARM_SMOOTH on the first interaction.
    // A gate whose flag is missing here would read as "spelled wrong" — the very defect the probe
    // exists to catch — so the fixture has to be the armed document, not a half-armed one.
    document.documentElement.setAttribute('data-snap', '')
    document.documentElement.setAttribute('data-smooth', '')
    for (const sel of gates) expect(document.querySelector(sel), sel).not.toBeNull()
  })

  it('matches nothing once the deck leaves the DOM', () => {
    // A client-side navigation off `/` unmounts the deck and runs no cleanup —
    // `data-snap` in particular is stamped on <html> by ARM_SNAPPING and never
    // removed, so it is left set here deliberately.
    document.body.innerHTML = '<main><h1>Privacy</h1><p>Some prose.</p></main>'
    document.documentElement.setAttribute('data-snap', '')
    for (const sel of gates) expect(document.querySelector(sel), sel).toBeNull()
  })
})
