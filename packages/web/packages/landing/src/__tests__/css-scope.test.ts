import { readdirSync, readFileSync } from 'node:fs'
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
const SRC_DIR = join(__dirname, '..')
const CSS_DIR = join(SRC_DIR, 'css')
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

/**
 * Split ONE selector on its top-level descendant spaces, so the compounds a
 * complex selector is built from can be examined one at a time. Spaces inside
 * `:has()` / `:is()` / `:where()` arguments are not combinators and are left
 * alone. `selectors()` has already collapsed runs of whitespace to one space.
 */
function topLevelParts(sel: string): string[] {
  const out: string[] = []
  let current = ''
  let depth = 0
  for (const char of sel) {
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ' ' && depth === 0) {
      if (current) out.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current) out.push(current)
  return out
}

/**
 * Splice out every `:where()` / `:is()`, promoting its ARGUMENT into the
 * compound: `:where(html):has(.lp-screen)` → `html:has(.lp-screen)`, and
 * `:where(html:has(.lp-deck, .lp-flow))` → `html:has(.lp-deck, .lp-flow)`.
 *
 * The distinction this draws is the whole reason `isDocumentRoot` works. CSS
 * has two kinds of functional pseudo-class and they are opposites here:
 *
 * - `:where()` and `:is()` are TRANSPARENT. Their argument is part of what the
 *   compound selects — `:where(html)` selects `html`. They exist to move
 *   specificity around, not to change the subject.
 * - `:has()`, `:not()`, `:nth-child()` and friends are FILTERS. Their argument
 *   is a condition the subject must satisfy, and is not itself selected.
 *
 * Treating both kinds alike is what let the round-5 escape through: dropping
 * every parenthesised group blindly deleted the `html` inside `:where(html)`.
 *
 * Each pass removes at least the wrapper's own characters, so this terminates.
 */
