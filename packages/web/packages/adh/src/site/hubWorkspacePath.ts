import { reservedWorkspaceSlugs } from './reservedSlugs'

/**
 * The hub's two workspace routes that carry NO slug.
 *
 * `/home` is the redirect that resolves one — the family's signal, identical on all 38 sites.
 * `/settings` is the account (not a workspace): it used to be `/home/settings` and moved off
 * when `/home` stopped being a page. Both are signed-in surfaces, so the switcher stays in its
 * in-hub mode there; `useSiteMenu` fills the slug the feature links need from the signed-in
 * user's own (`personalSlug`), which is what those links pointed at anyway.
 */
const SLUGLESS_APP_SEGMENTS: ReadonlySet<string> = new Set(['home', 'settings'])

/** Built once, on first ask: `reservedWorkspaceSlugs()` allocates, and these run per render. */
let reserved: ReadonlySet<string> | null = null

/** Is this first path segment one the site's own routes have spoken for? */
function isRouteSegment(segment: string): boolean {
  reserved ??= reservedWorkspaceSlugs()
  return reserved.has(segment.toLowerCase())
}

/** The first path segment of `pathname`, or undefined at the root. */
function firstSegment(pathname: string): string | undefined {
  return (pathname || '/').split('/').filter(Boolean)[0]
}

/**
 * True when `pathname` is inside the hub's authenticated workspace — `/<workspace>` or anything
 * under it — or on one of the two slug-less app routes above. Drives the switcher's in-hub mode;
 * only meaningful on the hub itself.
 *
 * ONE segment decides it, and that is the route convergence's doing. The hub's root used to be
 * `[slug]`, a public user profile, with the workspace hanging off it at `/<slug>/home` — so the
 * only way to tell a workspace URL from a profile was to look at the SECOND segment and ask
 * whether it named a known feature. The root is `[workspace]` now and nothing else is dynamic
 * there, so everything under a first segment that is not one of the site's own routes is the
 * workspace tree by construction. `/acme/about` is a 404 INSIDE that tree, and the second-segment
 * test called it marketing.
 *
 * Reading the reserved list rather than a list of the hub's static routes is deliberate: it is
 * the same authority the slug MINT forms consult, so a word in it can never be anyone's workspace
 * slug, and `frontend/tools/verify_reserved_route_slugs.py` fails if a route directory or a
 * `redirects` source anywhere in the family is missing from it. A second hand-written list of the
 * hub's first segments would be the drift this whole shape exists to remove — and it is the
 * dangerous direction: a segment missing from it reads as a workspace, which is how
 * `/features/projects` (a marketing page whose id collides with a feature segment) wore the
 * signed-in menu the moment those pages moved under a prefix.
 *
 * It answers TRUE for a slug that resolves to nothing — `/typo` is a workspace address whose
 * workspace the caller is not in, and it renders the shared not-found. That is not the
 * "test by exclusion" trap: the claim here is about what the URL ADDRESSES, not about a route
 * existing, and the family's rule is that the root segment addresses a principal. A page that
 * needs to know whether the workspace resolves asks the workspace list, which is what the route's
 * own gate does.
 */
export function isHubWorkspacePath(pathname: string): boolean {
  const first = firstSegment(pathname)
  if (first === undefined) return false
  return SLUGLESS_APP_SEGMENTS.has(first) || !isRouteSegment(first)
}

/**
 * The workspace slug `pathname` addresses, or null when it addresses none.
 *
 * Null on the slug-less pair above as well as off the workspace entirely, and that is the whole
 * distinction {@link isHubWorkspacePath} does not draw: `/home` and `/settings` ARE workspace
 * chrome, they just carry no slug, so the caller falls back to the signed-in user's own.
 */
export function hubWorkspaceSlug(pathname: string): string | null {
  const first = firstSegment(pathname)
  return first !== undefined && !isRouteSegment(first) ? first : null
}
