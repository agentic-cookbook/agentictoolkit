import { describe, it, expect } from 'vitest'

import {
  buildBelowHelpEntries,
  siteDetailsHref,
  BELOW_HELP_SECTION,
} from '../belowHelpEntries'
import { SITE_NAV_SECTION } from '../siteNavEntries'
import { DEBUG_SECTION } from '../debugSiteGroups'
import { CONCEPT_SITE_IDS } from '../../concepts/participating'

// Contact + Details: the destinations that moved out of hub's header bar and into the
// site menu, immediately below Help. This menu is shared chrome across the whole family,
// so the tests that matter are the ones about what every OTHER site gets.

const leaf = (e: ReturnType<typeof buildBelowHelpEntries>[number]) =>
  e as Extract<typeof e, { kind: 'leaf' }>

const build = (o: Parameters<typeof buildBelowHelpEntries>[0]) => buildBelowHelpEntries(o)

describe('siteDetailsHref', () => {
  it('is site-RELATIVE, never a hub URL', () => {
    // The whole point of the split from Contact. Each of these sites ships its own
    // details page; resolving this through the hub would send every satellite's row to
    // the HUB's details instead of its own — a wrong destination on 32 sites at once.
    expect(siteDetailsHref('hub')).toBe('/details')
    expect(siteDetailsHref('academy')).toBe('/details')
  })

  it('covers the hub, which is NOT a concept site', () => {
    // Hub's details page predates CONCEPT_SITE_IDS and sits outside it, so the concept
    // predicate alone would drop the row on the very site this change was made for.
    expect(CONCEPT_SITE_IDS.has('hub')).toBe(false)
    expect(siteDetailsHref('hub')).toBe('/details')
  })

  it('covers every concept site', () => {
    for (const id of CONCEPT_SITE_IDS) expect(siteDetailsHref(id)).toBe('/details')
  })

  it('is undefined on a site with no details page', () => {
    // A menu row is a promise the destination exists. `cookbook` and `status` are apps,
    // not concept landings — they ship no /details, so they must get no row.
    expect(siteDetailsHref('cookbook')).toBeUndefined()
    expect(siteDetailsHref('status')).toBeUndefined()
  })
})

describe('buildBelowHelpEntries', () => {
  it('puts Contact first, then Details', () => {
    const out = build({ contactHref: '/contact', detailsHref: '/details', pathname: '/' })
    expect(out.map((e) => leaf(e).item.label)).toEqual(['Contact', 'Details'])
  })

  it('renders Contact even where there is no Details row', () => {
    // Contact is a HUB route — one page for the whole family — so it is never gated on
    // the current site the way Details is.
    const out = build({ contactHref: 'https://hub.example/contact', pathname: '/' })
    expect(out.map((e) => leaf(e).item.label)).toEqual(['Contact'])
  })

  it('carries Help’s own section, so no divider falls between them', () => {
    // The popover rules a divider wherever two adjacent entries disagree on `section`.
    // Help is section 0; these rows are "below Help", not a new group beneath it.
    const out = build({ contactHref: '/contact', detailsHref: '/details', pathname: '/' })
    expect(new Set(out.map((e) => e.section))).toEqual(new Set([BELOW_HELP_SECTION]))
    expect(BELOW_HELP_SECTION).toBe(0)
    // And distinct from every block that must stay a block of its own.
    expect(BELOW_HELP_SECTION).not.toBe(1) // hubCoreGroups' HUB_SECTION
    expect(BELOW_HELP_SECTION).not.toBe(SITE_NAV_SECTION)
    expect(BELOW_HELP_SECTION).not.toBe(DEBUG_SECTION)
  })

  it('passes the resolved Contact href straight through', () => {
    // SiteMenu resolves it via the engine's routeHref, so a satellite gets the hub's
    // absolute (SSO-wrapped) URL. This builder must not second-guess that.
    const url = 'https://hub.example/contact?return=x'
    const out = build({ contactHref: url, pathname: '/' })
    expect(leaf(out[0]!).item.href).toBe(url)
  })

  it('never marks a cross-site Contact current', () => {
    // An absolute URL is another origin; `pathname` says nothing about it. Without the
    // same-origin test, a satellite sitting at `/contact` would light up a row pointing
    // at the HUB's contact page.
    const out = build({ contactHref: 'https://hub.example/contact', pathname: '/contact' })
    expect(leaf(out[0]!).item.current).toBe(false)
  })

  it('never marks a protocol-relative Contact current', () => {
    const out = build({ contactHref: '//hub.example/contact', pathname: '//hub.example/contact' })
    expect(leaf(out[0]!).item.current).toBe(false)
  })

  it('marks Contact current on the hub’s own /contact', () => {
    const out = build({ contactHref: '/contact', pathname: '/contact' })
    expect(leaf(out[0]!).item.current).toBe(true)
  })

  it('keeps Details current on a details CHILD route', () => {
    // The bar's `details` link matched `/details/*` via matchPaths; the same destination
    // must not highlight in one surface and go dark in the other.
    const out = build({ contactHref: '/contact', detailsHref: '/details', pathname: '/details/acme' })
    expect(leaf(out[1]!).item.current).toBe(true)
  })

  it('does not mark Details current on a merely PREFIXED route', () => {
    // `/detailsomething` shares the prefix but is a different page.
    const out = build({ contactHref: '/contact', detailsHref: '/details', pathname: '/detailsomething' })
    expect(leaf(out[1]!).item.current).toBe(false)
  })

  it('gives both rows an icon and a distinct key', () => {
    const out = build({ contactHref: '/contact', detailsHref: '/details', pathname: '/' })
    expect(out.every((e) => leaf(e).item.icon !== undefined)).toBe(true)
    const keys = out.map((e) => leaf(e).item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
