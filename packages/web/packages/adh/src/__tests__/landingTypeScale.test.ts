/**
 * The shared LANDING type scale, and the first-load font contract it rides on.
 *
 * Both halves of this file pin failures that are SILENT — the page renders, the build is
 * green, and the only symptom is type that is the wrong size or arrives late:
 *
 *  1. THE SCALE EXISTS IN EVERY THEME. Landing pages consume the scale two ways: a
 *     `.text-landing-<role>` class (files that already use classes) or
 *     `var(--type-landing-<role>-<prop>, <literal>)` (files that use inline styles or plain
 *     CSS). The var form carries a fallback — which is the point of the fallback and also the
 *     trap: if a theme stops emitting the scale, every one of those consumers silently
 *     reverts to its own literal, i.e. back to the per-site drift this scale replaced, with
 *     nothing failing anywhere. `.text-landing-*` classes fail the other way (they'd size
 *     nothing at all), which is just as invisible in a build.
 *
 *  2. THE CLASSES MUST READ THE VARS. `buildTypeClasses` emits `.text-landing-title { font-size:
 *     var(--type-landing-title-size) }`. If a regenerated theme ever baked the literal into the
 *     class instead, the class and the var form would drift apart the moment a theme retuned
 *     the scale — two consumers of "the same" role rendering at two sizes.
 *
 *  3. NO CONSUMER MAY LAYER A TAILWIND SIZE UTILITY ON A LANDING CLASS. `.text-landing-title`
 *     and `text-3xl` are both (0,1,0), so the winner is decided by which stylesheet the
 *     browser parsed last — the theme <style> today, but that is an ordering accident, not a
 *     contract. The rule for consumers is REPLACE, never layer.
 *
 *  4. THE FONT MUST BE PRELOADABLE AND SAME-ORIGIN. This is the "font changes size after the
 *     initial load" bug: with the faces behind a third-party stylesheet, the browser can't
 *     discover them until that stylesheet is fetched AND parsed, so the page paints in the
 *     fallback and reflows into Iosevka afterwards. The fix is structural — same-origin
 *     faces, `@font-face` in the theme css we inline, and a `preload` in the first pass over
 *     `<head>` — and each of those three is a thing a future change can quietly undo.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, relative, resolve } from 'node:path'
import { themes } from '@agentic-toolkit/themes/manifest'
import { THEME_FONT_PRELOADS } from '@agentic-toolkit/themes/fonts'
import { DEFAULT_ADH_THEME } from '../themes/adh-themes'

/** The six tiers a landing page distinguishes. Adding a seventh means adding it here. */
const ROLES = ['title', 'subtitle', 'heading', 'lede', 'body', 'eyebrow'] as const

/** Emitted for every role by scripts/build-tokens.mjs; `transform` only where declared. */
const PROPS = ['font', 'size', 'line-height', 'weight', 'tracking'] as const

/**
 * The themes that carry TYPE, as opposed to only colour. Only the DTCG-generated `adh*`
 * family emits `--type-*` (scripts/build-tokens.mjs); the other ~27 entries in the manifest
 * are palettes — they override colour roles on `html:root` and inherit every type var from
 * the always-on base block `AdhThemeStyle` emits. Deriving the set rather than listing it
 * keeps a newly generated theme in scope automatically, and keeps a palette out of it
 * without an exemption anyone has to remember to add.
 */
const typographicThemes = Object.entries(themes).filter(([, e]) =>
  e.css.includes('--type-landing-'),
)

