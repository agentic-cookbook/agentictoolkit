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
const SHEETS = ['base.css', 'chrome.css', 'blocks.css', 'flow.css'] as const

/**
 * Split a selector LIST on its top-level commas, leaving commas inside
 * `:has()` / `:is()` / `:where()` arguments alone — `:has(.lp-deck, .lp-flow)`
 * is one selector, not two fragments. The naive `.split(',')` this replaced
 * cut that gate in half and neither half was a selector any assertion below
 * could match.
 */
function topLevel(list: string): string[] {
  const out: string[] = []
  let current = ''
  let depth = 0
  for (const char of list) {
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current) out.push(current)
  return out
}

/** Every selector list in a sheet, with comments and at-rule preludes dropped. */
function selectors(sheet: string): string[] {
  const css = readFileSync(join(CSS_DIR, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  for (const [, , list] of css.matchAll(/(^|[}\n])\s*([^{}@][^{}]*?)\s*\{/g)) {
    for (const one of topLevel(list)) {
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
    // Guard the guard: a regex that matched nothing would pass vacuously. The
    // floor guards the PARSER, not a sheet's size — it was `>10` when every
    // sheet here was 300+ lines, which flow.css (7 selectors at birth, ~20 by
    // the time bands, drift and depth land) would have failed for several
    // tasks and then started passing on its own. `>3` is the smallest sheet
    // this package ships setting the number, not an aesthetic choice.
    expect(found.length).toBeGreaterThan(3)
    // Asserted over EVERY comma-separated part, at any nesting depth, and not
    // over the whole selector — `topLevel` deliberately keeps a functional
    // pseudo-class's arguments joined, and `:where(.lp-card, div)` contains
    // `.lp-` as a whole while reaching every bare `<div>` the host ships. Each
    // argument of an `:is()` / `:where()` / `:has()` list is a selector in its
    // own right and has to name `.lp-` on its own, so the check splits on all
    // commas even though the parsing above does not.
    const parts = found.flatMap((s) => s.split(',').map((p) => p.trim()))
    expect(parts.filter((s) => !s.includes('.lp-'))).toEqual([])
  })
})

describe('the document-level rules are gated on a layout root, at their original weight', () => {
  const base = selectors('base.css')

  // Asserted as whole selectors rather than as substrings of the file: the
  // gated spellings all CONTAIN the ungated ones, so `not.toContain('body')`
  // would fail on the fix and `toContain('body')` passes on the defect. The
  // gate now admits `.lp-flow` alongside `.lp-deck`, so selectors include both.
  it.each([
    // `html:where(:has(.lp-deck, .lp-flow))` is (0,0,1) — what a bare `html` was.
    // `html:has(.lp-deck, .lp-flow)` would be (0,1,1) and start beating host
    // overrides it loses to today; `:where(html:has(.lp-deck, .lp-flow))` alone
    // would be (0,0,0) and lose to rules it currently beats. Both look like
    // scoping and are cascade changes, and neither is visible to a test that
    // only asks whether the rules still apply on a layout root.
    ['html', 'html:where(:has(.lp-deck, .lp-flow))'],
    ['html[data-snap]', 'html[data-snap]:where(:has(.lp-deck))'],
    // `:where(html:has(.lp-deck, .lp-flow)) body` is (0,0,1) — what a bare `body` was.
    ['body', ':where(html:has(.lp-deck, .lp-flow)) body'],
    ['::selection', ':where(html:has(.lp-deck, .lp-flow)) ::selection'],
    // `* { animation: none !important }` from a package a host imported for
    // one route is the loudest rule in this file: it cancels every animation
    // and transition the HOST wrote, everywhere, and `!important` means no
    // host rule can win it back.
    ['*', ':where(html:has(.lp-deck, .lp-flow)) *'],
    ['*::before', ':where(html:has(.lp-deck, .lp-flow)) *::before'],
    ['*::after', ':where(html:has(.lp-deck, .lp-flow)) *::after'],
  ])('%s is written %s', (ungated, gated) => {
    expect(base).toContain(gated)
    expect(base).not.toContain(ungated)
  })

  // The two above are assertions about the TEXT. These run the gated selectors
  // through a real selector engine against a real document, because a gate that
  // is spelled right and matches nothing is the same defect the other way up:
  // the layout root would lose its own type, snapping (deck only) and ground,
  // and every assertion in this file would still pass.
  //
  // `querySelector` cannot match a pseudo-element, so each gate is probed for
  // its ORIGINATING element: `… ::selection` and `… *::before` both ask about
  // `… *`. Dropping the pseudo rather than skipping the rule keeps ::selection
  // and the reduced-motion reset — two of the four rules that leaked — in the
  // set being checked.
  const isLayoutRoot = (s: string) => s.includes('.lp-deck') || s.includes('.lp-flow')
  const gates = base
    .filter((s) => isLayoutRoot(s) && !s.startsWith('.lp-deck') && !s.startsWith('.lp-flow'))
    .map((s) => s.replace(/::[a-z-]+/g, '').replace(/(^|\s)$/, '$1*'))

  // A CLOSED SET, and the one assertion here that is a list on purpose.
  //
  // Every other check in this file asks whether the document rules that exist
  // are gated. None asks which rules are allowed to exist. A correctly gated
  // `:where(html:has(.lp-deck, .lp-flow)) img` passes all of them — it names
  // `.lp-`, it is properly gated, it matches a flow and not a bare host route —
  // and it silently restyles every image on the page. That is a document-level
  // rule reaching an element the package did not put there, which is the exact
  // class of defect this file exists to prevent, arriving through the front
  // door rather than around the gate.
  //
  // So the SUBJECTS are pinned, not just the gates. Adding a document rule is a
  // decision that has to be made deliberately and reviewed; this test is what
  // turns it from an edit nobody notices into a failure with a name on it.
  // Swept across EVERY sheet, not just base.css. "base.css is the only sheet
  // that addresses the document" is a constraint this package states and has
  // never actually checked — a gated `html`-reaching rule dropped into
  // flow.css or blocks.css would satisfy every other assertion in this file,
  // and a base.css-only sweep would not look at it.
  const strip = (s: string) =>
    s
      .replace(/:where\(:has\([^)]*\)\)/, '')
      .replace(/^:where\(html:has\([^)]*\)\)\s*/, '')
      .trim()

  it('adds no document-level rule beyond the sanctioned subjects', () => {
    const documentRules = SHEETS.flatMap((sheet) =>
      selectors(sheet)
        .map((s) => ({ sheet, subject: strip(s) }))
        // A subject that still names `.lp-` reaches only what the package put
        // on the page — that is an ordinary rule, whatever gate precedes it.
        .filter(({ subject }) => !subject.includes('.lp-')),
    )

    expect([...new Set(documentRules.map((r) => r.sheet))]).toEqual(['base.css'])
    expect([...new Set(documentRules.map((r) => r.subject))].sort()).toEqual([
      '*',
      '*::after',
      '*::before',
      '::selection',
      'body',
      'html',
      'html[data-smooth]',
      'html[data-snap]',
    ])
  })

  // Partitioned, never listed: which document rules a flow page inherits is the
  // whole point of the widened gate, and a hand-kept list of them would go stale
  // the moment a rule is added — silently, and in the direction that passes.
  const flowGates = gates.filter((s) => s.includes('.lp-flow'))
  const deckOnlyGates = gates.filter((s) => !s.includes('.lp-flow'))

  // The gated rules that also need an ARMED attribute — `data-snap` from
  // ARM_SNAPPING, `data-smooth` from ARM_SMOOTH on the first interaction — are
  // stamped on <html> by `DeckScript` at runtime, never by the markup, so the probe
  // has to stamp them itself. A gate whose flag is missing here reads as "spelled
  // wrong", which is the very defect this probe exists to catch.
  //
  // DERIVED from the gates rather than listed, because a list goes stale silently
  // and already did: `[data-smooth]` was added to base.css after this file was
  // written, and from then on the positive probe was asserting that a real,
  // correctly-spelled rule matches nothing.
  const armed = [
    ...new Set(gates.flatMap((s) => [...s.matchAll(/\[([a-z-]+)\]/g)].map((m) => m[1]))),
  ]
  const arm = () => armed.forEach((a) => document.documentElement.setAttribute(a, ''))

  it('matches the document while a deck is mounted', () => {
    expect(gates.length).toBeGreaterThan(5)
    expect(armed).toContain('data-snap')
    document.body.innerHTML =
      '<main><div class="lp-deck"><section class="lp-screen"></section></div></main>'
    // The fixture has to be the FULLY armed document, not a half-armed one.
    arm()
    for (const sel of gates) expect(document.querySelector(sel), sel).not.toBeNull()
  })

  // The reason this task exists, asserted against a selector engine rather than
  // against the text of base.css. Every text assertion in this file passed while
  // a flow page was getting NONE of these rules: the gate was spelled correctly,
  // it just named a class that page never renders.
  it('matches the document while a flow is mounted', () => {
    expect(flowGates.length).toBeGreaterThan(5)
    document.body.innerHTML =
      '<main><div class="lp-flow"><section class="lp-band"></section></div></main>'
    arm()
    for (const sel of flowGates) expect(document.querySelector(sel), sel).not.toBeNull()
  })

  it('withholds the deck-only rules from a flow', () => {
    // Snapping is the one document rule a flow must not inherit — it has no snap
    // points, and nothing stamps `data-snap` on a page that renders no
    // DeckScript. `arm()` stamps it anyway, so this fails if the gate widened.
    expect(deckOnlyGates.length).toBeGreaterThan(0)
    expect(deckOnlyGates.every((s) => s.includes('[data-snap]'))).toBe(true)
    document.body.innerHTML =
      '<main><div class="lp-flow"><section class="lp-band"></section></div></main>'
    arm()
    for (const sel of deckOnlyGates) expect(document.querySelector(sel), sel).toBeNull()
  })

  it('matches nothing once the deck leaves the DOM', () => {
    // A client-side navigation off `/` unmounts the deck and runs no cleanup —
    // `data-snap` in particular is stamped on <html> by ARM_SNAPPING and never
    // removed, so every armed attribute is left set here deliberately. The deck
    // is the only thing gone, which is the point: the gate is structural, and
    // this fixture holds neither `.lp-deck` nor `.lp-flow`.
    document.body.innerHTML = '<main><h1>Privacy</h1><p>Some prose.</p></main>'
    arm()
    for (const sel of gates) expect(document.querySelector(sel), sel).toBeNull()
  })
})
