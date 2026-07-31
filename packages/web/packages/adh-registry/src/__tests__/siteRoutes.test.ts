import { describe, it, expect } from 'vitest'
import { SITE_ROUTES } from '../sites/routes.generated'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '../sites/registry'

// Shape guard for the GENERATED per-site route map (routes.generated.ts, written by
// adh's frontend/tools/gen-site-routes.py). These are the invariants this package can
// own: the map's keys must be real registry site ids, and its values must be the
// absolute, sorted, deduplicated paths the site menu assumes.
//
// The FRESHNESS half deliberately does NOT live here. It used to: this file re-walked
// `main/`+`marketing/` from an anchor four levels up, which resolves to
// `<toolkit>/packages/web` — a directory with no site families in it. Nor could any
// anchor have worked, because this package is a submodule of adh: in a standalone
// toolkit clone the sites are simply absent. The generator owns that check instead
// (`python3 frontend/tools/gen-site-routes.py --check`, run by adh's CI), which also
// leaves exactly one copy of the App Router segment semantics rather than two.

describe('SITE_ROUTES (generated per-site route map)', () => {
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
