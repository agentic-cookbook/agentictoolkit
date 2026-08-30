import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('@agentic-toolkit/adh export contract', () => {
  const subpathEntries = Object.entries(pkg.exports).filter(
    ([, value]) => typeof value === 'object' && value !== null,
  ) as [string, Record<string, string>][]

  it('has at least one JS subpath', () => {
    expect(subpathEntries.length).toBeGreaterThan(0)
  })

  // The one subpath that also declares `browser`, asserted on its own below rather than
  // loosening the rule for all of them: a stray `browser` condition anywhere else would
  // silently hand a client graph a different module than the server one, which is the
  // failure this subpath exists to fix and the last thing to let spread by accident.
  const BROWSER_SUBPATH = './live-build-identity'

  it.each(subpathEntries.filter(([subpath]) => subpath !== BROWSER_SUBPATH))(
    '%s declares types, development and import',
    (_subpath, conditions) => {
      expect(Object.keys(conditions)).toEqual(['types', 'development', 'import'])
      expect(conditions.development).toMatch(/^\.\/src\//)
      expect(conditions.types).toMatch(/^\.\/dist\/.*\.d\.ts$/)
      expect(conditions.import).toMatch(/^\.\/dist\/.*\.js$/)
    },
  )

  describe(`${BROWSER_SUBPATH} — the server/client resolution split`, () => {
    const conditions = (pkg.exports as Record<string, unknown>)[BROWSER_SUBPATH] as Record<
      string,
      string | Record<string, string>
    >

    it('is declared at all', () => {
      expect(conditions).toBeTypeOf('object')
    })

    // ORDER IS THE WHOLE MECHANISM. Conditions resolve first-match-wins, and Next applies
    // BOTH `development` and `browser` to a dev client bundle. With `development` first, a
    // client graph in dev resolves ./src/layout/live-build-identity.ts — the real module,
    // node:fs and node:child_process included — and `next dev` breaks exactly the way
    // `next build` used to. `browser` must come first for the split to mean anything.
    it('puts browser before development, so a dev client bundle takes the stub', () => {
      const keys = Object.keys(conditions)
      expect(keys).toEqual(['types', 'browser', 'development', 'import'])
      expect(keys.indexOf('browser')).toBeLessThan(keys.indexOf('development'))
    })

    it('sends a server graph to the real module, in both modes', () => {
      expect(conditions.development).toBe('./src/layout/live-build-identity.ts')
      expect(conditions.import).toBe('./dist/layout/live-build-identity.js')
    })

    it('sends a client graph to the browser twin, in both modes', () => {
      const browser = conditions.browser as Record<string, string>
      expect(Object.keys(browser)).toEqual(['development', 'import'])
      expect(browser.development).toBe('./src/layout/live-build-identity-browser.ts')
      expect(browser.import).toBe('./dist/layout/live-build-identity-browser.js')
    })

    it('types off the real module, whose type is the one both halves publish', () => {
      expect(conditions.types).toBe('./dist/layout/live-build-identity.d.ts')
    })
  })

  // ── The invariant that broke every site's build, stated where a test can hold it ──────
  //
  // `./server` is the entry that carries `node:fs` / `node:child_process`, by way of
  // live-build-identity. `./layout` is a barrel that `'use client'` code imports — every
  // site's app/global-error.tsx pulls `GlobalError` from it — and with tsup's
  // `bundle: true, splitting: false` that barrel is ONE file containing AppShell. So any
  // src/layout/ module that names `@agentic-toolkit/adh/server` puts an edge from the client
  // barrel to the builtins, and the consuming site's bundler follows it:
  //
  //     Module not found: Can't resolve 'child_process'   dist/server.js:226
  //     Module not found: Can't resolve 'fs'              dist/server.js:227
  //
  // That the specifier survives as EXTERNAL is not a defence — external means "the consumer
  // resolves it", not "the consumer ignores it". This is the assumption the original
  // AppShell comment made, and it is why the break shipped.
  //
  // The rule is deliberately about the SPECIFIER rather than about node builtins: builtins
  // are what `./server` happens to hold today, and a test that grepped for `node:` would go
  // quiet the moment the same edge dragged in something else client-hostile.
  describe('the layout barrel is a client-reachable entry', () => {
    const layoutFiles = readdirSync(path.join(SRC, 'layout'), { withFileTypes: true })
      .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
      .map((e) => e.name)

    it('has files to check (a rename must not silently empty this)', () => {
      expect(layoutFiles.length).toBeGreaterThan(5)
    })

    it.each(layoutFiles)('layout/%s does not import @agentic-toolkit/adh/server', (name) => {
      const source = readFileSync(path.join(SRC, 'layout', name), 'utf-8')
      const importing = source
        .split('\n')
        .filter((line) => /^\s*import\b/.test(line) && line.includes("'@agentic-toolkit/adh/server'"))
      expect(importing).toEqual([])
    })

    it('AppShell reaches the build identity through the browser-split subpath', () => {
      const source = readFileSync(path.join(SRC, 'layout', 'AppShell.tsx'), 'utf-8')
      expect(source).toContain("from '@agentic-toolkit/adh/live-build-identity'")
    })
  })

  it('ships src/styles so Tailwind can scan it and Vercel can bundle the CSS', () => {
    expect(pkg.files).toContain('dist')
    expect(pkg.files).toContain('src/styles')
  })

  it('builds CSS from two levels up, matching its depth in packages/web/packages/', () => {
    expect(pkg.scripts['build:css']).toBe('node ../../copy-css.mjs')
  })
})
