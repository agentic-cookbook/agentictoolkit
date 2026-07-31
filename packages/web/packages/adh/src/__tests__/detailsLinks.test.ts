import { describe, it, expect } from 'vitest'
import { conceptDetailsUrl, servesConceptDetails } from '../concepts/details-links'
import { CONCEPT_SITE_IDS } from '../concepts'
import { conceptIds, ownerSiteOf } from '../concepts'
import { SITE_ROUTES } from '@agentic-toolkit/adh-registry/routes'
import { getSite, type SiteId } from '@agentic-toolkit/adh-registry'

/**
 * A related-concept chip must never point at a URL its owner does not serve.
 *
 * `devteam` is the reason. It is in `CONCEPT_SITE_IDS` — correctly, that set
 * drives the header's relative "Details" link — but it renders its own details
 * tree under `/details/[[...path]]` with `dynamicParams = false`, so
 * `/details/<concept id>` is a hard 404 there rather than a page. Reading
 * membership of that set as "can be deep-linked" sent every chip for a
 * devteam-owned concept, from all 31 other sites, to a 404.
 */
describe('conceptDetailsUrl', () => {
  it('deep-links a concept on a site that serves the shared details route', () => {
    expect(servesConceptDetails('billing')).toBe(true)
    expect(conceptDetailsUrl('billing', 'billing', 'products')).toBe(
      `https://${getSite('billing')!.prodHost}/details/billing`,
    )
  })

  it('sends a devteam-owned concept to the devteam landing, not to a 404', () => {
    expect(servesConceptDetails('devteam')).toBe(false)
    expect(conceptDetailsUrl('devteam', 'devteam', 'products')).toBe(
      `https://${getSite('devteam')!.prodHost}/`,
    )
  })

  it('stays relative for a concept the current site owns', () => {
    expect(conceptDetailsUrl('billing', 'billing', 'billing')).toBe('/details/billing')
    expect(conceptDetailsUrl('devteam', 'devteam', 'devteam')).toBe('/details/devteam')
  })

  it('stays relative for an unowned concept', () => {
    expect(conceptDetailsUrl('anything', undefined, 'billing')).toBe('/details/anything')
  })

  // The drift guard. `SITE_ROUTES` is rescanned from the filesystem by
  // siteRoutes.test.ts, so this ties the linking rule to the routes that exist:
  // a site that gains the shared details route starts being deep-linked, and one
  // that replaces it with a hand-built tree stops, without either being listed
  // anywhere by hand.
  it('agrees with the generated route map for every concept site', () => {
    for (const siteId of CONCEPT_SITE_IDS) {
      const routes = SITE_ROUTES[siteId] ?? []
      expect(servesConceptDetails(siteId)).toBe(routes.includes('/details/[topic]'))
    }
  })

  // The property that actually matters, checked over the real data rather than
  // over an example: no owned concept may produce a URL a site does not serve.
  it('never mints a /details URL on a site without the shared route', () => {
    const offenders: string[] = []
    for (const id of conceptIds) {
      const owner = ownerSiteOf(id) as SiteId | undefined
      if (!owner || servesConceptDetails(owner)) continue
      const url = conceptDetailsUrl(id, owner, 'products')
      if (url.includes('/details/')) offenders.push(`${id} → ${url}`)
    }
    expect(offenders).toEqual([])
  })
})
