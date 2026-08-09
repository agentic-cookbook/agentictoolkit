'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Bug } from 'lucide-react'
import { detectEnv, type SiteId } from '@agentic-toolkit/adh-registry'
import {
  NavigationPopover,
  useClientHost,
  type PopoverEntry,
  type RouteSection,
} from '@agentic-toolkit/adh/header'
import { useSiteMenu } from './useSiteMenu'
import { buildDebugSiteGroups } from './debugSiteGroups'
import { buildDevToolsEntries, DEV_TOOLS_BUILD_ENABLED } from './devToolsEntries'
import { useEffectiveEnv, useEnvOverride } from './envOverride'

// ─────────────────────────────────────────────────────────────────────────────
// The header's dev-tools dropdown: a bug-glyph trigger beside the site menu,
// holding everything that exists only for developers — the Marketing/Main site
// family flyouts, this site's Routes, and the Debug console opener.
//
// It is a SEPARATE menu on purpose. All four of these rows used to be appended
// to the tail of {@link SiteMenu}, which meant the site menu had one shape in a
// dev build and a shorter one in production — the family launcher every visitor
// uses could not be reasoned about, demoed or tested without first asking which
// build it was. Moving them here leaves SiteMenu with no build-time or admin
// gate at all: what ships is what a developer sees. This menu is the only thing
// that appears or disappears, and it is wholly absent unless unlocked.
//
// Named for the vocabulary the gating already uses (devToolsEntries,
// DEV_TOOLS_BUILD_ENABLED) rather than "DebugMenu", which this package spends on
// a different component — the viewport-pinned theme popup at
// `@agentic-toolkit/adh/debug`. Same reason SiteMenuSwitcher is not SiteSwitcher.

// Code-split: its own chunk via the package subpath, fetched only once the user
// actually opens the console. Unconditional (no build gate) because a signed-in
// adh admin can open the console in ANY env, production included — the chunk must
// exist in every build. Laziness, not DCE, is what keeps it off the wire for
// ordinary visitors: nothing fetches it until the Debug Options row is used, and
// that row only renders inside the unlock below.
const DebugConsoleWindow = dynamic(() =>
  import('@agentic-toolkit/adh/debug-console').then((m) => m.DebugConsoleWindow),
)

export type DevToolsMenuProps = {
  /** Which site this header belongs to — marks the "current" row in the site-family
   *  flyouts, and selects whose routes the Routes flyout lists. */
  currentSiteId: SiteId
  /** Transform a cross-site destination href before use (SSO wrap), exactly as
   *  {@link SiteMenu} takes it — so a jump to a sibling site's build lands already
   *  signed in. Absent ⇒ plain navigation. */
  resolveHref?: (defaultHref: string) => string
  /** The signed-in user's personal workspace slug, forwarded to {@link useSiteMenu}
   *  as the in-hub slug fallback on the slug-less workspace shell routes. */
  personalSlug?: string
  /** Curated route map for the "Routes" flyout. When a site passes none, the flyout
   *  falls back to the generated per-site route map
   *  (`@agentic-toolkit/adh-registry/routes`), loaded lazily once this menu mounts. */
  routes?: RouteSection[]
  /** The signed-in user holds the adh `admin` capability. Unlocks this menu in EVERY
   *  env, production included. A display courtesy, not a security boundary —
   *  everything it reveals (site lists, route paths, the debug console) ships in the
   *  client bundle for anyone to read; the backend enforces real authorization. */
  userIsAdmin?: boolean
}

/**
 * The dev-tools dropdown, or nothing at all.
 *
 * The single unlock: every visitor in a dev-env build, OR a signed-in adh admin in
 * ANY env — production included. The admin leg is a runtime condition, so the code
 * below ships in production bundles; it stays invisible and unfetched for non-admins.
 *
 * The gate is a wrapper around {@link DevToolsMenuPopover} rather than an early
 * return inside it because `userIsAdmin` resolves ASYNCHRONOUSLY (the auth source
 * settles after first paint). An early return past this component's hooks would
 * change the hook count on that flip; mounting a child whole does not. It also keeps
 * the popover's work — resolving a cross-site href for every site in the family —
 * off every render of every page for the visitors who will never see the menu.
 */
export function DevToolsMenu({ userIsAdmin, ...rest }: DevToolsMenuProps): ReactElement | null {
  const unlocked = DEV_TOOLS_BUILD_ENABLED || userIsAdmin === true
  if (!unlocked) return null
  return <DevToolsMenuPopover {...rest} adminUnlocked={userIsAdmin === true} />
}

