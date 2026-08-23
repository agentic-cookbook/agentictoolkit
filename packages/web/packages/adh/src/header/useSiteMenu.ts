'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { confirmNavigation } from '@agentic-toolkit/ui/lib/navigation-guard'
import {
  buildSiteHref,
  detectEnv,
  getSite,
  hubFeatureSegment,
  siteWorkspaceHref,
  siteWorkspaceSlug,
  HUB_WORKSPACE_SEGMENTS,
  siteUrl,
  type SiteDef,
  type SiteId,
} from '@agentic-toolkit/adh-registry'
// From `site`, not the registry: which URLs are the hub's workspace is now decided by the first
// segment against the reserved-slug list, which lives there. By the PACKAGE PATH, not
// '../site/hubWorkspacePath': the subpath has its own entry and is listed `external`, so this
// pulls in the word lists alone (`@agentic-toolkit/adh/site`'s barrel also carries `defineSite`)
// and the module stays one copy instead of being inlined into the header bundle as a second.
import { hubWorkspaceSlug, isHubWorkspacePath } from '@agentic-toolkit/adh/site/hubWorkspacePath'
// By the theme-preview SUBPATH, not the `@agentic-toolkit/adh/themes` barrel and not
// '../themes/theme-preview': the subpath has its own entry and is listed `external`, so it
// stays a preserved import in this dist instead of being inlined into the header bundle
// every production page loads — which is what lets the folded gates below leave it
// unreferenced and the bundler drop it. See the chunk-gate contract in adh-registry's deployment-env.
import { appendThemePreview, readPreviewTheme } from '@agentic-toolkit/adh/themes/theme-preview'
import {
  useClientHost,
  type PopoverEntry,
  type PopoverItem,
} from '@agentic-toolkit/adh/header'
import { menuIcon } from './menu-icons'
import { type MenuGroup, type MenuLink } from './SiteMenu'

/** What every consumer of the declarative menu needs to resolve it. */
export type UseSiteMenuOpts = {
  /** Which site this header belongs to — drives in-hub switching + the "current" marker. */
  currentSiteId: SiteId
  /** Transform a cross-site destination href before use (SSO wrap). Injected by the
   *  auth-aware header when signed in; absent ⇒ plain navigation. See SiteMenu's
   *  `resolveHref` for the full contract. */
  resolveHref?: (defaultHref: string) => string
  /** The signed-in user's personal workspace slug, threaded from the auth-aware
   *  header. Used as the in-hub slug fallback on the slug-less workspace routes
   *  (`/home`, `/settings/*`), where there's no slug segment to read — so the
   *  workspace menu resolves its feature links against the user's own slug
   *  instead of degrading to slug-less (broken) links. */
  personalSlug?: string
  /** Whether a user is signed in. Gates the workspace CARRY below: every workspace
   *  route in the family sits behind an auth gate, so a path that merely parses as
   *  one on a signed-out visitor is a public page that happens to share its shape,
   *  and carrying its first segment as a slug would be a guess. */
  authenticated?: boolean
}

/**
 * The shared menu engine: turns a declarative {@link MenuGroup} config into the
 * resolved {@link PopoverEntry} rows (env-aware, SSO-wrapped, `current`-marked) and
 * the navigation handler. Extracted from {@link SiteMenu} as the single source of
 * truth for the switcher's link logic.
 */
