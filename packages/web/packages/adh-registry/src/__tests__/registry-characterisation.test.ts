import { describe, expect, it } from 'vitest'
import {
  getSite,
  personaProfileUrl,
  siteHomePath,
  siteProdUrl,
  siteUrl,
  splitSiteTitle,
} from '../index'
import { canonicalOnly, ogImageSize, siteMetadata } from '../seo'

describe('registry URL helpers (pins behaviour across the @agentic-toolkit/adh-registry extraction)', () => {
  it('siteProdUrl is host-independent and always https', () => {
    expect(siteProdUrl('hub', '/')).toBe('https://agenticdeveloperhub.com/')
  })

  it('siteUrl preserves the env of the current host', () => {
    expect(siteUrl('hub', '/', 'testing.agenticdeveloperhub.com')).toBe(
      'https://testing.agenticdeveloperhub.com/',
    )
    expect(siteUrl('hub', '/', 'agenticdeveloperhub.com')).toBe('https://agenticdeveloperhub.com/')
  })

  it('siteUrl falls through to the raw path for an unknown id', () => {
    expect(siteUrl('nope' as never, '/x', 'agenticdeveloperhub.com')).toBe('/x')
  })

  it('siteHomePath is /home only for sites that expose one', () => {
    expect(siteHomePath('hub')).toBe(siteHomePath(getSite('hub')!.id))
    expect(['/home', '/']).toContain(siteHomePath('hub'))
  })

  it('personaProfileUrl percent-encodes the slug onto the persona registry', () => {
    expect(personaProfileUrl('a b')).toContain('/a%20b')
  })

  it('splitSiteTitle splits the brand lead from the accent', () => {
    expect(splitSiteTitle(getSite('hub')!)).toEqual({
      titleLead: 'Agentic Developer',
      titleAccent: 'Hub',
    })
  })
})

describe('seo helpers (251 consumers, no other test)', () => {
  it('canonicalOnly emits only the canonical alternate', () => {
    expect(canonicalOnly('/')).toEqual({ alternates: { canonical: '/' } })
  })

  it('siteMetadata derives title, description and a canonical from the registry', () => {
    const md = siteMetadata('hub', { title: 'T', description: 'D' })
    expect(md.title).toBe('T')
    expect(md.description).toBe('D')
    expect(md.openGraph).toBeTruthy()
  })

  it('ogImageSize is the 1200x630 card every unfurler accepts', () => {
    expect(ogImageSize).toEqual({ width: 1200, height: 630 })
  })
})
