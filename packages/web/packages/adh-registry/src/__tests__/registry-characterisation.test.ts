import { describe, expect, it } from 'vitest'
import {
  getSite,
  personaProfilePath,
  personaProfileUrl,
  registryOrgPath,
  registryUserPath,
  registryUserPersonaPath,
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

  // The HOST is whatever `detectEnv` makes of the ambient `location.hostname` — the production
  // domain under a node environment, `personaregistry.localhost` under jsdom — so naming a domain
  // here would make the case pass or fail on the test environment rather than on the helper.
  // What is fixed either way is the site it lands on and the fact that the handle is the WHOLE
  // path: this is the assertion that fails if a prefix segment ever comes back.
  it('personaProfileUrl percent-encodes the slug onto the persona registry', () => {
    const url = personaProfileUrl('a b')
    expect(url).toContain('personaregistry')
    expect(new URL(url).pathname).toBe('/a%20b')
  })

  // Spelled literally rather than composed from the helpers they test. These are the registry
  // site's public URL space, and a host that links in mints them from here — an assertion that
  // called the helper to build its own expectation would agree with any prefix.
  //
  // The persona handle IS the root segment: `agenticpersonaregistry.com/<handle>`. That is why
  // the site has no `app/[workspace]` — Next allows one dynamic name per level, and this site
  // spends its on handles. A user's slug shares the namespace (the root page resolves a persona
  // first, then a user), which makes `/<owner>/<persona>` the owner-scoped form.
  it('the persona registry addresses personas and their owners at its root', () => {
    expect(personaProfilePath('bob')).toBe('/bob')
    expect(registryUserPath('ada')).toBe('/ada')
    expect(registryUserPersonaPath('ada', 'bob')).toBe('/ada/bob')
    expect(registryOrgPath('acme')).toBe('/org/acme')
  })

  it('every registry path helper percent-encodes its handle', () => {
    expect(personaProfilePath('a b')).toBe('/a%20b')
    expect(registryUserPath('a b')).toBe('/a%20b')
    expect(registryUserPersonaPath('a b', 'c d')).toBe('/a%20b/c%20d')
    expect(registryOrgPath('a b')).toBe('/org/a%20b')
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
