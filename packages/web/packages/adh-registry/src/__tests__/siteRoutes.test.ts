import { describe, it, expect } from 'vitest'
import {
  SITE_ROUTES,
  SITE_ROUTES_HUB,
  SITE_ROUTES_MAIN,
  SITE_ROUTES_MARKETING,
  SITE_ROUTES_PLACEHOLDER,
} from '../sites/routes.generated'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '../sites/registry'

// Shape guard for the GENERATED per-site route map. These are the invariants this
// package can own: the map's keys must be real registry site ids, and its values must
// be the absolute, sorted, deduplicated paths the site menu assumes.
//
// The map arrives in four shares — `routes.main.generated.ts` from adh,
// `routes.marketing.generated.ts` from adhmarketing, `routes.placeholder.generated.ts`
// from adhplaceholders, `routes.hub.generated.ts` from agenticdeveloperhubwebsite —
// because this package is a submodule of all four, each owns part of the fleet, and no
// generator can see the others' site trees.
// `routes.generated.ts` merges them and is hand-written. The two assertions about that
// arrangement are below; they exist because both of its failure modes are silent, and
// both look like a perfectly valid smaller map.
//
// The FRESHNESS half deliberately does NOT live here. It used to: this file re-walked
// `main/`+`marketing/` from an anchor four levels up, which resolves to
// `<toolkit>/packages/web` — a directory with no site families in it. Nor could any
// anchor have worked, because this package is a submodule of adh: in a standalone
// toolkit clone the sites are simply absent. The generator owns that check instead
// (`python3 <websites-root>/tools/gen-site-routes.py --region <share> --check`, run by
// each repo's own CI over its own share), which also leaves exactly one copy of the App
// Router segment semantics rather than two.

describe('SITE_ROUTES (generated per-site route map)', () => {
  it('keys only registry family sites, so the SiteId typing stays honest', () => {
    const family = new Set<string>([...MAIN_SITE_IDS, ...MARKETING_SITE_IDS])
    for (const key of Object.keys(SITE_ROUTES)) expect(family).toContain(key)
  })

  it('has every share filled in', () => {
    // Each generator takes the share it owns as a `--region` argument, and no side
    // can see the others' values. Two repos passing the same one does not collide
    // and does not fail: the file nobody claimed is simply never rewritten again,
    // and it keeps whatever it was committed with — so an empty share is the only
    // symptom that mistake ever produces.
    expect(Object.keys(SITE_ROUTES_HUB).length, 'routes.hub.generated.ts').toBeGreaterThan(0)
    expect(Object.keys(SITE_ROUTES_MAIN).length, 'routes.main.generated.ts').toBeGreaterThan(0)
    expect(
      Object.keys(SITE_ROUTES_MARKETING).length,
      'routes.marketing.generated.ts',
    ).toBeGreaterThan(0)
    expect(
      Object.keys(SITE_ROUTES_PLACEHOLDER).length,
      'routes.placeholder.generated.ts',
    ).toBeGreaterThan(0)
  })

  it('gives every site to exactly one share', () => {
    // A site in two shares is a spread that quietly resolves rather than an error,
    // so one repo's route list for it disappears with no diagnostic. It means a site
    // directory exists in two repos, which is the split itself having gone wrong.
    //
    // Pairwise, not just against main: the satellites never see each other at all —
    // hub-and-spoke means no satellite's CI ever checks another one out — so a site
    // duplicated between TWO SATELLITES is the pair no other guard in the fleet looks
    // at. That is three such pairs now that `hub` is a share rather than part of
    // `main`, and the newest of them is the likeliest: `main` and `hub` were one file
    // until 2026-08-30, so a hub site left behind in `main` is a stale line rather
    // than a mistake anyone had to make.
    const shares = [
      ['hub', SITE_ROUTES_HUB],
      ['main', SITE_ROUTES_MAIN],
      ['marketing', SITE_ROUTES_MARKETING],
      ['placeholder', SITE_ROUTES_PLACEHOLDER],
    ] as const
    for (const [i, [a, left]] of shares.entries()) {
      for (const [b, right] of shares.slice(i + 1)) {
        const both = Object.keys(left).filter((id) => id in right)
        expect(both, `claimed by both ${a} and ${b}`).toEqual([])
      }
    }
    expect(Object.keys(SITE_ROUTES).length).toBe(
      shares.reduce((n, [, share]) => n + Object.keys(share).length, 0),
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
