import { describe, expect, it } from 'vitest'
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { RESERVED_SLUGS, isReservedSlug, isReservedSlugAnywhere } from '../reserved-slugs'
import { siteIdForDir, type SiteId } from '../registry'

// Walking up to the marker, and skipping when it is absent, is the same shape
// registry.test.ts uses in this package (MAIN_SITE_IDS / MARKETING_SITE_IDS) — deliberately
// re-stated here rather than shared, because a test-only helper is not worth adding to
// either file's public surface to reach across the boundary between them.
//
// Absent means one thing only: the toolkit checked out standalone, which is what its own
// web-tests.yml does. adh's ci.yml and adhmarketing's both run this suite from inside a
// checkout that HAS site folders, so the filesystem cases run in the repositories whose
// folders they are about.
//
// The marker is the sites' pnpm workspace manifest, identified by the `-websites` SUFFIX of
// its name — adh's `adh-websites`, adhmarketing's `adhmarketing-websites` — so a third
// checkout holding site folders needs no edit here. It was `next-config-base.mjs` until that
// file was split into `@agentic-toolkit/adh-next-config` and deleted, at which point this walk
// returned null in an adh checkout too and every filesystem case below self-skipped GREEN in
// the one repository it was about. A sentinel that can be deleted takes the test with it
// silently; the workspace root every site installs from cannot be, and the name check is what
// stops the walk there rather than at the toolkit's own `packages/web/package.json`.
const websitesRoot = (): string | null => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const manifest = resolve(dir, 'package.json')
    if (existsSync(manifest)) {
      try {
        if (/-websites$/.test(JSON.parse(readFileSync(manifest, 'utf8')).name ?? '')) return dir
      } catch {
        // Unreadable or not JSON — not the marker; keep walking rather than throw.
      }
    }
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}
const websitesDir = websitesRoot()
const STANDALONE = websitesDir === null

// Build/tooling directories that can sit beside the real site apps. `external` holds the
// submodule checkouts (including this toolkit's own demo Next app, which is not a fleet site)
// and `tools` is the shared build/lint package; both would otherwise be walked into.
const NON_SITE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.turbo', 'external', 'tools',
])

/** Every site folder in THIS checkout, by the registry id that owns it.
 *
 *  Two things about the layout, both of which broke the `sites/<id>/app` this used to
 *  hard-code. A folder is named for the DOMAIN its site serves rather than for the id
 *  (`agenticdeveloperbilling/` builds `billing`) — `siteIdForDir` owns that join, and is the
 *  only place the convention is spelled. And sites sit at TWO depths: adh groups most of its
 *  under `adh/` and `placeholder/` with eight directly under the workspace, while adhmarketing
 *  has no group tier at all. A group directory is recognised by having no `app/` of its own,
 *  so it is descended into rather than listed.
 */
const siteAppDirs = (): Map<SiteId, string> => {
  const found = new Map<SiteId, string>()
  const walk = (root: string): void => {
    for (const name of readdirSync(root)) {
      if (name.startsWith('.') || NON_SITE_DIRS.has(name)) continue
      const dir = resolve(root, name)
      if (!statSync(dir).isDirectory()) continue
      if (!existsSync(resolve(dir, 'app'))) {
        walk(dir)
        continue
      }
      const id = siteIdForDir(name)
      // A Next app answering to no registry id is registry.test.ts's guard, not this one:
      // this file is about the slugs a KNOWN site reserves, and a second complaint about
      // the same folder in two suites is noise.
      if (id) found.set(id, resolve(dir, 'app'))
    }
  }
  walk(websitesDir as string)
  return found
}
const APP_DIRS = STANDALONE ? new Map<SiteId, string>() : siteAppDirs()

