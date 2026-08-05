import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(__dirname, '../styles/adh-landing-bridge.css'), 'utf8')

/**
 * Every `--lp-*` token `@agentic-toolkit/landing`'s stylesheets READ, derived
 * from those stylesheets on every run.
 *
 * This list used to be kept by hand here, "measured from those files", and it
 * drifted the moment the package grew a token: `--lp-font-serif` — the tour's
 * closing promise, the one non-mono line in the deck — was read by
 * `blocks.css` and missing from the list, so the bridge never assigned it and
 * three tour pages shipped in the package's `Georgia, serif` fallback while
 * every assertion here passed. A hand-kept vocabulary drifts silently by
 * construction; the only fix is not to keep one.
 *
 * Read from the sibling package's `src/` rather than through `require.resolve`
 * because `src/` is what a person edits — `dist/css` is a verbatim copy made
 * by `build:css`, so resolving the dependency would only add a build step
 * between the edit and the failing test.
 */
const LANDING_CSS = join(__dirname, '../../../landing/src/css')

function landingTokens(): { read: string[]; assigned: string[] } {
  const read = new Set<string>()
  const assigned = new Set<string>()
  for (const name of readdirSync(LANDING_CSS).filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(join(LANDING_CSS, name), 'utf8')
    for (const [, t] of css.matchAll(/var\(\s*(--lp-[\w-]+)/g)) read.add(t)
    for (const [, t] of css.matchAll(/^\s*(--lp-[\w-]+)\s*:/gm)) assigned.add(t)
  }
  return { read: [...read].sort(), assigned: [...assigned].sort() }
}

const { read: TOKENS, assigned: SELF_ASSIGNED } = landingTokens()

describe('landing bridge', () => {
  it('reads a token contract that is neither empty nor a stub', () => {
    // Guard the derivation: a glob that found no files, or a regex that
    // matched nothing, would make every assertion below pass vacuously.
    expect(TOKENS.length).toBeGreaterThan(40)
  })

  it('is the only place the contract is assigned', () => {
    // The package's half of the deal: it never assigns `:root`, so every token
    // is read as `var(--lp-x, <neutral fallback>)` and a host override always
    // wins. A token the package assigned itself would be one this bridge could
    // not reach, and it would not belong in the list above either.
    expect(SELF_ASSIGNED).toEqual([])
  })

  it.each(TOKENS)('assigns %s', (token) => {
    expect(CSS).toMatch(new RegExp(`^\\s*${token}\\s*:`, 'm'))
  })

  it('assigns nothing the package does not read', () => {
    // The other direction, and not symmetric with it: a token assigned here
    // and read nowhere is dead weight that reads as coverage.
    const names = [...CSS.matchAll(/^\s*(--lp-[\w-]+)\s*:/gm)].map((m) => m[1])
    expect(names.filter((n) => !TOKENS.includes(n))).toEqual([])
  })

  it('sources colour from role vars, never raw hex', () => {
    const decls = CSS.split('\n').filter((l) => l.trim().startsWith('--lp-'))
    const hex = decls.filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l))
    expect(hex, `raw hex in: ${hex.join(' | ')}`).toEqual([])
  })

  it('assigns each token exactly once', () => {
    const names = [...CSS.matchAll(/^\s*(--lp-[\w-]+)\s*:/gm)].map((m) => m[1])
    expect(new Set(names).size).toBe(names.length)
  })
})