function inlineTransparent(s: string): string {
  const opener = /:(?:where|is)\(/
  let out = s
  for (;;) {
    const found = opener.exec(out)
    if (!found) return out
    const start = found.index
    let depth = 0
    let end = start + found[0].length - 1
    for (; end < out.length; end++) {
      if (out[end] === '(') depth++
      else if (out[end] === ')' && --depth === 0) break
    }
    // Unbalanced — not a selector this file can reason about. Leave it whole
    // rather than corrupting it; the probe still gets a say.
    if (end >= out.length) return out
    out = out.slice(0, start) + out.slice(start + found[0].length, end) + out.slice(end + 1)
  }
}

/**
 * Drop every remaining balanced `(…)` group — by this point they are all
 * filters: `html:has(.lp-screen)` → `html:has`. Square brackets are untouched,
 * so `html[data-snap]` keeps its attribute.
 */
function withoutArgs(s: string): string {
  let out = ''
  let depth = 0
  for (const char of s) {
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (depth === 0) out += char
  }
  return out
}

/** What a compound actually selects, with every gate and wrapper resolved. */
const subjectOf = (part: string) => withoutArgs(inlineTransparent(part))

/**
 * Does this compound select the document root itself, however it is spelled?
 * `html`, `html:has(…)`, `html[data-snap]:where(:has(…))`, `:where(html:has(…))`,
 * `:where(html):has(…)`, `:is(:where(html)):has(…)`, `body` and a bare `*` all
 * do. Asked structurally, because the spellings are unbounded — enumerating
 * them has now failed three times, and the last two escapes were both new
 * spellings of a defect an earlier round had "fixed".
 */
const isDocumentRoot = (part: string) => /^(?:\*|(?:html|body|:root)\b)/.test(subjectOf(part))

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

  // THE INVARIANT, ASKED OF A SELECTOR ENGINE RATHER THAN OF A STRING.
  //
  // Everything above this line reasons about selector TEXT, and every such
  // check dies the same death: it keys off whether the string contains `.lp-`,
  // and `.lp-deck` inside a gate satisfies that no matter what the rule goes on
  // to select. Two selectors got past the text checks during this task alone —
  // `:where(html:has(.lp-deck, .lp-flow)) img`, and the ungated-`:where` form
  // `html:has(.lp-deck, .lp-flow) section` that base.css's own header comment
  // warns authors not to write. Both are properly gated, both name `.lp-`, and
  // both restyle host elements the package never rendered. Patching the parser
  // for each shape is a losing game; the shapes are unbounded.
  //
  // So this asks the real question directly: mount a layout root next to a tree
  // of foreign elements no package component renders, and require that no
  // selector matches anything in that tree. A rule that reaches into the host
  // fails here whatever its spelling, and the sanctioned document rules — the
  // only ones allowed to — are listed by exact text below.
  //
  // The list is the one deliberate allow-list in this file. Adding to it is how
  // a new document-level rule gets reviewed instead of merely noticed.
  const SANCTIONED = [
    'html:where(:has(.lp-deck, .lp-flow))',
    'html[data-snap]:where(:has(.lp-deck))',
    'html[data-smooth]:where(:has(.lp-deck, .lp-flow))',
    ':where(html:has(.lp-deck, .lp-flow)) body',
    ':where(html:has(.lp-deck, .lp-flow)) ::selection',
    ':where(html:has(.lp-deck, .lp-flow)) *',
    ':where(html:has(.lp-deck, .lp-flow)) *::before',
    ':where(html:has(.lp-deck, .lp-flow)) *::after',
  ]

  // Every element type a host might put on a page beside this package's own,
  // including the ones the package styles INSIDE its blocks (`p`, `li`, `dt`,
  // `summary`) — those are the ones a descendant selector is likeliest to
  // over-reach on.
  //
  // The honest limit of this approach: it catches a leak only if the leak
  // reaches a tag in THIS list, in one of the two positions the fixture builds.
  // The tags that matter most are the ones the package renders BARE, because a
  // document-gated rule aimed at the package's own code, emphasis or bold is the
  // likeliest leak an author actually writes — and one of those, `<b>`, got past
  // a hand-kept version of this list. So the list is no longer trusted to be
  // right by inspection: `the fixture covers every tag the package renders bare`
  // below reads them off the JSX and fails if one is missing.
  const FOREIGN =
    '<section><h1>t</h1><h2>t</h2><h3>t</h3><h4>t</h4><p>t</p><a href="#x">t</a>' +
    '<img alt="t" src="#"><ul><li>t</li></ul><ol><li>t</li></ol>' +
    '<dl><dt>t</dt><dd>t</dd></dl><button>t</button>' +
    '<details><summary>t</summary></details><small>t</small><span>t</span>' +
    '<code>t</code><pre>t</pre><em>t</em><b>t</b><strong>t</strong><blockquote>t</blockquote>' +
    '<figure><figcaption>t</figcaption></figure><video></video><hr>' +
    '<table><caption>t</caption><thead><tr><th>t</th></tr></thead>' +
    '<tbody><tr><td>t</td></tr></tbody></table>' +
    '<label>t<input></label><select><option>t</option></select><textarea></textarea>' +
    '<div><footer>t</footer><header>t</header><nav>t</nav><main>t</main></div></section>'

  it('the fixture covers every tag the package renders bare', () => {
    // DERIVED, never hand-kept. The fixture's tag list is the probe's only
    // bound, and a hand-kept one goes stale in the direction that passes: the
    // package grows a bare `<b>`, nobody widens the fixture, and a rule reaching
    // every `<b>` on the host site is invisible to the probe. That is not
    // hypothetical — it is exactly how `html:has(.lp-screen) b` survived.
    const files = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' }).filter(
      (f) => f.endsWith('.tsx') && !f.includes('__tests__'),
    )
    expect(files.length).toBeGreaterThan(10)
    const rendered = new Set(
      files.flatMap((f) => {
        const src = readFileSync(join(SRC_DIR, f), 'utf8')
        return [
          // A tag written literally in JSX.
          ...[...src.matchAll(/<([a-z][a-z0-9-]*)[\s>/]/g)].map((m) => m[1]),
          // And a tag chosen at RUNTIME. `Screen` takes `as?: 'section' | 'div'`
          // and renders `<Tag>`, which is capitalised because it is a JS
          // identifier — so the literal-JSX regex above cannot see it, and both
          // its values are covered here only because other files happen to
          // render them bare. Harvest the quoted names out of the `as`
          // annotation and its destructuring default, so a union that grows an
          // `'article'` is caught rather than silently uncovered. This is the
          // package's only dynamic-tag idiom; a second one needs a line here.
          ...[...src.matchAll(/\bas\??\s*[:=][^\n]*/g)].flatMap((m) =>
            [...m[0].matchAll(/'([a-z][a-z0-9-]*)'/g)].map((q) => q[1]),
          ),
        ]
      }),
    )
    // The document shell itself — `DeckScript` renders `<script>`, and `html` /
    // `head` / `body` appear in the inline script it emits. None can be nested
    // inside a host element, so none can be part of a fixture that models one.
    for (const tag of ['html', 'head', 'body', 'script']) rendered.delete(tag)
    expect(rendered.size).toBeGreaterThan(20)
    const missing = [...rendered].filter((t) => !new RegExp(`<${t}[\\s>/]`).test(FOREIGN))
    expect(missing).toEqual([])
  })

  // THE OTHER HALF, and the two are kept together because each is blind exactly
  // where the other sees.
  //
  // This one drops a document-root gate and checks what the rule then SELECTS,
  // so it is unbounded in TAG — `code`, `video`, `<b>`, a tag nobody has
  // invented yet. The probe below is its mirror: it asks a real selector engine,
  // so no spelling escapes it, but it only sees what its fixture builds.
  //
  // Deleting this one in favour of the probe was a mistake caught in review —
  // `:where(html:has(.lp-deck, .lp-flow)) code` then passed everything, and the
  // package renders bare `<code>`, so that is a rule an author would plausibly
  // write. Neither test is sufficient. Do not collapse them again.
  //
  // The gate is recognised STRUCTURALLY, and that is the whole lesson of this
  // file. Three earlier versions matched gate spellings with a regex — one
  // spelling, then two, then a parser that special-cased a wrapper enclosing
  // the whole compound — and each was beaten by the next spelling:
  //
  //   html:has(.lp-deck, .lp-flow) section   the ungated-`:where()` form
  //   html:has(.lp-screen) b                 a WORKING gate on a different class
  //   :where(html):has(.lp-screen) b         the wrapper around `html` alone
  //
  // The last two are the instructive ones. Both gates work — `.lp-screen` is an
  // always-present descendant of a deck — so the rule does what its author
  // meant and only the test is fooled, and `.lp-screen` is the class this
  // package names most often, so reaching for it is an unforced substitution
  // rather than a trick. Spellings are unbounded; "does this compound select
  // the document root" is not, and `subjectOf` answers it by resolving the
  // selector rather than by recognising it.
  const strip = (s: string) => {
    const parts = topLevelParts(s)
    if (!isDocumentRoot(parts[0])) return s
    const selected = parts.slice(1).join(' ')
    // Nothing after the gate means the rule paints the root itself. Report it
    // under its own name — `html`, `html[data-snap]` — by dropping the filtering
    // pseudo-classes now that their arguments are gone.
    return selected || subjectOf(parts[0]).replace(/(:[a-z-]+)+$/, '')
  }

  it('adds no document-level rule beyond the sanctioned subjects', () => {
    const documentRules = SHEETS.flatMap((sheet) =>
      selectors(sheet)
        .map((s) => ({ sheet, subject: strip(s) }))
        // A subject still naming `.lp-` reaches only what the package put on
        // the page — an ordinary rule, whatever gate precedes it.
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

  it('every sanctioned document rule is present, and none has been respelled', () => {
    // The allow-list is only meaningful if it describes the sheet. A rule
    // removed or respelled would otherwise sit here forever, permitting a
    // selector that no longer exists while the real one goes unchecked.
    for (const sel of SANCTIONED) expect(base, sel).toContain(sel)
  })

  it('no unsanctioned rule reaches an element the package did not render', () => {
    // The foreign tree sits in BOTH positions a leak can reach it from, because
    // one position alone leaves a combinator untested: `.lp-band ~ main p` is
    // invisible to a fixture whose host tree is not a sibling of a band, and
    // that mutation passed until this fixture grew its second host.
    //
    // Both hosts are OUTSIDE any package block, which is the line that matters.
    // A foreign element placed *inside* a `.lp-band` is deliberately not tested:
    // hosts put their own content in bands, and `.lp-faq details p` styling it
    // is the package working as intended, not reaching past itself.
    //
    // BOTH layout roots are mounted, and that is what makes this probe the
    // half of the pair that is unbounded in SPELLING. Every document-level rule
    // in `base.css` is gated on `:has(.lp-deck)` or `:has(.lp-deck, .lp-flow)`,
    // so a fixture carrying only a flow leaves every deck-gated rule unable to
    // match ANYTHING — and a rule that cannot match cannot be caught reaching a
    // host. The probe passed for that reason rather than for the intended one.
    //
    // With both mounted, the gate arms whatever its subject is *spelled* — it is
    // the browser resolving the selector, not this file recognising a keyword.
    // Verified in jsdom: `html`, `HTML`, `:root` and `:scope` all reach
    // `#outside-host` from here, and all four are caught. That is the division
    // of labour with `adds no document-level rule beyond the sanctioned
    // subjects` above, which strips a known set of root spellings and is
    // therefore unbounded in TAG but not in spelling. Do NOT answer a new root
    // spelling by teaching `isDocumentRoot` about it — that is the enumeration
    // this pairing exists to avoid. Answer it here, or it is already answered.
    document.body.innerHTML =
      '<div class="lp-flow">' +
      '<section class="lp-band"><p>own</p></section>' +
      `<aside id="sibling-host">${FOREIGN}</aside>` +
      '</div>' +
      '<div class="lp-deck"><section class="lp-screen"><p>own</p></section></div>' +
      `<main id="outside-host">${FOREIGN}</main>`
    arm()
    const hosts = ['sibling-host', 'outside-host'].map((id) => document.getElementById(id)!)

    for (const sheet of SHEETS) {
      for (const sel of selectors(sheet)) {
        if (SANCTIONED.includes(sel)) continue
        // `querySelectorAll` cannot match a pseudo-element; probe the element
        // the rule originates on, which is what a leak would reach anyway.
        const probe = sel.replace(/::[a-z-]+/g, '').trim()
        if (!probe) continue
        const reached = [...document.querySelectorAll(probe)].filter((el) =>
          hosts.some((h) => h.contains(el)),
        )
        expect(reached.map((el) => el.tagName), `${sheet}: ${sel}`).toEqual([])
      }
    }
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
