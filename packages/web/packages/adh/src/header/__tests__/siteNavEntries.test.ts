import { describe, it, expect } from 'vitest'

import { buildSiteNavEntries, SITE_NAV_SECTION } from '../siteNavEntries'
import { DEBUG_SECTION } from '../debugSiteGroups'
import type { NavLink } from '../NavLink'

// The site menu's phone-only rows: the destinations the header bar drops below 768px
// (`.adh-header__links { display: none }`). SiteMenu decides WHEN via
// `useHeaderLinksCollapsed`; this builder decides WHAT, and is where the de-dup and the
// `current` rule live.

const HUB_NAV: NavLink[] = [
  { label: 'home', href: '/home' },
  { label: 'details', href: '/details', matchPaths: ['/details', '/details/*'] },
  { label: 'contact', href: '/contact' },
]

const leaf = (e: ReturnType<typeof buildSiteNavEntries>[number]) =>
  e as Extract<typeof e, { kind: 'leaf' }>

describe('buildSiteNavEntries', () => {
  it('turns each nav link into a leaf row carrying the bar’s own label and href', () => {
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/elsewhere', pathname: '/' })

    expect(out).toHaveLength(3)
    expect(out.map((e) => leaf(e).item.label)).toEqual(['home', 'details', 'contact'])
    expect(out.map((e) => leaf(e).item.href)).toEqual(['/home', '/details', '/contact'])
    // Labels verbatim — hub's bar spells them lowercase, and a row that says "Home"
    // where the bar says "home" is a different destination as far as the reader knows.
    expect(out.every((e) => e.kind === 'leaf')).toBe(true)
  })

  it('drops the link that duplicates the menu’s own Home row', () => {
    // Hub signed in: the bar carries `/home` AND the menu's top section opens with a
    // Home row pointing at the same place. Two Homes, one above the other.
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/home', pathname: '/home' })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/details', '/contact'])
  })

  it('keeps that same link when no Home row exists to duplicate', () => {
    // Signed out, `SiteMenu`'s top section is Login / Sign up — there is no Home row,
    // so nothing is being de-duplicated against. Community's "Forum" IS `/home`: drop
    // it here and an anonymous phone visitor has no route to the board at all.
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: undefined, pathname: '/home' })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/home', '/details', '/contact'])
  })

  it('drops the link that duplicates the menu’s own Details row', () => {
    // Hub signed OUT keeps exactly one bar link — `details` — and the menu now renders a
    // canonical Details row below Help. Below 768px the bar's links fold into that same
    // menu, so without this the phone opens on two identical Details rows.
    const out = buildSiteNavEntries(HUB_NAV, {
      homeHref: undefined,
      detailsHref: '/details',
      pathname: '/details',
    })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/home', '/contact'])
  })

  it('drops Home and Details together when the menu renders both', () => {
    const out = buildSiteNavEntries(HUB_NAV, {
      homeHref: '/home',
      detailsHref: '/details',
      pathname: '/',
    })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/contact'])
  })

  it('keeps a details link on a site whose menu has no Details row', () => {
    // The 11 sites with no `/details` page get no row to duplicate. A site that declares
    // one in its bar anyway must keep it, exactly as with `homeHref`.
    const out = buildSiteNavEntries(HUB_NAV, {
      homeHref: undefined,
      detailsHref: undefined,
      pathname: '/',
    })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/home', '/details', '/contact'])
  })

  it('keeps a link to `/`, which the BAR drops but nothing else offers', () => {
    // The bar filters out `siteNameHref` (`/`) when the brand text links there — which
    // it only does when no `siteSwitcher` was supplied, and every adh site supplies
    // one. On a phone this menu is the only route to `/` there is.
    const out = buildSiteNavEntries([{ label: 'home', href: '/' }], {
      homeHref: '/home',
      pathname: '/about',
    })

    expect(out.map((e) => leaf(e).item.href)).toEqual(['/'])
  })

  it('marks `current` with the bar’s own matcher, prefixes included', () => {
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/x', pathname: '/details/acme' })
    const current = out.filter((e) => leaf(e).item.current).map((e) => leaf(e).item.href)

    // `/details/*` matches the child route, exactly as `NavLinkItem` does in the bar —
    // the same destination must not highlight in one place and not the other.
    expect(current).toEqual(['/details'])
  })

  it('marks nothing current on an unrelated route', () => {
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/x', pathname: '/settings' })
    expect(out.some((e) => leaf(e).item.current)).toBe(false)
  })

  it('returns nothing when the host declared no nav', () => {
    expect(buildSiteNavEntries(undefined, { homeHref: '/home', pathname: '/' })).toEqual([])
    expect(buildSiteNavEntries([], { homeHref: '/home', pathname: '/' })).toEqual([])
  })

  it('carries a section distinct from every other the menu renders', () => {
    // The popover rules a divider wherever adjacent entries disagree on `section`. If
    // this collided with the hub core (1) or the dev tools (2), the site's own nav
    // would silently merge into that block instead of standing as its own group.
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/x', pathname: '/' })

    expect(new Set(out.map((e) => e.section))).toEqual(new Set([SITE_NAV_SECTION]))
    expect(SITE_NAV_SECTION).not.toBe(0) // SiteMenu's auth top section
    expect(SITE_NAV_SECTION).not.toBe(1) // hubCoreGroups' HUB_SECTION
    expect(SITE_NAV_SECTION).not.toBe(DEBUG_SECTION)
  })

  it('gives every row a key of its own, so two labels at one href cannot collide', () => {
    const out = buildSiteNavEntries(HUB_NAV, { homeHref: '/x', pathname: '/' })
    const keys = out.map((e) => leaf(e).item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
