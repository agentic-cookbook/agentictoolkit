import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import * as exposureSubpath from '../exposure'

// The RSC door. `@agentic-toolkit/crud/exposure` exists so a server component can call the exposure
// predicates: everything on the package's `'use client'` barrel arrives in an RSC as an
// un-dereferenceable client reference, which fails only in a production build (dev's inlined
// client boundary hides it). These gates fail in CI instead.

const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { exports: Record<string, unknown> }

describe('@agentic-toolkit/crud/exposure', () => {
  it('is declared as its own subpath export', () => {
    expect(pkg.exports['./exposure'], 'package.json exports is missing "./exposure"').toEqual({
      types: './dist/exposure.d.ts',
      development: './src/exposure.ts',
      import: './dist/exposure.js',
    })
  })

  it('carries no client directive — that is the whole point of the subpath', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/exposure.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*['"]use client['"]/m)
  })

  it('re-exports every exposure predicate the barrel offers', () => {
    // A predicate added to the client barrel but forgotten here would send an RSC caller back to
    // the barrel — the exact failure this module exists to prevent.
    expect(Object.keys(exposureSubpath).sort()).toEqual([
      'canReadTable',
      'canWriteTable',
      'readableTables',
    ])
  })

  it('forwards the real toolkit predicates (fail-closed on an unknown tier)', () => {
    const meta = (exposure: string) => ({ exposure }) as never
    expect(exposureSubpath.canReadTable(meta('owner'), false)).toBe(true)
    expect(exposureSubpath.canReadTable(meta('admin'), false)).toBe(false)
    expect(exposureSubpath.canWriteTable(meta('catalog'), false)).toBe(false)
    expect(exposureSubpath.canReadTable(meta('some-future-tier'), false)).toBe(false)
  })
})
