import type { PopoverItem } from './NavigationPopover'

/** One route in a {@link RouteSection}: its relative path from the site root, and
 *  an optional human description shown beside the path. */
export type RouteDef = { path: string; description?: string }

/** A named group of routes (e.g. "Features", "Auth"). The grouping only organizes
 *  the hand-maintained source list — the dev Routes menu flattens every section
 *  into ONE alphabetical list of paths, so the label is not rendered. */
export type RouteSection = { label: string; routes: RouteDef[] }

/** A dynamic-segment path (contains `[param]`/`[[...x]]`) — not a single
 *  navigable destination, so it's listed but rendered non-navigable. */
function isDynamicPath(path: string): boolean {
  return path.includes('[')
}

/**
 * The listed route the user is currently "on": the longest navigable path that
 * is `pathname` exactly, or a path-segment prefix of it (so `/home/settings`
 * lights up on `/home/settings/profile`). `/` only matches `/` exactly, never as
 * a prefix (else it would claim every path). Returns the single best match, or
 * null — so at most one row is marked current.
 */
export function currentRoutePath(navigablePaths: string[], pathname: string): string | null {
  let best: string | null = null
  for (const path of navigablePaths) {
    const matches = path === pathname || (path !== '/' && pathname.startsWith(`${path}/`))
    if (matches && (best === null || path.length > best.length)) best = path
  }
  return best
}

/**
 * Flatten every section's routes into ONE alphabetically-sorted list of
 * {@link PopoverItem} rows — each row's label its relative path. Dynamic-segment
 * routes get no href (non-navigable); the current route is marked via
 * {@link currentRoutePath}. Pure (no hooks/DOM) so it can be unit-tested.
 */
export function buildRouteItems(sections: RouteSection[], pathname: string): PopoverItem[] {
  const routes = sections.flatMap((section) => section.routes)
  const current = currentRoutePath(
    routes.filter((route) => !isDynamicPath(route.path)).map((route) => route.path),
    pathname,
  )
  return routes
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((route): PopoverItem => {
      const navigable = !isDynamicPath(route.path)
      return {
        key: route.path,
        label: route.path,
        description: route.description,
        href: navigable ? route.path : undefined,
        current: navigable && route.path === current,
      }
    })
}
