import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ADMIN_SITE_IDS, getSite, SITES } from '@agentic-toolkit/adh-registry'

// The fleet tree — the family as nine top-level rows. Its contract is mostly about what
// a reader SEES, so most of this resolves the config through the engine rather than
// reading the literal: a row whose icon or tagline is missing is missing on screen
// whether the gap is in this file or in the registry it defers to.

// Mutable so a case can resolve the tree from somewhere other than the landing — the
// `mock` prefix is what lets vitest's hoisted factory close over it.
let mockPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: vi.fn() }),
}))

import { ADMIN_MENU_GROUPS, ADMIN_SECTION, FLEET_MENU_GROUPS, FLEET_SECTION } from '../fleetMenuGroups'
import { useSiteMenu, type UseSiteMenuOpts } from '../useSiteMenu'
import { type MenuGroup, type MenuLink } from '../SiteMenu'
import { type PopoverEntry } from '@agentic-toolkit/adh/header'

/** Resolve a tree as the hub's header would. Defaults to the fleet tree seen by a
 *  signed-out visitor on the marketing landing; pass a `pathname` and the session bits
 *  to place them elsewhere, or `groups` to resolve the admin block instead. */
function resolve(
  {
    pathname = '/',
    groups = FLEET_MENU_GROUPS,
    ...opts
  }: { pathname?: string; groups?: MenuGroup[] } & Partial<UseSiteMenuOpts> = {},
): PopoverEntry[] {
  mockPath = pathname
  const { result } = renderHook(() => useSiteMenu(groups, { currentSiteId: 'hub', ...opts }))
  return result.current.entries
}

/** Every link in a tree, top-level rows and submenu children alike. */
function allLinks(groups: MenuGroup[] = FLEET_MENU_GROUPS): MenuLink[] {
  return groups.flatMap((g) =>
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

  // Nothing in this tree is auth-conditional (see the module comment): the rows a
  // visitor sees, and what each one is called, are the same signed out on the landing
  // as signed in inside a workspace. A session changes where a row GOES — the workspace
  // carry, which is useSiteMenu's own contract and tested there — never which rows
  // exist, so a row that quietly appears or vanishes with the session fails here.
  it('resolves the same rows, names and taglines signed out and signed in', () => {
    const shape = (entries: PopoverEntry[]): unknown[] =>
      entries.map((e) =>
        e.kind === 'topic'
          ? {
              label: e.label,
              description: e.description,
              hasIcon: Boolean(e.icon),
              // A topic that is a site navigates as well as opens; a grouping header
              // only opens. That split must not move with the session either.
              navigable: e.href !== undefined,
              items: e.items.map((i) => [i.label, i.description, Boolean(i.icon)]),
            }
          : { label: e.item.label, description: e.item.description, hasIcon: Boolean(e.item.icon) },
      )
    const signedOut = shape(resolve())
    const signedIn = shape(
      resolve({ pathname: '/acme/ecosystems', authenticated: true, personalSlug: 'acme' }),
    )
    expect(signedIn).toEqual(signedOut)
  })

  it('names a real registry site in every `site` link', () => {
    for (const link of allLinks())
      if ('site' in link) expect(getSite(link.site), link.site).toBeTruthy()
  })

  // The one destination the family has no site for. It is a deliberate exception (see
  // MenuLink's `href` variant) and it pays the price, so it is pinned by name: a row that
  // quietly joins this list has lost its per-env host, its SSO wrap and its `current`.
  it('writes out an absolute URL only for the one destination with no site', () => {
    const raw = allLinks().filter((l): l is Extract<MenuLink, { href: string }> => 'href' in l)
    // Hire ▸ Registry used to be here; it is `{ site: 'registry' }` now. What is left is
    // the studio, which has no registry entry ON PURPOSE (see the row's comment) rather
    // than not yet — so unlike its predecessor this one is not waiting to be promoted.
    expect(raw.map((l) => l.label)).toEqual(['Agentic Development Studio'])
    for (const l of raw) {
      expect(l.href, l.label).toMatch(/^https:\/\//)
      // Nothing can key its icon off a registry id it does not have.
      expect(l.iconKey, `${l.label} must name its own icon`).toBeTruthy()
    }
  })

  // The half the pinned list above cannot see. A row is written `{ href }` BECAUSE the
  // registry has no such site — so the day one ships, this row's URL becomes a registry
  // host and the exception silently becomes a defect. That is not hypothetical: three
  // rows here (Organizations, Notes, Integrations) sat absolute for exactly as long as it
  // took another branch to add their registry entries, and nothing failed. The list above
  // fails only when a row is ADDED; this fails when the registry catches one up.
  it('has no absolute row pointing at a site the registry now has', () => {
    const hosts = new Map(SITES.map((s) => [s.prodHost, s.id]))
    for (const l of [...allLinks(), ...allLinks(ADMIN_MENU_GROUPS)]) {
      if (!('href' in l)) continue
      const id = hosts.get(new URL(l.href).host)
      expect(id, `${l.label} is site '${id}' now — make it { site: '${id}' }`).toBeUndefined()
    }
  })
})

describe('ADMIN_MENU_GROUPS', () => {
  it('is one topic, in its own section below the family', () => {
    const entries = resolve({ groups: ADMIN_MENU_GROUPS })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.kind).toBe('topic')
    expect(entries[0]!.section).toBe(ADMIN_SECTION)
    // Strictly after the fleet's, which is what puts a divider between the two.
    expect(ADMIN_SECTION).toBeGreaterThan(FLEET_SECTION)
  })

  it('is a pure grouping header — the consoles are inside it, not the row itself', () => {
    const [topic] = resolve({ groups: ADMIN_MENU_GROUPS })
    expect(topic?.kind === 'topic' && topic.href).toBeUndefined()
  })

  // The rows are DERIVED from the registry's adminOnly flag, so the set an admin is
  // shown and the set the footer overview hides cannot drift. A console added to the
  // registry appears here with no edit to the menu; one that loses the flag leaves.
  it('carries every adminOnly site, and only those, plus the fleet monitor', () => {
    const sites = allLinks(ADMIN_MENU_GROUPS).flatMap((l) => ('site' in l ? [l.site] : []))
    expect(sites).toEqual(ADMIN_SITE_IDS)
    expect(sites.length).toBeGreaterThan(0) // non-vacuity: the flag is set on something
    const raw = allLinks(ADMIN_MENU_GROUPS).filter(
      (l): l is Extract<MenuLink, { href: string }> => 'href' in l,
    )
    // The monitor is a backend service, not a family site — there is no registry entry
    // to derive it from, so it is written out. Same exception, same price.
    expect(raw.map((l) => l.href)).toEqual(['https://lewis.agenticdeveloperhub.com'])
    for (const l of raw) expect(l.iconKey, `${l.label} must name its own icon`).toBeTruthy()
  })

  it('gives every row an icon and a tagline, like the family tree above', () => {
    for (const e of resolve({ groups: ADMIN_MENU_GROUPS })) {
      const rows =
        e.kind === 'topic'
          ? [{ label: e.label, icon: e.icon, description: e.description }, ...e.items]
          : [e.item]
      for (const r of rows) {
        expect(r.icon, `${r.label} has no icon`).toBeTruthy()
        expect(r.description?.trim(), `${r.label} has no tagline`).toBeTruthy()
      }
    }
  })
})
