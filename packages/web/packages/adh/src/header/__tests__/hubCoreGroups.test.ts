import { describe, it, expect } from 'vitest'
import { hubCoreGroups } from '../hubCoreGroups'
import { type MenuGroup } from '../SiteMenu'

// The shared Hub core config (recipe test vectors T1, T3, T4): the Hub leaf + its
// always-shown inline sub-items, plus the in-hub route rows that are signed-in only.

const inlineSites = (g: MenuGroup[]): string[] =>
  g.filter((x) => x.kind === 'inline' && 'site' in x.link).map((x) => (x as { link: { site: string } }).link.site)
const inlineRoutes = (g: MenuGroup[]): string[] =>
  g.filter((x) => x.kind === 'inline' && 'route' in x.link).map((x) => (x as { link: { route: string } }).link.route)

describe('hubCoreGroups', () => {
  it('opens with the Hub leaf, then the always-shown inline sub-items in order (T4)', () => {
    const g = hubCoreGroups(false)
    expect(g[0]).toMatchObject({ kind: 'leaf', link: { site: 'hub' } })
    expect(inlineSites(g)).toEqual([
      'bitbag',
      'community',
      'personaregistry',
      'toolkit',
      'cookbook',
      'devteam',
      'myagenticteams',
      'narratives',
      'hub-help',
    ])
  })

  it('hides the in-hub route rows (and News) when logged out; shows them when authed (T3)', () => {
    const out = hubCoreGroups(false)
    const authed = hubCoreGroups(true)
    expect(inlineRoutes(out)).toEqual([])
    expect(inlineRoutes(authed)).toEqual(['/products', '/personas', '/organizations', '/research'])
    expect(inlineSites(out)).not.toContain('news')
    expect(inlineSites(authed)).toContain('news')
  })

  it('has no "Reference" (docs/api/mcp) topic group in either state (T1)', () => {
    for (const authed of [false, true]) {
      for (const g of hubCoreGroups(authed)) {
        if (g.kind === 'topic') expect(g.label).not.toBe('Reference')
      }
    }
  })
})
