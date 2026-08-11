import { describe, expect, it } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { RESERVED_SLUGS, isReservedSlug, isReservedSlugAnywhere } from '../reserved-slugs'
import type { SiteId } from '../registry'

// Walking up to the marker, and skipping when it is absent, is the same shape
// registry.test.ts uses in this package (MAIN_SITE_IDS / MARKETING_SITE_IDS) — deliberately
// re-stated here rather than shared, because a test-only helper is not worth adding to
// either file's public surface to reach across the boundary between them.
//
// Absent means one thing only: the toolkit checked out standalone, which is what its own
// web-tests.yml does. adh's ci.yml runs this suite from inside the adh checkout, where
// frontend/src is present and the filesystem cases run — so the guard still fires in the
// repository whose folders it is about.
const adhFrontendSrc = (): string | null => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    if (existsSync(resolve(dir, 'next-config-base.mjs'))) return dir
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}
const frontendSrcDir = adhFrontendSrc()
const STANDALONE = frontendSrcDir === null

function staticSegments(siteId: string): string[] {
  const appDir = resolve(frontendSrcDir as string, 'sites', siteId, 'app')
  if (!existsSync(appDir)) return []
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
  for (const siteId of Object.keys(RESERVED_SLUGS) as SiteId[]) {
    it.skipIf(STANDALONE)(`${siteId} reserves every static segment its app/ dir actually has`, () => {
      const onDisk = staticSegments(siteId)
      expect(onDisk.length, `no app/ dir found for ${siteId}`).toBeGreaterThan(0)
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
