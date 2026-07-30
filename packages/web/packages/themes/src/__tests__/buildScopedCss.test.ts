import { describe, expect, it } from 'vitest'
import { buildScopedCss } from '../ThemeStyle'
import { themes, themeIds } from '../manifest'

describe('buildScopedCss', () => {
  it('rewrites a full-palette theme’s dark anchor to :scope', () => {
    const out = buildScopedCss('html:root {\n  --color-surface: #000;\n}\n', '.host')
    expect(out).toContain(':scope {')
    expect(out).toContain('@scope (.host)')
  })

  it('keeps the light block conditional on data-color-mode', () => {
    const out = buildScopedCss(
      'html:root[data-color-mode]:not(.dark) {\n  --color-surface: #fff;\n}\n',
      '.host',
    )
    expect(out).toContain('html[data-color-mode]:not(.dark) :scope {')
    // The light block must NOT collapse to an unconditional `:scope`, which would make it
    // win in dark mode too (it is the later rule).
    expect(out).not.toMatch(/^:scope \{/m)
  })

  it('still handles the legacy :root / :root.dark anchors', () => {
    const out = buildScopedCss(':root {\n  --a: 1;\n}\n:root.dark {\n  --a: 2;\n}\n', '.host')
    expect(out).toContain(':scope {')
    expect(out).toContain('html.dark :scope {')
  })

  it('hoists @import above the @scope block', () => {
    const css = "@import url('https://fonts.example/x.css');\nhtml:root {\n  --a: 1;\n}\n"
    const out = buildScopedCss(css, '.host')
    expect(out.indexOf('@import')).toBeLessThan(out.indexOf('@scope'))
  })

  // The guard that matters: a root anchor this function does not know about survives into
  // the output, matches nothing inside the scope, and drops that theme's entire palette
  // with no error. Assert on the REAL stylesheets so a newly-authored anchor form fails
  // here instead of silently un-theming a scoped surface.
  it('leaves no unrewritten root anchor in any shipped theme', () => {
    for (const key of themeIds) {
      const scoped = buildScopedCss(themes[key].css, '.host')
      expect(scoped, key).not.toMatch(/(^|,\s*)(html)?:root\b/m)
    }
  })
})
