import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { defineSite, siteSitemapRoutes, FAMILY_ROBOTS_DISALLOW } from '../site'
import type { SiteRoute } from '@agentic-toolkit/adh-registry/seo'

const seo = { title: 'T', description: 'D' }
const routes: SiteRoute[] = [{ path: '/' }]

describe('defineSite', () => {
  it('puts the id where all five of its old spellings were', () => {
    // `academy` used to appear in app/layout.tsx twice (siteMetadata + siteId), in
    // robots.ts, in sitemap.ts, and as `const SITE` in both details pages. The config
    // holds it once; `shell.siteId` is the copy the layout used to write by hand.
    const site = defineSite({ id: 'academy', seo, sitemap: routes })
    expect(site.id).toBe('academy')
    expect(site.shell.siteId).toBe('academy')
  })

  it('defaults the robots disallow list, and a site’s own list REPLACES it', () => {
    // Replace, not merge: `help` allows its whole surface and `hub` deliberately omits
    // `/home`, and neither can be expressed by adding to a list. A merging default would
    // make both sites impossible to write and the mistake would be invisible — robots.txt
    // is not something a build fails over.
    expect(defineSite({ id: 'academy', seo, sitemap: routes }).robotsDisallow).toEqual(
      FAMILY_ROBOTS_DISALLOW,
    )
    const help = defineSite({
      id: 'help',
      seo,
      sitemap: routes,
      robotsDisallow: ['/api/', '/auth/'],
    })
    expect(help.robotsDisallow).toEqual(['/api/', '/auth/'])
    expect(help.robotsDisallow).not.toContain('/home')
  })

  it('carries the shell seams through BY IDENTITY', () => {
    // Not equality: `providers` is a component TYPE, and React unmounts everything below a
    // type that changed. If this function ever wrapped or rebuilt it, every site would
    // lose its client tree on each render of the root layout — the same trap the Fragment
    // default in MarketingRootHtml exists to avoid, one level up.
    const Providers = ({ children }: { children: ReactNode }): ReactNode => children
    const header: ReactNode = 'SITE-OWN-HEADER'
    const navLinks = [{ label: 'A', href: '/a' }]
    const trailingNavLinks = [{ label: 'GH', href: 'https://example.invalid' }]
    const footerLinks = [{ label: 'F', href: '/f' }]
    const site = defineSite({
      id: 'toolkit',
      seo,
      sitemap: routes,
      header,
      providers: Providers,
      navLinks,
      trailingNavLinks,
      footerLinks,
    })
    expect(site.shell.header).toBe(header)
    expect(site.shell.providers).toBe(Providers)
    expect(site.shell.navLinks).toBe(navLinks)
    expect(site.shell.trailingNavLinks).toBe(trailingNavLinks)
    expect(site.shell.footerLinks).toBe(footerLinks)
  })

  it('passes silentSso through, including the false that means something', () => {
    // `?? true` or `|| true` here would read as a harmless default and would silently
    // re-arm the cold-load SSO probe on a site that opted out — a fully public site that
    // starts bouncing visitors to the central login. Absent must stay absent: the default
    // lives in MarketingRootHtml, which is the one place that says what it is.
    expect(defineSite({ id: 'academy', seo, sitemap: routes }).shell.silentSso).toBeUndefined()
    expect(
      defineSite({ id: 'academy', seo, sitemap: routes, silentSso: false }).shell.silentSso,
    ).toBe(false)
  })
})

describe('siteSitemapRoutes', () => {
  it('resolves a listed sitemap and a computed one the same way', async () => {
    // The point of the helper: app/sitemap.ts must not branch on which kind a site has,
    // because that branch is the per-site difference the config exists to remove.
    const listed = defineSite({ id: 'academy', seo, sitemap: routes })
    expect(await siteSitemapRoutes(listed)).toEqual(routes)

    const sync = defineSite({ id: 'academy', seo, sitemap: () => routes })
    expect(await siteSitemapRoutes(sync)).toEqual(routes)

    const async_ = defineSite({ id: 'research', seo, sitemap: async () => routes })
    expect(await siteSitemapRoutes(async_)).toEqual(routes)
  })

  it('does not call a listed sitemap’s array, or cache a computed one', async () => {
    // No memoisation on purpose. `research`'s function reads the backend on every
    // sitemap render, and its freshness comes from the fetch cache
    // (`{ next: { revalidate: 300 } }` in papers-server.ts) rather than from anything
    // here — a cache at this level would pin the routes for the life of the process and
    // the two would then disagree about how stale the sitemap is allowed to be.
    let calls = 0
    const site = defineSite({
      id: 'research',
      seo,
      sitemap: () => {
        calls += 1
        return routes
      },
    })
    await siteSitemapRoutes(site)
    await siteSitemapRoutes(site)
    expect(calls).toBe(2)
  })
})
