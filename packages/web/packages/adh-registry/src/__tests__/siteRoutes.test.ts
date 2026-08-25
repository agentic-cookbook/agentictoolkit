import { describe, it, expect } from 'vitest'
import { SITE_ROUTES, SITE_ROUTES_MAIN, SITE_ROUTES_MARKETING } from '../sites/routes.generated'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '../sites/registry'

// Shape guard for the GENERATED per-site route map. These are the invariants this
// package can own: the map's keys must be real registry site ids, and its values must
// be the absolute, sorted, deduplicated paths the site menu assumes.
//
// The map arrives in two halves — `routes.main.generated.ts` from adh,
// `routes.marketing.generated.ts` from adhmarketing — because this package is a
// submodule of both, each owns part of the fleet, and neither generator can see the
// other's site tree. `routes.generated.ts` merges them and is hand-written. The two
// assertions about that arrangement are below; they exist because both of its failure
// modes are silent, and both look like a perfectly valid smaller map.
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

  it('has both halves filled in', () => {
    // Each generator takes the half it owns as a `--region` argument, and neither
    // side can see the other's value. Both repos passing the same one does not
    // collide and does not fail: the file nobody claimed is simply never rewritten
    // again, and it keeps whatever it was committed with — so an empty half is the
    // only symptom that mistake ever produces.
    expect(Object.keys(SITE_ROUTES_MAIN).length, 'routes.main.generated.ts').toBeGreaterThan(0)
    expect(
      Object.keys(SITE_ROUTES_MARKETING).length,
      'routes.marketing.generated.ts',
    ).toBeGreaterThan(0)
  })

  it('gives every site to exactly one half', () => {
    // A site in both halves is a spread that quietly resolves rather than an error,
    // so one repo's route list for it disappears with no diagnostic. It means a site
    // directory exists in both repos, which is the split itself having gone wrong.
    const both = Object.keys(SITE_ROUTES_MAIN).filter((id) => id in SITE_ROUTES_MARKETING)
    expect(both, 'claimed by both repos').toEqual([])
    expect(Object.keys(SITE_ROUTES).length).toBe(
      Object.keys(SITE_ROUTES_MAIN).length + Object.keys(SITE_ROUTES_MARKETING).length,
    )
  })

  it('lists absolute, sorted, deduplicated paths per site', () => {
    for (const [site, paths] of Object.entries(SITE_ROUTES)) {
      expect(paths!.length, site).toBeGreaterThan(0)
      expect(paths!.every((p) => p.startsWith('/')), site).toBe(true)
      expect([...new Set(paths)].sort(), site).toEqual([...paths!])
    }
  })
})
