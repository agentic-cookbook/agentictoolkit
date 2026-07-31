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
 */
import { describe, it, expect } from 'vitest'
import { themes } from '@agentic-toolkit/themes/manifest'
import { FULL_PALETTE_THEMES } from '../themes/adh-themes'

const DARK = 'html:root'
const LIGHT = 'html:root[data-color-mode]:not(.dark)'

/** A theme in the correct shape, and the three ways of breaking it these tests must catch.
 *  Without these the suite could pass while detecting nothing — every real theme is already
 *  correct, so the assertions below never exercise their own failure path. */
const FIXTURES = {
  good: `html:root {\n  --color-primary: #fff;\n}\n\nhtml:root[data-color-mode]:not(.dark) {\n  --color-primary: #000;\n}\n`,
  darkOnly: `html:root {\n  --color-primary: #fff;\n}\n`,
  legacy: `:root {\n  --color-primary: #000;\n}\n\n:root.dark {\n  --color-primary: #fff;\n}\n`,
  missingRole: `html:root {\n  --color-text-primary: #fff;\n}\n\nhtml:root[data-color-mode]:not(.dark) {\n  --color-text-primary: #000;\n}\n`,
}

/** The declarations inside a top-level `<selector> { … }` block, or null if there is none. */
function block(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(css)
  return m?.[1] ?? null
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

    it('catches a theme that ships only the dark block', () => {
      expect(block(FIXTURES.darkOnly, LIGHT)).toBeNull()
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