export function useSiteMenu(
  groups: MenuGroup[],
  { currentSiteId, resolveHref, personalSlug, authenticated }: UseSiteMenuOpts,
): {
  entries: PopoverEntry[]
  navigate: (item: PopoverItem) => void
  /** The signed-in Home destination, resolved by the same route logic as every
   *  config-driven row. The one row SiteMenu still builds by hand that needs a
   *  resolved href — everything else it renders is either a plain action (Help) or a
   *  {@link MenuGroup} the `entries` above already resolved. */
  homeHref: string
} {
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  // The logged-in APP context: the workspace the visitor is INSIDE right now, on
  // whichever site this header belongs to. NOT the marketing landing `/`. It is the
  // slug the menu carries across a site switch (see hrefFor) and the one the in-hub
  // ROUTE rows are scoped to (see routeHref); null wherever there is no workspace.
  //
  // Two shapes, because the two are known with different confidence:
  //
  //  - The HUB's workspace paths are self-identifying — the first segment is a slug
  //    unless the hub's own route tree has claimed the word (HUB_ROUTE_SEGMENTS) — so
  //    they need no auth signal. Its two slug-less workspace routes (`/home`, which
  //    resolves a workspace and replaces itself, and `/settings`, the account) carry no
  //    slug segment to read, so the signed-in user's personal slug stands in; without it
  //    the feature links resolve slug-less and the `[workspace]` route 404s.
  //  - Every OTHER site puts its workspace where a public page's segment could also
  //    sit (`/<slug>` beside `/details`), so the registry's `siteWorkspaceSlug` reads
  //    it only for a signed-in visitor — see UseSiteMenuOpts.authenticated.
  const currentSite = getSite(currentSiteId)
  const workspaceSlug = useMemo(() => {
    if (currentSiteId === 'hub')
      return isHubWorkspacePath(pathname) ? (hubWorkspaceSlug(pathname) ?? personalSlug ?? null) : null
    return currentSite && authenticated ? siteWorkspaceSlug(currentSite, pathname) : null
  }, [currentSiteId, currentSite, pathname, personalSlug, authenticated])

  // The destination host depends on the current hostname (client-only): null until
  // mount, then the real host. No hydration mismatch — the menu's links aren't in
  // the server HTML at all (closed dropdown / unmounted drawer), and by the time the
  // user opens it the host has resolved.
  const hostname = useClientHost()
  const currentEnv = useMemo(() => (hostname ? detectEnv(hostname) : null), [hostname])
  // The theme to carry across a cross-site hop, resolved ONCE per render (not per link —
  // reading it costs a DOM query plus a cookie parse) — null in production / SSR.
  //
  // Carrying a previewed theme between sites is a dev-build affordance, and this hook runs on
  // every page of every site, so both halves sit behind the build gate: folded to false, the
  // resolution is `null`, `carryTheme` is the identity function, and neither theme-preview
  // helper is referenced — so the switcher's client code stays out of the one bundle every
  // production page loads. (Behaviour was already correct without the fold: with no alt-theme
  // <style> nodes emitted, readPreviewTheme returns null in production and appendThemePreview
  // passes the href through untouched. This is about the code, not the result.)
  //
  // Comparisons written out rather than `DEV_BUILD` because these are BUNDLE gates: webpack
  // folds them while parsing and skips the branch, which is what leaves the import above
  // unreferenced. `DEV_BUILD` here would be a runtime boolean and ship both helpers. See the
  // chunk-gate contract in adh-registry's deployment-env.
  const previewTheme =
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' ||
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' ||
    process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'
      ? readPreviewTheme()
      : null
  const carryTheme = useCallback(
    (href: string): string =>
      process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' ||
      process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' ||
      process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'
        ? appendThemePreview(href, previewTheme)
        : href,
    [previewTheme],
  )

  const hrefFor = useCallback(
    (site: SiteDef, external?: boolean): string => {
      // Carry the workspace: switching sites from inside one lands in the SAME
      // workspace on the site you picked, at THAT site's own workspace route —
      // `/<slug>`, `/home/<slug>` or `/<slug>/home`, per its shape (siteWorkspaceHref).
      // This menu is a cross-site navigator: the destination is the target site's
      // workspace, never the hub's in-house view of it. undefined when there is no
      // workspace to carry, or when the target has none of its own (Docs, Community, …),
      // and then the plain path below applies. `external` links (the dev site-family
      // submenus) opt out — they always want the target's landing.
      const workspacePath =
        workspaceSlug && !external ? siteWorkspaceHref(site, workspaceSlug) : undefined
      // The site we're already on: a bare same-origin path either way.
      if (site.id === currentSiteId) return workspacePath ?? '/'
      // Signed in, on the hub, inside a workspace: the target site's implementation is a ROUTE
      // here — the hub mounts that site's own home model at `/<slug>/<segment>`, so the row can
      // change the route instead of the origin. Same pane, same data, no page load, and the
      // workspace the visitor is in comes along by construction rather than by carry.
      //
      // Everything below is skipped deliberately, not by omission: `siteUrl` (there is no other
      // origin), the SSO wrap (`resolveHref` exists to establish a session at a destination that
      // has none — this destination is the session) and the theme carry (a preview lives in this
      // document's own <style> nodes and cookie; a client-side route change never leaves them).
      //
      // Ordered AFTER the same-site return so the hub's own row keeps giving `/<slug>` rather
      // than a segment for itself, and BEFORE the `hostname` guard because a same-origin path
      // needs no host at all.
      //
      // `external` rows (the dev site-family submenus) opt out with the same reasoning as the
      // workspace carry above: that menu means "open this site", and answering it with a hub
      // route would leave no way to reach the site at all.
      if (currentSiteId === 'hub' && authenticated && workspaceSlug && !external) {
        const segment = hubFeatureSegment(site.id)
        if (segment) return `/${workspaceSlug}/${segment}`
      }
      if (!hostname) return '#'
      // Tag the destination with the previewed theme BEFORE the SSO wrap below, so it
      // survives in resolveHref's encoded `return` param (a no-op in prod / non-http).
      //
      // A carried workspace is an EXACT destination and goes through siteUrl, not
      // buildSiteHref: that one route-MATCHES, mapping everything but `/home*` onto the
      // target's landing, so `/acme` would arrive as `/`. Without one, route matching is
      // exactly right — and `external` links (the dev site-family submenus) open the
      // target's LANDING rather than carrying the current route, because the debug menu
      // is "jump to this site", not "switch to the same area on this site".
      const href = carryTheme(
        workspacePath
          ? siteUrl(site.id, workspacePath, hostname)
          : buildSiteHref(site, hostname, external ? '/' : pathname),
      )
      if (!resolveHref) return href
      // Only route the switch through silent SSO when the destination is in the SAME
      // environment as the current site (see SiteMenu for the full rationale): each
      // env's AS only allow-lists its own origins, so wrapping a cross-ENV hop would
      // bounce the user to that AS's login page instead of the destination. The local
      // suite is an env like any other here — it has a real AS (the shared adh-auth
      // service) that allow-lists `https://*.dev.local`, so its hops wrap too.
      try {
        return detectEnv(new URL(href).hostname) === currentEnv ? resolveHref(href) : href
      } catch {
        return href
      }
    },
    [
      workspaceSlug,
      hostname,
      currentSiteId,
      authenticated,
      pathname,
      resolveHref,
      currentEnv,
      carryTheme,
    ],
  )

  // Resolve a hub-workspace ROUTE link to its href: a same-origin path on the hub
  // itself; a cross-site link to the hub (theme-carried + SSO-wrapped under the same
  // same-env guard as hrefFor) as a fallback elsewhere.
  const routeHref = useCallback(
    (route: string): string => {
      // On a hub workspace route, feature ROUTE links (e.g. `/ecosystems`) are
      // workspace-relative under the active slug → `/<slug>/ecosystems`. Only prefix
      // when the route's FIRST segment is a recognized hub workspace segment (the
      // shared SSoT set, incl. `home`); any other hub route (e.g. a top-level page)
      // stays as-is rather than being mis-prefixed with the active slug.
      if (currentSiteId === 'hub') {
        const seg = route.split('/').filter(Boolean)[0]
        // Off a workspace path (the hub apex `/`, a slug-less route) there's no active
        // slug, so fall back to the signed-in user's personal slug — otherwise these
        // now-shared authed rows resolve slug-less (`/ecosystems`) and the `[workspace]`
        // route treats the segment as a workspace slug and 404s.
        const slug = workspaceSlug ?? personalSlug
        return slug && seg != null && HUB_WORKSPACE_SEGMENTS.has(seg)
          ? `/${slug}${route}`
          : route
      }
      if (!hostname) return '#'
      // Cross-site hub-route link: carry the theme before the SSO wrap, exactly as
      // hrefFor does.
      const href = carryTheme(siteUrl('hub', route, hostname))
      if (!resolveHref) return href
      try {
        return detectEnv(new URL(href).hostname) === currentEnv ? resolveHref(href) : href
      } catch {
        return href
      }
    },
    [currentSiteId, workspaceSlug, personalSlug, hostname, resolveHref, currentEnv, carryTheme],
  )

  // Resolve the declarative config into the engine's rows: the href computed ONCE per
  // row here (hrefFor/routeHref parse URLs + run detectEnv) rather than per row on
  // every keystroke/highlight move, with labels/taglines applied and `current` marked.
  const entries = useMemo<PopoverEntry[]>(() => {
    const path = pathname || '/'
    const toItem = (link: MenuLink): PopoverItem | null => {
      if ('route' in link) {
        // The resolved href is the workspace-relative path on the hub (`/<slug>/…`),
        // so `current` is matched against it — never the bare config segment. A
        // cross-site href ('#' or an absolute URL) never starts with '/', so it's
        // never marked current. The icon comes from the single source of truth
        // (menu-icons), keyed by the route path.
        const href = routeHref(link.route)
        return {
          key: `route:${link.route}`,
          label: link.label,
          description: link.description,
          href,
          icon: menuIcon(link.route),
          current: href.startsWith('/') && !href.startsWith('//') && (path === href || path.startsWith(`${href}/`)),
        }
      }
      if ('href' in link) {
        // A destination with no registry site: the href is used verbatim. Neither the
        // SSO wrap nor `current` is skipped here — neither one HAS an answer for a host
        // the registry has never heard of. `ssoReturnOrigins` is derived from SITES, so
        // wrapping this href would hand the authorization server a return origin it does
        // not allow-list and bounce the visitor to a login page instead of the link they
        // clicked; and `current` asks whether the visitor is on this site, which is a
        // question about a deployment there isn't one of. See MenuLink's `href` variant.
        return {
          key: `href:${link.href}`,
          label: link.label,
          description: link.description,
          href: link.href,
          icon: menuIcon(link.iconKey),
        }
      }
      const site = getSite(link.site)
      if (!site) return null
      // Icon from the single source of truth (menu-icons), keyed by the site id.
      return {
        key: site.id,
        label: link.label ?? site.label,
        description: link.description ?? site.description,
        href: hrefFor(site, link.external),
        icon: menuIcon(site.id),
        current: site.id === currentSiteId,
      }
    }
    const out: PopoverEntry[] = []
    for (const g of groups) {
      if (g.kind === 'topic') {
        const items = g.links.map(toItem).filter((r): r is PopoverItem => r !== null)
        // The trigger's OWN destination, when the topic has one — resolved through the
        // same toItem as its children, so a topic that IS a site cannot resolve its
        // href, tagline or `current` by a different rule than the row for that same
        // site elsewhere in the menu. Null for a grouping header (Plan, Build), which
        // leaves `href` undefined and the trigger a pure disclosure.
        const self = g.link ? toItem(g.link) : null
        // Kept when it has children OR somewhere of its own to go. A topic whose
        // children all failed to resolve is still a destination if it names one, and
        // dropping it would delete a site from the menu because a row UNDER it named
        // something the registry no longer has.
        if (items.length || self)
          out.push({
            kind: 'topic',
            section: g.section,
            label: g.label,
            items,
            href: self?.href,
            description: g.description ?? self?.description,
            icon: menuIcon(g.iconKey) ?? self?.icon,
            current: self?.current,
          })
      } else {
        const item = toItem(g.link)
        // Both leaf + inline resolve to a leaf entry; `inline` marks it indented
        // (an always-visible sub-item under the row above it).
        if (item)
          out.push({
            kind: 'leaf',
            section: g.section,
            blurb: g.blurb ?? false,
            indent: g.kind === 'inline',
            item,
          })
      }
    }
    return out
  }, [groups, pathname, routeHref, hrefFor, currentSiteId])

  // Navigate a chosen row. Same-origin destinations (a leading "/", i.e. in-hub
  // workspace routes + the current site's own "/") go through the Next router so the
  // header re-renders against the new path instantly, with no full reload; cross-site
  // absolute URLs keep the full-page assign. "#" (host not yet resolved) is a no-op.
  // First clears any active navigation guard (e.g. an UnsavedChangesGuard on the
  // current page) — a menu jump is a programmatic nav no anchor-click interceptor
  // sees, so it must consult the registry itself; with no guard mounted this
  // resolves true synchronously and costs nothing.
  const navigate = useCallback(
    (item: PopoverItem): void => {
      const href = item.href
      if (!href || href === '#') return
      void confirmNavigation().then((ok) => {
        if (!ok) return
        if (href.startsWith('/') && !href.startsWith('//')) {
          router.push(href)
          return
        }
        window.location.assign(href)
      })
    },
    [router],
  )

  // The signed-in "Home" destination for the auth top section: `/home`, resolved with the same
  // in-hub/cross-site logic as every other route link (on the hub → `/home` verbatim; a satellite
  // → the hub's `/home`, SSO-wrapped). It stays `/home` on the hub rather than being prefixed to
  // the active slug, because `/home` is precisely the family's "take me to my workspace" URL:
  // it resolves the stored preference and replaces itself with `/<workspace>`. `home` left
  // HUB_WORKSPACE_SEGMENTS for that reason, so routeHref no longer prefixes it.
  const homeHref = routeHref('/home')

  return { entries, navigate, homeHref }
}
