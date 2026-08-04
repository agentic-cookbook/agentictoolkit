import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import { HEADER_LINKS_COLLAPSE_QUERY } from '../useHeaderLinksCollapsed'

// The hook's breakpoint and the CSS rule it mirrors are two copies of one fact, in two
// languages, in two files. If they drift, a phone gets either NO primary nav (the bar
// hides the links, the menu doesn't pick them up) or TWO copies of it — and both
// failures are silent, because each half is individually correct.
//
// A source-text assertion rather than a rendered one on purpose: jsdom has no layout, so
// nothing in a unit test can observe `display: none` actually taking effect at 768px. The
// honest thing to check is that the two declarations still say the same number.
//
// Read off disk rather than imported: vitest returns an EMPTY string for a CSS import,
// `?raw` included, so an `import css from '…css?raw'` here would assert nothing and pass
// the moment the rule was deleted. `import.meta.dirname` rather than `process.cwd()`, so
// the path does not depend on which config started the run.
describe('the header-links collapse breakpoint', () => {
  const css = readFileSync(
    resolve(import.meta.dirname, '../../styles/adh-components.css'),
    'utf8',
  )

  it('is the same width in the hook as in the rule that hides .adh-header__links', () => {
    const rule = css.match(
      /@media\s*\(([^)]+)\)\s*\{\s*\.adh-header__links\s*\{\s*display:\s*none;?\s*\}\s*\}/,
    )
    expect(rule, 'no @media rule hiding .adh-header__links — did it move?').not.toBeNull()

    const cssQuery = rule![1]!.replace(/\s+/g, ' ').trim()
    const hookQuery = HEADER_LINKS_COLLAPSE_QUERY.replace(/^\(|\)$/g, '').replace(/\s+/g, ' ').trim()
    expect(cssQuery).toBe(hookQuery)
  })

  it('is exactly one rule — a second one would collapse the links at a width the hook never sees', () => {
    const hides = css.match(/\.adh-header__links\s*\{\s*display:\s*none/g) ?? []
    expect(hides).toHaveLength(1)
  })
})
