/**
 * Structural contract for FULL_PALETTE_THEMES.
 *
 * Every failure this file pins is SILENT at runtime — a theme that breaks any of these rules
 * still loads, still appears in the switcher, and still applies *some* of its colours. There
 * is no console error, no thrown exception, and in dark mode it may look completely fine.
 * That is what makes the list worth testing rather than trusting:
 *
 *  1. A key in FULL_PALETTE_THEMES must exist in the manifest. AdhThemeStyle emits a
 *     full-palette theme's CSS *whole* (not as a `:root` delta), so an unregistered key
 *     emits an empty block and the menu entry does nothing.
 *
 *  2. It must self-scope at `html:root` AND at `html:root[data-color-mode]:not(.dark)`.
 *     The per-mode specificity is the whole trick, and it is asymmetric: the dark block's
 *     `html:root` (0-1-1) beats the always-on base (`:root`, 0-1-0), but it does NOT beat
 *     color-mode-light (`:root[data-color-mode]:not(.dark)`, 0-3-0). So a theme shipping only
 *     the dark block looks perfect in dark mode and silently reverts to the base palette in
 *     light mode — the exact failure adh-themes.ts warns about in prose.
 *
 *     A theme may satisfy this two ways, and both are tested here rather than one being
 *     privileged: MODE-SPLIT (two blocks, light values in the light one) or DARK-ALWAYS
 *     (one block whose selector LIST carries both anchors, so light mode gets the dark
 *     palette on purpose). A dark-always theme owes three more selectors — see rule 5.
 *
 *  3. It must declare all 49 literal M3 colour roles, in both blocks. This is the trap the
 *     legacy site themes fell into for a year: the base defines the legacy token names as
 *     `var()` aliases OF the roles (`--color-text-primary: var(--color-on-surface)`), so a
 *     theme that overrides only the aliases leaves every role-reading component
 *     base-coloured. The result is a half-reskin that looks like a styling bug somewhere
 *     else. adh.css's own `:root` is the source of truth for which roles exist, so this
 *     stays correct as roles are added.
 *
 *  4. No leftover bare `:root` token block. That is the legacy shape, and it loses the
 *     cascade to the base in both modes.
 *
 *  5. A DARK-ALWAYS theme must also out-specify color-mode-light's CONTRAST rules, not
 *     just its base block. Those set light-mode text to near-black on an explicit
 *     high/extra-high choice and on the OS "increase contrast" setting; a dark-always
 *     theme that beats only the base block hands a user on Light + High contrast
 *     near-black text on a near-black ground. That reader sees an unreadable page, and
 *     nobody testing the default configuration ever sees it at all.
 *
 *  6. Whichever theme DEFAULT_SITE_THEME names must be dark-always. "The site is always
 *     dark" is a property of the FAMILY, not of whatever theme happens to hold the
 *     default — and the two came apart silently once already: the default moved from a
 *     dark-always theme to a mode-split one, and from that commit every visitor whose OS
 *     was in light mode got the light colourway, with no control left in Appearance to
 *     override it. Nothing went red, because rules 2 and 5 are both satisfied by a
 *     mode-split theme; being mode-split is legitimate, it just disqualifies a theme
 *     from being the DEFAULT one. Asserting the property off DEFAULT_SITE_THEME rather
 *     than naming the theme is what makes the next swap of that constant fail loudly.
 */
import { describe, it, expect } from 'vitest'
import { themes } from '@agentic-toolkit/themes/manifest'
import { DEFAULT_SITE_THEME, FULL_PALETTE_THEMES } from '../themes/adh-themes'

const DARK = 'html:root'
const LIGHT = 'html:root[data-color-mode]:not(.dark)'
/** The other three states color-mode-light.css can put a LIGHT document in: an explicit
 *  contrast choice (its :105 / :113 rules) and the OS-level one (:123, inside
 *  `@media (prefers-contrast: more)`). Only a dark-always theme has to name them. */
const LIGHT_CONTRAST = [
  `${LIGHT}[data-contrast='high']`,
  `${LIGHT}[data-contrast='extra-high']`,
  `${LIGHT}:not([data-contrast='high']):not([data-contrast='extra-high'])`,
]

/** A theme in each correct shape, and the four ways of breaking them these tests must catch.
 *  Without these the suite could pass while detecting nothing — every real theme is already
 *  correct, so the assertions below never exercise their own failure path. */
