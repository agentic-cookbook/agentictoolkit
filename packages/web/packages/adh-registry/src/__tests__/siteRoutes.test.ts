import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { SITE_ROUTES, SITE_ROUTE_SHARES } from '../sites/routes.generated'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '../sites/registry'

// Shape guard for the GENERATED per-site route map. These are the invariants this
// package can own: the map's keys must be real registry site ids, and its values must
// be the absolute, sorted, deduplicated paths the site menu assumes.
//
// The map arrives in one share per repo that builds part of the fleet —
// `routes.main.generated.ts` from adh, `routes.marketing.generated.ts` from
// adhmarketing, `routes.placeholder.generated.ts` from adhplaceholders,
// `routes.hub.generated.ts` from agenticdeveloperhubwebsite,
// `routes.devteam.generated.ts` from agenticdeveloperteamwebsite,
// `routes.cookbook.generated.ts` from agenticdevelopercookbookwebsite,
// `routes.toolkit.generated.ts` from agenticdevelopertoolkitwebsite,
// `routes.personaregistry.generated.ts` from agenticpersonaregistrywebsite,
// `routes.community.generated.ts` from agenticdevelopercommunitywebsite — because
// this package is a submodule of all of them, each owns part of the fleet, and no
// generator can see the others' site trees.
// `routes.generated.ts` merges them and is hand-written. The two assertions about that
// arrangement are below; they exist because both of its failure modes are silent, and
// both look like a perfectly valid smaller map.
//
// Both read the share list off `SITE_ROUTE_SHARES` rather than naming the shares
// again. A test that had to be edited to know about a new share is a test that
// passes for a share nobody added it to — which is the exact failure the first of
// them exists to catch.
//
// The FRESHNESS half deliberately does NOT live here. It used to: this file re-walked
// `main/`+`marketing/` from an anchor four levels up, which resolves to
// `<toolkit>/packages/web` — a directory with no site families in it. Nor could any
// anchor have worked, because this package is a submodule of adh: in a standalone
// toolkit clone the sites are simply absent. The generator owns that check instead
// (`python3 <websites-root>/tools/gen-site-routes.py --region <share> --check`, run by
// each repo's own CI over its own share), which also leaves exactly one copy of the App
// Router segment semantics rather than two.

const shares = Object.entries(SITE_ROUTE_SHARES)

/** What each share's committed file is expected to hold — read the long note in
 *  the `has every share filled in` assertion below before editing this.
 *  `'empty'` is a claim about the OWNING REPO: it says that repo owns no App
 *  Router tree the generator can walk, so an empty file is the correct committed
 *  state rather than the symptom of a region nobody claimed. Every other share
 *  must name at least one site. Both halves are asserted, and the table is
 *  checked against `SITE_ROUTE_SHARES` in both directions, so an entry that
 *  stops being true fails here rather than silently disarming the guard. */
const EXPECTED_FILL: Record<keyof typeof SITE_ROUTE_SHARES, 'empty' | 'some'> = {
  community: 'some',
  cookbook: 'some',
  devteam: 'some',
  docs: 'some',
  hub: 'some',
  // adh, since 2026-08-31. `registry` was the last site left in adh and it left
  // for agenticdeveloperregistrywebsite, so `main` names a repo that owns no site
  // tree at all: `--region main` now legitimately writes an empty map. Delete this
  // line the moment adh builds a site again.
  main: 'empty',
  marketing: 'some',
  personaregistry: 'some',
  placeholder: 'some',
  registry: 'some',
  research: 'some',
  shipr: 'some',
  toolkit: 'some',
}
const SITES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../sites')

describe('SITE_ROUTES (generated per-site route map)', () => {
  it('keys only registry family sites, so the SiteId typing stays honest', () => {
    const family = new Set<string>([...MAIN_SITE_IDS, ...MARKETING_SITE_IDS])
    for (const key of Object.keys(SITE_ROUTES)) expect(family).toContain(key)
  })

  it('merges every share file that exists on disk', () => {
    // The one case here that does NOT read SITE_ROUTE_SHARES, because that list is
    // precisely what an unmerged share is missing from. `routes.generated.ts` is
    // hand-written — its own header says a repo split "adds a region by editing this
    // file alone" — so the single step of a split with no generator behind it is also
    // the one nothing checked. A share file imported by nobody compiles, ships, and
    // takes its sites' routes out of the flyout and out of research's sitemap; every
    // other assertion in this file passes over it in silence, because it iterates the
    // shares that WERE merged.
    //
    // Reading the directory is fair here in a way re-walking the site trees was not
    // (see the header): these files are committed siblings of the index that merges
    // them, present in a standalone toolkit clone exactly as they are in adh.
    const onDisk = readdirSync(SITES_DIR)
      .map((f) => /^routes\.(.+)\.generated\.ts$/.exec(f)?.[1])
      .filter((r): r is string => Boolean(r))
      .sort()
    expect(onDisk.length, 'routes.<region>.generated.ts files').toBeGreaterThan(0)
    expect(onDisk, 'every share file must appear in SITE_ROUTE_SHARES, and vice versa').toEqual(
      shares.map(([region]) => region).sort(),
    )
  })

  it('has every share filled in', () => {
    // Each generator takes the share it owns as a `--region` argument, and no side
    // can see the others' values. Two repos passing the same one does not collide
    // and does not fail: the file nobody claimed is simply never rewritten again,
    // and it keeps whatever it was committed with — so an empty share is the only
    // symptom that mistake ever produces.
    expect(shares.length, 'SITE_ROUTE_SHARES').toBeGreaterThan(0)
    // The table is the roster's mirror, checked both ways first: a share with no
    // row would otherwise be exempted by the lookup below returning undefined, and
    // a row for a share that no longer exists would keep a claim alive about a
    // repo that has none.
    expect(Object.keys(EXPECTED_FILL).sort(), 'EXPECTED_FILL vs SITE_ROUTE_SHARES').toEqual(
      shares.map(([region]) => region).sort(),
    )
    for (const [region, share] of shares) {
      const n = Object.keys(share).length
      const label = `routes.${region}.generated.ts`
      if (EXPECTED_FILL[region as keyof typeof EXPECTED_FILL] === 'empty') {
        // Asserted exactly, not merely allowed: a repo declared to own no site
        // tree that starts writing entries here has either gained a site or been
        // handed another repo's region, and both need saying out loud.
        expect(n, `${label} (declared empty)`).toBe(0)
      } else {
        expect(n, label).toBeGreaterThan(0)
      }
    }
  })

  it('gives every site to exactly one share', () => {
    // A site in two shares is a spread that quietly resolves rather than an error,
    // so one repo's route list for it disappears with no diagnostic. It means a site
    // directory exists in two repos, which is the split itself having gone wrong.
    //
    // Pairwise, not just against main: the satellites never see each other at all —
    // hub-and-spoke means no satellite's CI ever checks another one out — so a site
    // duplicated between TWO SATELLITES is the pair no other guard in the fleet looks
    // at. Every satellite added by a split adds another such pair, and the newest is
    // always the likeliest: a share is carved out of `main`, so a departed site left
    // behind in `main` is a stale line rather than a mistake anyone had to make.
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