type DevToolsMenuPopoverProps = Omit<DevToolsMenuProps, 'userIsAdmin'> & {
  /** `userIsAdmin`, renamed at the boundary: inside the popover the flag no longer
   *  answers "may this menu exist" (it is mounted, so it may) but the narrower
   *  "does this row bypass its env gate" — which is what buildDevToolsEntries calls it. */
  adminUnlocked: boolean
}

function DevToolsMenuPopover({
  currentSiteId,
  resolveHref,
  personalSlug,
  routes,
  adminUnlocked,
}: DevToolsMenuPopoverProps): ReactElement {
  const pathname = usePathname() ?? '/'

  // The two site-family flyouts ("Marketing sites" / "Main sites") as pure registry
  // data, resolved into env-aware, SSO-wrapped rows by the same engine that drives
  // the site menu. Memoized for stable identity so useSiteMenu's `entries` memo
  // doesn't re-derive every render.
  const groups = useMemo(() => buildDebugSiteGroups(), [])
  const { entries, navigate } = useSiteMenu(groups, { currentSiteId, resolveHref, personalSlug })

  // The Routes flyout's data: the site's curated `routes` prop when it passed one,
  // else the generated per-site route map — its own lazy chunk (package subpath,
  // like the debug console) fetched only once this menu mounts, so an ordinary
  // production visitor never downloads the family's route inventory.
  // Tagged with the site it was loaded for, so a resolved import can never render
  // a *different* site's routes: today the header remounts on any cross-site change
  // (each site is its own app), but tying the data to `currentSiteId` makes that
  // correct by construction rather than by that implicit invariant.
  const [generated, setGenerated] = useState<{ siteId: SiteId; sections: RouteSection[] }>()
  const wantGeneratedRoutes = !(routes && routes.length > 0)
  useEffect(() => {
    if (!wantGeneratedRoutes) return
    let cancelled = false
    void import('@agentic-toolkit/adh-registry/routes').then(({ SITE_ROUTES }) => {
      if (cancelled) return
      const paths = SITE_ROUTES[currentSiteId]
      setGenerated({
        siteId: currentSiteId,
        sections: paths?.length ? [{ label: 'Site', routes: paths.map((path) => ({ path })) }] : [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [wantGeneratedRoutes, currentSiteId])
  // Only trust the loaded map when it matches the site we're rendering.
  const generatedRoutes =
    generated && generated.siteId === currentSiteId ? generated.sections : undefined
  const effectiveRoutes = routes && routes.length > 0 ? routes : generatedRoutes

  // Routes + Debug Options. The gating logic is the pure buildDevToolsEntries (see
  // devToolsEntries.ts — it explains the deliberate effective-vs-real env split, and
  // the admin bypass of both); everything here is just the wiring. Those env reads
  // survive the move out of the site menu: they are what keeps a developer previewing
  // production from seeing Routes, while leaving Debug Options reachable so the
  // simulation can always be undone.
  const host = useClientHost()
  const effectiveEnv = useEffectiveEnv(host)
  const realEnv = host ? detectEnv(host) : null
  const override = useEnvOverride()
  const [debugOpen, setDebugOpen] = useState(false)
  const devToolsSection = useMemo<PopoverEntry[]>(
    () =>
      buildDevToolsEntries({
        routes: effectiveRoutes,
        effectiveEnv,
        realEnv,
        adminUnlocked,
        override,
        pathname,
        onOpenDebug: () => setDebugOpen(true),
      }),
    [effectiveRoutes, effectiveEnv, realEnv, adminUnlocked, override, pathname],
  )

  // One contiguous run, in the order they carried in the site menu's tail: the two
  // site-family flyouts, then this site's Routes, then Debug Options. Everything
  // shares DEBUG_SECTION, so no divider splits them.
  const allEntries = useMemo<PopoverEntry[]>(
    () => [...entries, ...devToolsSection],
    [entries, devToolsSection],
  )

  return (
    <>
      <NavigationPopover
        entries={allEntries}
        onChoose={navigate}
        // Icon-only: the bar's room belongs to the site's own brand and nav, and this
        // trigger is for the people who already know what the bug means. `triggerLabel`
        // is the button's aria-label, so the accessible name is a word either way.
        triggerLabel="Debug tools"
        triggerContent={<Bug className="adh-nav-popover__mark" aria-hidden />}
        triggerClassName="adh-nav-popover__trigger--icon"
        placeholder="Search sites, routes and tools"
        emptyLabel="No matching dev tools"
      />
      {/* Portals to document.body (see FloatingWindow), so its position here is
          irrelevant to where it renders — this is just the one owning chokepoint
          for the dynamic import + open state, driven by the "Debug Options" row
          above. Mounted only once opened, so the chunk isn't fetched on every dev
          page load. */}
      {debugOpen && <DebugConsoleWindow open onClose={() => setDebugOpen(false)} />}
    </>
  )
}
