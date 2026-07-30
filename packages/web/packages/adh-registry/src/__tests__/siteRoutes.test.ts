import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SITE_ROUTES } from '../sites/routes.generated'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '../sites/registry'

// Drift guard for the GENERATED per-site route map (routes.generated.ts, written
// by frontend/tools/gen-site-routes.py): re-derive the map from the actual
// App Router trees under main/ + marketing/ and require exact equality, so a
// page added, moved, or removed anywhere in the family fails here until the
// generator is re-run. The walk below mirrors the generator's segment semantics
// EXACTLY — route groups `(x)` descend without a URL segment; private `_x`,
// parallel-slot `@x`, dot-dirs, and interceptor `(.)x`/`(..)x`/`(...)x` subtrees
// are skipped; dynamic segments are kept verbatim.

const websitesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const FAMILIES = ['main', 'marketing'] as const
const PAGE_NAMES = new Set(['tsx', 'jsx', 'js', 'mdx', 'ts'].map((ext) => `page.${ext}`))

function collectRoutes(dir: string, segments: string[], routes: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) {
      if (PAGE_NAMES.has(entry.name)) routes.add(`/${segments.join('/')}`)
    } else if (entry.isDirectory()) {
      const name = entry.name
      if (name.startsWith('_') || name.startsWith('@') || name.startsWith('.')) continue
      if (name.startsWith('(') && name.endsWith(')')) {
        collectRoutes(resolve(dir, name), segments, routes)
      } else if (name.startsWith('(')) {
        continue
      } else {
        collectRoutes(resolve(dir, name), [...segments, name], routes)
      }
    }
  }
}

function scanFamilies(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const family of FAMILIES) {
    for (const site of readdirSync(resolve(websitesDir, family), { withFileTypes: true })) {
      if (!site.isDirectory()) continue
      const appDir = resolve(websitesDir, family, site.name, 'app')
      if (!existsSync(appDir)) continue // not a Next app (e.g. main/api is a static site)
      const routes = new Set<string>()
      collectRoutes(appDir, [], routes)
      if (routes.size > 0) out[site.name] = [...routes].sort()
    }
  }
  return out
}

describe('SITE_ROUTES (generated per-site route map)', () => {
  const rescanned = scanFamilies()

  it('matches a fresh scan of every family app tree — regenerate with gen-site-routes.py on mismatch', () => {
    expect(SITE_ROUTES).toEqual(rescanned)
  })

  it('keys only registry family sites, so the SiteId typing stays honest', () => {
    const family = new Set<string>([...MAIN_SITE_IDS, ...MARKETING_SITE_IDS])
    for (const key of Object.keys(SITE_ROUTES)) expect(family).toContain(key)
  })

  it('lists absolute, sorted, deduplicated paths per site', () => {
    for (const [site, paths] of Object.entries(SITE_ROUTES)) {
      expect(paths!.length, site).toBeGreaterThan(0)
      expect(paths!.every((p) => p.startsWith('/')), site).toBe(true)
      expect([...new Set(paths)].sort(), site).toEqual([...paths!])
    }
  })
})