describe('the landing scale is in every theme that carries type', () => {
  it('covers the whole generated family, including the base', () => {
    expect(typographicThemes.length).toBeGreaterThan(0)
    expect(typographicThemes.map(([k]) => k)).toContain(DEFAULT_ADH_THEME)
  })

  for (const [key, entry] of typographicThemes) {
    it(`${key} declares all six roles as --type-landing-* vars`, () => {
      const missing = ROLES.flatMap((role) =>
        PROPS.filter((prop) => !entry.css.includes(`--type-landing-${role}-${prop}:`)).map(
          (prop) => `--type-landing-${role}-${prop}`,
        ),
      )
      expect(missing).toEqual([])
    })

    it(`${key} emits all six .text-landing-* classes`, () => {
      const missing = ROLES.filter((role) => !entry.css.includes(`.text-landing-${role} {`))
      expect(missing).toEqual([])
    })

    it(`${key}'s .text-landing-* classes read the vars, never a baked literal`, () => {
      for (const role of ROLES) {
        const block = entry.css.match(
          new RegExp(`\\.text-landing-${role}\\s*\\{([^}]*)\\}`),
        )?.[1]
        expect(block, `.text-landing-${role} missing from ${key}`).toBeTruthy()
        for (const decl of (block ?? '').split(';')) {
          const [prop, value] = decl.split(':').map((s) => s.trim())
          if (!prop || !value) continue
          // text-transform is a keyword the token carries verbatim (`uppercase`), so it is
          // the one declaration that legitimately has no var().
          if (prop === 'text-transform') continue
          expect(value, `${key} .text-landing-${role} { ${prop} }`).toContain(
            `var(--type-landing-${role}-`,
          )
        }
      }
    })
  }

  it('is a self-consistent pair of routes: every var a class reads is declared', () => {
    const css = themes[DEFAULT_ADH_THEME].css
    for (const role of ROLES) {
      const block = css.match(new RegExp(`\\.text-landing-${role}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
      for (const name of block.match(/--type-landing-[a-z-]+/g) ?? []) {
        expect(css, `${name} read by .text-landing-${role} but never declared`).toContain(
          `${name}:`,
        )
      }
    }
  })
})

/** Every .tsx under frontend/src that isn't build output or a dependency. */
function* sourceFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue
    const p = resolve(dir, e.name)
    if (e.isDirectory()) yield* sourceFiles(p)
    else if (e.name.endsWith('.tsx')) yield p
  }
}

describe('consumers replace their size utility, never layer over it', () => {
  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  // Tailwind's font-size utilities. Deliberately NOT `text-[...]`: an arbitrary value is
  // almost always a colour (`text-[var(--color-text-dim)]`), which never conflicts.
  const SIZE_UTILITY = /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/

  it('no element carries both a .text-landing-* class and a Tailwind size utility', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(srcDir)) {
      const text = readFileSync(file, 'utf8')
      if (!text.includes('text-landing-')) continue
      for (const m of text.matchAll(/class(?:Name)?="([^"]*)"/g)) {
        const cls = m[1]
        if (cls.includes('text-landing-') && SIZE_UTILITY.test(cls)) {
          offenders.push(`${relative(srcDir, file)}: ${cls}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the first-load font contract', () => {
  const css = themes[DEFAULT_ADH_THEME].css

  it('preloads at least the faces that carry a page layout', () => {
    expect(THEME_FONT_PRELOADS.length).toBeGreaterThan(0)
  })

  it('preloads only same-origin woff2 paths', () => {
    for (const href of THEME_FONT_PRELOADS) {
      expect(href, 'a preload must be a root-relative path, not a third-party URL').toMatch(
        /^\/[^/]/,
      )
      expect(href).toMatch(/\.woff2$/)
    }
  })

  it('declares an @font-face for every preloaded face, in the css we inline', () => {
    for (const href of THEME_FONT_PRELOADS) {
      expect(css, `${href} is preloaded but no @font-face uses it`).toContain(`url('${href}')`)
    }
  })

  it('fetches no font from a third-party stylesheet', () => {
    // An @import is the shape of the original bug: the faces stay undiscoverable until the
    // imported sheet has been fetched and parsed, which is after first paint.
    const imports = css.match(/@import[^;]+;/g) ?? []
    expect(imports).toEqual([])
  })

  it('ships the preloaded bytes at the path it preloads', () => {
    // materializeThemeFonts (frontend/src/next-config-base.mjs) copies these into each
    // site's public/ at build time; the source of truth is the themes package.
    const fontsDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../external/agentictoolkit/packages/web/packages/themes/src/fonts',
    )
    for (const href of THEME_FONT_PRELOADS) {
      const file = resolve(fontsDir, href.split('/').pop() as string)
      expect(() => statSync(file), `${href} has no bytes at ${file}`).not.toThrow()
    }
  })
})
