import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }

describe('@agentic-toolkit/adh export contract', () => {
  const subpathEntries = Object.entries(pkg.exports).filter(
    ([, value]) => typeof value === 'object' && value !== null,
  ) as [string, Record<string, string>][]

  it('has at least one JS subpath', () => {
    expect(subpathEntries.length).toBeGreaterThan(0)
  })

  it.each(subpathEntries)('%s declares types, development and import', (_subpath, conditions) => {
    expect(Object.keys(conditions)).toEqual(['types', 'development', 'import'])
    expect(conditions.development).toMatch(/^\.\/src\//)
    expect(conditions.types).toMatch(/^\.\/dist\/.*\.d\.ts$/)
    expect(conditions.import).toMatch(/^\.\/dist\/.*\.js$/)
  })

  it('ships src/styles so Tailwind can scan it and Vercel can bundle the CSS', () => {
    expect(pkg.files).toContain('dist')
    expect(pkg.files).toContain('src/styles')
  })

  it('builds CSS from two levels up, matching its depth in packages/web/packages/', () => {
    expect(pkg.scripts['build:css']).toBe('node ../../copy-css.mjs')
  })
})
