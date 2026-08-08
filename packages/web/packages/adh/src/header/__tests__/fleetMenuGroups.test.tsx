import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { getSite } from '@agentic-toolkit/adh-registry'

// The fleet tree — the family as ten top-level rows. Its contract is mostly about what
// a reader SEES, so most of this resolves the config through the engine rather than
// reading the literal: a row whose icon or tagline is missing is missing on screen
// whether the gap is in this file or in the registry it defers to.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

import { FLEET_MENU_GROUPS, FLEET_SECTION } from '../fleetMenuGroups'
import { useSiteMenu } from '../useSiteMenu'
import { type MenuLink } from '../SiteMenu'
import { type PopoverEntry } from '@agentic-toolkit/adh/header'

function resolve(): PopoverEntry[] {
  const { result } = renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub' }))
  return result.current.entries
}

/** Every link in the tree, top-level rows and submenu children alike. */
function allLinks(): MenuLink[] {
  return FLEET_MENU_GROUPS.flatMap((g) =>
    g.kind === 'topic' ? [...(g.link ? [g.link] : []), ...g.links] : [g.link],
  )
}

describe('FLEET_MENU_GROUPS', () => {
  it('is the nine top-level rows, in the order they are meant to be read', () => {
    expect(resolve().map((e) => (e.kind === 'topic' ? e.label : e.item.label))).toEqual([
      'Bitbag',
      'Hub',
      'Organizations',
      'Learn',
      'Plan',
      'Build',
      'Personas',
      'Products',
      'Hire',
    ])
  })

  it('sits in ONE section, so it reads as a single block between two dividers', () => {
    for (const e of resolve()) expect(e.section).toBe(FLEET_SECTION)
  })

  // The two requirements that apply to every row without exception. A `{ site }` row
  // takes both from the registry, so this fails when a site ships with no description
  // or no menu-icons entry just as loudly as when this file forgets one.
  it('gives every row — trigger, leaf and submenu child — an icon and a tagline', () => {
    for (const e of resolve()) {
      const rows = e.kind === 'topic' ? [{ label: e.label, icon: e.icon, description: e.description }, ...e.items] : [e.item]
      for (const r of rows) {
        expect(r.icon, `${r.label} has no icon`).toBeTruthy()
        expect(r.description?.trim(), `${r.label} has no tagline`).toBeTruthy()
      }
    }
  })

  it('surfaces a leaf row\'s tagline inline (`blurb`), the way a submenu row shows one', () => {
    for (const e of resolve()) if (e.kind === 'leaf') expect(e.blurb).toBe(true)
  })

  // A topic that IS a site navigates as well as opens; a pure grouping header only
  // opens. Both shapes exist on purpose, and confusing them is what makes a trigger
  // either a dead end or a surprise navigation.
  it('makes a topic that is a site navigable, and a grouping header not', () => {
    const byLabel = Object.fromEntries(
      resolve().flatMap((e) => (e.kind === 'topic' ? [[e.label, e]] : [])),
    )
    for (const label of ['Hub', 'Learn', 'Personas', 'Products', 'Hire'])
      expect(byLabel[label]?.href, `${label} should be a destination too`).toBeTruthy()
    // The family has no plan.* or build.* site for these to point at.
    for (const label of ['Plan', 'Build'])
      expect(byLabel[label]?.href, `${label} is a grouping header`).toBeUndefined()
  })

  it('names a real registry site in every `site` link', () => {
    for (const link of allLinks())
      if ('site' in link) expect(getSite(link.site), link.site).toBeTruthy()
  })

  // The rows for sites that do not exist as an app yet. Each is a deliberate exception
  // (see MenuLink's `href` variant) and each pays the same price, so they are pinned by
  // name: a row that quietly joins this list has lost its per-env host and SSO wrap.
  it('writes out an absolute URL only for the four destinations with no site', () => {
    const raw = allLinks().filter((l): l is Extract<MenuLink, { href: string }> => 'href' in l)
    expect(raw.map((l) => l.label)).toEqual(['Organizations', 'Notes', 'Integrations', 'Registry'])
    for (const l of raw) {
      expect(l.href, l.label).toMatch(/^https:\/\//)
      // Nothing can key its icon off a registry id it does not have.
      expect(l.iconKey, `${l.label} must name its own icon`).toBeTruthy()
    }
  })
})