const FIXTURES = {
  good: `html:root {\n  --color-primary: #fff;\n}\n\nhtml:root[data-color-mode]:not(.dark) {\n  --color-primary: #000;\n}\n`,
  darkOnly: `html:root {\n  --color-primary: #fff;\n}\n`,
  legacy: `:root {\n  --color-primary: #000;\n}\n\n:root.dark {\n  --color-primary: #fff;\n}\n`,
  missingRole: `html:root {\n  --color-text-primary: #fff;\n}\n\nhtml:root[data-color-mode]:not(.dark) {\n  --color-text-primary: #000;\n}\n`,
  darkAlways: `html:root,\nhtml:root[data-color-mode]:not(.dark),\n${LIGHT_CONTRAST.join(',\n')} {\n  --color-primary: #fff;\n}\n`,
  // Dark-always, but only out-specifying color-mode-light's BASE block: the near-black-on-
  // near-black failure rule 5 describes, which the two-selector check above cannot see.
  darkAlwaysNoContrast: `html:root,\nhtml:root[data-color-mode]:not(.dark) {\n  --color-primary: #fff;\n}\n`,
}

type Rule = { selectors: string[]; body: string }

/** The theme's top-level rules: a selector list starting at column 0, closed by a `}` at
 *  column 0. That anchoring is the same one ThemeStyle's buildScopedCss rewriter relies on
 *  (it rewrites a root anchor only at a line start or after a comma), so a rule this parser
 *  can't see is one the rewriter can't see either — nested `@media` bodies included. */
function rules(css: string): Rule[] {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return Array.from(flat.matchAll(/^([^\s@{}][^{}]*?)\s*\{([\s\S]*?)^\}/gm), (m) => ({
    selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    body: m[2]!,
  }))
}

/** The rule whose selector LIST names `selector`, or null. A list, not an exact selector
 *  match: a dark-always theme reaches light mode by adding anchors to the dark block's
 *  list rather than by shipping a second block, and a test that only recognised
 *  `html:root {` would read that as "no dark block" — and, worse, would then skip the
 *  role check for it and pass. */
function rule(css: string, selector: string): Rule | null {
  return rules(css).find((r) => r.selectors.includes(selector)) ?? null
}

/** The declarations inside the block that `selector` anchors, or null if there is none. */
function block(css: string, selector: string): string | null {
  return rule(css, selector)?.body ?? null
}

/** Whether the theme reaches light mode by giving it the DARK palette — one rule carrying
 *  both anchors — rather than by shipping a second block with light values. */
function isDarkAlways(css: string): boolean {
  return rule(css, DARK)?.selectors.includes(LIGHT) ?? false
}

function declaredProps(body: string): Set<string> {
  // `!` throughout this file: these capture groups are not optional in their patterns, so a
  // match implies the group. Under noUncheckedIndexedAccess that still needs saying.
  return new Set(Array.from(body.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]!))
}

/** The literal colour roles adh.css defines — the ones a theme has to override to reskin the
 *  chrome. `var()` values are excluded: those are the compat aliases, which follow for free. */
const REQUIRED_ROLES: string[] = (() => {
  const base = block(themes.adh.css, ':root')
  if (!base) throw new Error('adh.css has no `:root` block — the base theme shape changed')
  return Array.from(base.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g))
    .filter(([, , value]) => !value!.includes('var('))
    .map(([, prop]) => prop!)
})()

