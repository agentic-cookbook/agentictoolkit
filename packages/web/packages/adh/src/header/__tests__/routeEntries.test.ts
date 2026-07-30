import { describe, it, expect } from 'vitest'
//  Relative, like every other test in this directory: the subject is a sibling
//  module of this package, not a dependency of it.
import { buildRouteItems, currentRoutePath, type RouteSection } from '../routeEntries'

describe('currentRoutePath', () => {
  const paths = ['/', '/home', '/home/settings', '/storage']

  it('matches an exact path', () => {
    expect(currentRoutePath(paths, '/storage')).toBe('/storage')
    expect(currentRoutePath(paths, '/home')).toBe('/home')
  })

  it("'/' matches only itself, never as a prefix", () => {
    expect(currentRoutePath(paths, '/')).toBe('/')
    expect(currentRoutePath(paths, '/storage')).toBe('/storage') // not '/'
    expect(currentRoutePath(['/'], '/anything')).toBeNull()
  })

  it('picks the longest path-segment prefix for nested locations', () => {
    expect(currentRoutePath(paths, '/home/settings/profile')).toBe('/home/settings')
    expect(currentRoutePath(paths, '/home/teams')).toBe('/home') // /home/teams unlisted → /home
  })

  it('requires a segment boundary (not a bare string prefix)', () => {
    expect(currentRoutePath(['/store'], '/storage')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(currentRoutePath(paths, '/nope')).toBeNull()
    expect(currentRoutePath([], '/home')).toBeNull()
  })
})

describe('buildRouteItems', () => {
  const sections: RouteSection[] = [
    { label: 'App', routes: [{ path: '/home', description: 'workspace' }, { path: '/', description: 'landing' }] },
    { label: 'Empty', routes: [] },
    { label: 'Auth', routes: [{ path: '/login' }, { path: '/about' }] },
    { label: 'Dynamic', routes: [{ path: '/[slug]', description: 'profile' }] },
  ]

  it('arranges the routes alphabetically by path, across section boundaries', () => {
    const labels = buildRouteItems(sections, '/x').map((i) => i.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    // The navigable routes, in order, span the source sections (App/Auth) merged.
    const navigable = buildRouteItems(sections, '/x')
      .filter((i) => i.href !== undefined)
      .map((i) => i.label)
    expect(navigable).toEqual(['/', '/about', '/home', '/login'])
  })

  it("uses each route's path as the item label, with its description and href", () => {
    const items = buildRouteItems(sections, '/x')
    expect(items.find((i) => i.label === '/')).toMatchObject({
      key: '/',
      label: '/',
      href: '/',
      description: 'landing',
    })
    expect(items.find((i) => i.label === '/home')!.href).toBe('/home')
  })

  it('renders dynamic-segment routes non-navigable (no href) and never current', () => {
    const dyn = buildRouteItems(sections, '/[slug]').find((i) => i.label === '/[slug]')!
    expect(dyn.href).toBeUndefined()
    expect(dyn.current).toBe(false)
  })

  it('marks the current route (and only it)', () => {
    const here = buildRouteItems(sections, '/home')
    expect(here.find((i) => i.label === '/home')?.current).toBe(true)
    expect(here.find((i) => i.label === '/')?.current).toBe(false)
  })

  it('returns an empty list when there are no routes', () => {
    expect(buildRouteItems([{ label: 'X', routes: [] }], '/')).toEqual([])
    expect(buildRouteItems([], '/')).toEqual([])
  })
})