function staticSegments(siteId: SiteId): string[] {
  const appDir = APP_DIRS.get(siteId)
  if (appDir === undefined) return []
  return readdirSync(appDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    // A dynamic segment is not a reservation, and a route group is not a URL segment.
    .filter((e) => !e.name.startsWith('[') && !e.name.startsWith('(') && !e.name.startsWith('_'))
    .map((e) => e.name)
}

describe('reserved slugs', () => {
  // `Object.keys` erases to `string[]` regardless of `RESERVED_SLUGS`'s more specific key
  // type, so the loop variable needs an explicit cast to satisfy `isReservedSlug`'s now-`SiteId`
  // parameter (R6-M7) — every actual key here (`registries`, `consultants`) already is one.
  // Not every reserving site is in every checkout, and that is the split rather than a defect:
  // `registries` builds in adhmarketing, `consultants` and `research` in adh. So a missing
  // folder skips its own case, and the case below is what stops a suite that checked nothing
  // from reading like one that checked everything.
  //
  // It asserts on APP_DIRS, not on the reserving subset of it, and the difference is the whole
  // point. Until 2026-08-30 it demanded at least one RESERVING site — true of adh and
  // adhmarketing and of nothing else, so the one-site repos the monorepo split produces
  // (agenticdeveloperhubwebsite, agenticdeveloperteamwebsite, and every satellite after them)
  // failed it by construction while being entirely correct. What the guard is actually about is
  // the walk: a layout that moved, or a `siteIdForDir` that stopped answering, empties APP_DIRS
  // completely and every filesystem case below then self-skips green. A checkout holding site
  // folders but no reserving one is a real repository, and it still proves the walk works.

  it.skipIf(STANDALONE)('finds the site folders this checkout holds', () => {
    expect(
      APP_DIRS.size,
      `no directory under ${websitesDir} has an app/ dir that siteIdForDir answers for — ` +
        'either the layout moved again or siteIdForDir no longer answers for these folders, ' +
        'and every filesystem case below is passing without reading anything',
    ).toBeGreaterThan(0)
  })

  for (const siteId of Object.keys(RESERVED_SLUGS) as SiteId[]) {
    it.skipIf(STANDALONE || !APP_DIRS.has(siteId))(`${siteId} reserves every static segment its app/ dir actually has`, () => {
      const onDisk = staticSegments(siteId)
      expect(onDisk.length, `${siteId}'s app/ dir has no static segments at all`).toBeGreaterThan(0)
      for (const segment of onDisk) {
        expect(
          isReservedSlug(siteId, segment),
          `app/${segment}/ exists on ${siteId} but is not reserved — the name is spoken ` +
            `for by a page of this site's own, so a registrant must not be handed it`,
        ).toBe(true)
      }
    })
  }

  it('reserves the words no directory can vouch for', () => {
    // Framework-owned or not yet built: nothing on disk will ever put these in the list,
    // so they are named here or they are claimable.
    for (const word of ['api', '_next', 'admin', 'login', 'signin', 'signout', 'settings']) {
      expect(isReservedSlug('registries', word)).toBe(true)
    }
  })

  it('is case-insensitive', () => {
    expect(isReservedSlug('registries', 'Tour')).toBe(true)
    expect(isReservedSlug('registries', 'TOUR')).toBe(true)
  })

  it('does not reserve an ordinary slug', () => {
    expect(isReservedSlug('registries', 'fishlamp')).toBe(false)
    expect(isReservedSlug('consultants', 'mikefullerton')).toBe(false)
  })

  it('reserves nothing for a site it does not know', () => {
    expect(isReservedSlug('hub', 'anything')).toBe(false)
  })
})

describe('isReservedSlugAnywhere', () => {
  it('is true for a word the lists reserve and false for an ordinary one', () => {
    expect(isReservedSlugAnywhere('tour')).toBe(true)
    expect(isReservedSlugAnywhere('api')).toBe(true)
    expect(isReservedSlugAnywhere('fishlamp')).toBe(false)
  })

  it('normalises case and surrounding space, as the per-site predicate does', () => {
    expect(isReservedSlugAnywhere('TOUR')).toBe(true)
    expect(isReservedSlugAnywhere('  Tour  ')).toBe(true)
  })

  it('is the OR across sites, not one site\'s list', () => {
    // The two shipped lists are identical, so no fixed slug can tell `some` from `every`
    // here — the divergence this predicate exists for has to be created to be asserted.
    // `RESERVED_SLUGS` is `Readonly<...>` to its callers but an ordinary object at runtime,
    // so the extra site is added and removed inside a `finally`: a test that died holding
    // it would hand the next test a site id that does not exist.
    const map = RESERVED_SLUGS as Record<string, readonly string[]>
    map['a-site-only-this-test-knows'] = ['reserved-on-one-site-only']
    try {
      expect(isReservedSlugAnywhere('reserved-on-one-site-only')).toBe(true)
      expect(isReservedSlug('registries', 'reserved-on-one-site-only')).toBe(false)
      expect(isReservedSlugAnywhere('reserved-on-no-site-at-all')).toBe(false)
    } finally {
      delete map['a-site-only-this-test-knows']
    }
    expect(isReservedSlugAnywhere('reserved-on-one-site-only')).toBe(false)
  })
})