describe('FULL_PALETTE_THEMES', () => {
  describe('the checks below can actually fail', () => {
    it('names the roles a theme must override', () => {
      // If this drops toward zero the role assertion goes vacuous while still passing.
      expect(REQUIRED_ROLES.length).toBeGreaterThan(40)
      expect(REQUIRED_ROLES).toContain('--color-primary')
      expect(REQUIRED_ROLES).toContain('--color-on-surface')
      expect(REQUIRED_ROLES).toContain('--color-surface-container-high')
    })

    it('finds both blocks in a correctly shaped theme', () => {
      expect(block(FIXTURES.good, DARK)).not.toBeNull()
      expect(block(FIXTURES.good, LIGHT)).not.toBeNull()
      expect(/^:root[\s{.]/m.test(FIXTURES.good)).toBe(false)
    })

    it('finds both anchors in a DARK-ALWAYS theme, in the one block', () => {
      // The shape the parser exists for: one rule, five selectors. One rule carrying both
      // anchors is what marks a theme dark-always below.
      expect(isDarkAlways(FIXTURES.darkAlways)).toBe(true)
      expect(isDarkAlways(FIXTURES.good)).toBe(false)
      expect(block(FIXTURES.darkAlways, LIGHT)).toContain('--color-primary: #fff')
    })

    it('catches a theme that ships only the dark block', () => {
      expect(block(FIXTURES.darkOnly, LIGHT)).toBeNull()
    })

    it('catches a DARK-ALWAYS theme that skips the light CONTRAST selectors', () => {
      const r = rule(FIXTURES.darkAlwaysNoContrast, DARK)!
      expect(r.selectors).toContain(LIGHT) // passes the both-modes check above…
      for (const sel of LIGHT_CONTRAST) expect(r.selectors).not.toContain(sel) // …and still breaks
    })

    it('catches a legacy bare-`:root` theme', () => {
      expect(block(FIXTURES.legacy, DARK)).toBeNull()
      expect(/^:root[\s{.]/m.test(FIXTURES.legacy)).toBe(true)
    })

    it('catches a theme that overrides the compat aliases instead of the roles', () => {
      // The exact legacy failure: `--color-text-primary` is an ALIAS of `--color-on-surface`,
      // so setting it leaves the role — and every component reading the role — untouched.
      const declared = declaredProps(block(FIXTURES.missingRole, DARK)!)
      expect(declared.has('--color-text-primary')).toBe(true)
      expect(REQUIRED_ROLES.filter((r) => !declared.has(r))).toContain('--color-on-surface')
    })
  })

  it.each(FULL_PALETTE_THEMES)('%s is registered in the theme manifest', (key) => {
    expect(Object.keys(themes)).toContain(key)
    expect(themes[key].css.length).toBeGreaterThan(0)
  })

  it.each(FULL_PALETTE_THEMES)('%s self-scopes for BOTH colour modes', (key) => {
    const css = themes[key].css
    expect(block(css, DARK), `${key} has no \`${DARK}\` block`).not.toBeNull()
    expect(
      block(css, LIGHT),
      `${key} has no \`${LIGHT}\` block — it would revert to the base palette in light mode`,
    ).not.toBeNull()
  })

  it.each(FULL_PALETTE_THEMES)('%s out-specifies light CONTRAST if it is DARK-ALWAYS', (key) => {
    const css = themes[key].css
    if (!isDarkAlways(css)) return // mode-split: its light block carries light values
    const { selectors } = rule(css, DARK)!
    for (const sel of LIGHT_CONTRAST)
      expect(
        selectors,
        `${key} is dark-always but does not name \`${sel}\` — color-mode-light's contrast ` +
          `rules would paint near-black text on its dark ground`,
      ).toContain(sel)
  })

  it('DEFAULT_SITE_THEME is DARK-ALWAYS — the site is dark whatever the device says', () => {
    expect(Object.keys(themes)).toContain(DEFAULT_SITE_THEME)
    expect(
      isDarkAlways(themes[DEFAULT_SITE_THEME].css),
      `DEFAULT_SITE_THEME is \`${DEFAULT_SITE_THEME}\`, which varies by colour mode. The family ` +
        `ships ONE presentation and it is dark, so the default theme has to give its light-mode ` +
        `selectors the dark palette (see rule 6 above). As it stands, a visitor whose OS is in ` +
        `light mode gets a light site and Appearance offers no control to override it. Either ` +
        `point DEFAULT_SITE_THEME at a dark-always theme, or make this one dark-always.`,
    ).toBe(true)
  })

  it.each(FULL_PALETTE_THEMES)('%s declares every M3 role in both modes', (key) => {
    const css = themes[key].css
    for (const [mode, selector] of [
      ['dark', DARK],
      ['light', LIGHT],
    ] as const) {
      const body = block(css, selector)
      if (body === null) continue // reported by the block test above
      const declared = declaredProps(body)
      const missing = REQUIRED_ROLES.filter((r) => !declared.has(r))
      expect(missing, `${key} (${mode}) leaves these roles to the base theme`).toEqual([])
    }
  })

  it.each(FULL_PALETTE_THEMES)('%s keeps no legacy bare-`:root` token block', (key) => {
    // `^:root` at column 0 — `html:root` and `.foo :root` don't match, nor does a nested rule.
    expect(/^:root[\s{.]/m.test(themes[key].css), `${key} still has a legacy \`:root\` block`).toBe(
      false,
    )
  })
})
