'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { confirmNavigation } from '@agentic-toolkit/ui/lib/navigation-guard'
import {
  buildSiteHref,
  detectEnv,
  getSite,
  hubSwitchHref,
  hubWorkspaceSlug,
  isHubWorkspacePath,
  HUB_WORKSPACE_SEGMENTS,
  siteUrl,
  type SiteDef,
  type SiteId,
} from '@agentic-toolkit/adh-registry'
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
   *  header. Used as the in-hub slug fallback on the slug-less workspace shell
   *  routes (`/home`, `/home/settings`, …), where there's no slug segment to read —
   *  so the workspace menu resolves its feature links against the user's own slug
   *  instead of degrading to slug-less (broken) links. */
  personalSlug?: string
}

/**
 * The shared menu engine: turns a declarative {@link MenuGroup} config into the
 * resolved {@link PopoverEntry} rows (env-aware, SSO-wrapped, `current`-marked) and
 * the navigation handler. Extracted from {@link SiteMenu} as the single source of
 * truth for the switcher's link logic.
 */
export function useSiteMenu(
  groups: MenuGroup[],
  { currentSiteId, resolveHref, personalSlug }: UseSiteMenuOpts,
): { entries: PopoverEntry[]; navigate: (item: PopoverItem) => void; homeHref: string } {
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  // The logged-in APP context: a workspace route on the hub — `/<slug>/home` or a
  // feature route like `/<slug>/ecosystems`. NOT the marketing landing `/`. The
  // active workspace SLUG (first path segment) is derived once here and threaded
  // into the in-hub hrefs below; null off a workspace route (or off the hub). On the
  // slug-less workspace shell routes (`/home`, `/home/settings`, …) there's no slug
  // segment, so fall back to the signed-in user's personal slug — keeping the in-hub
  // menu with working feature links rather than slug-less ones.
  const workspaceSlug =
    currentSiteId === 'hub' && isHubWorkspacePath(pathname)
      ? (hubWorkspaceSlug(pathname) ?? personalSlug ?? null)
      : null

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
      // In-hub mode: on a workspace route, switch to the target's workspace route on
      // the hub, scoped to the ACTIVE slug (same origin, same tab), when it has one.
      // Targets without a workspace route (Docs, Cookbook, …) and every other context
      // keep the cross-site path. `external` links (the dev site-family submenus) opt
      // out — they always want the actual site deployment, never the in-hub view.
      if (workspaceSlug && !external) {
        if (site.id === 'hub') return `/${workspaceSlug}/home`
        const hubRoute = hubSwitchHref(workspaceSlug, site)
        if (hubRoute) return hubRoute
      }
      if (site.id === currentSiteId) return '/'
      if (!hostname) return '#'
      // `external` links (the dev site-family submenus) open the target's LANDING
      // rather than carrying the current route — the debug menu is "jump to this
      // site", not "switch to the same area on this site" (which /home-carries).
      const carriedPath = external ? '/' : pathname
      // Tag the destination with the previewed theme BEFORE the SSO wrap below, so it
      // survives in resolveHref's encoded `return` param (a no-op in prod / non-http).
      const href = carryTheme(buildSiteHref(site, hostname, carriedPath))
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
    [workspaceSlug, hostname, currentSiteId, pathname, resolveHref, currentEnv, carryTheme],
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
        // Off a workspace path (the hub apex `/`, a slug-less shell) there's no active
        // slug, so fall back to the signed-in user's personal slug — otherwise these
        // now-shared authed rows resolve slug-less (`/ecosystems`) and the `[slug]`
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
        if (items.length) out.push({ kind: 'topic', section: g.section, label: g.label, items })
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

  // The signed-in "Home" destination for the auth top section: the user's workspace
  // home, resolved with the same in-hub/cross-site logic as every other route link
  // (on the hub → `/<slug>/home`; a satellite → the hub's `/home`, SSO-wrapped).
  const homeHref = routeHref('/home')

  return { entries, navigate, homeHref }
}
