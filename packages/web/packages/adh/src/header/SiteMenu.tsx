'use client'

import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CircleHelp, Settings } from 'lucide-react'
// Sibling module, not the '@agentic-toolkit/adh/footer' subpath: a self-referencing package
// specifier would make tsup inline the whole footer entry into this header entry.
import { SITES_OVERVIEW_POPOVER_ID } from '../footer/SitesOverview'
import { detectEnv, getSite, siteHeaderTitle, type SiteId } from '@agentic-toolkit/adh-registry'
import {
  HubMark,
  NavigationPopover,
  useClientHost,
  useWorkspacesMenu,
  type PopoverEntry,
  type PopoverItem,
  type RouteSection,
} from '@agentic-toolkit/adh/header'
// PRESERVED IMPORT — the recents store's own subpath, never the barrel and never a
// relative path. `recents.ts` holds module-level mutable state (`snapshot`, the
// `listeners` Set); reaching it any other way risks a second copy in this bundle, so
// a visit recorded by the hub's recorder would be invisible to this subscriber. See
// the matching `external` entries in both tsup configs.
import { useRecents } from '@agentic-toolkit/adh/header/recents'
import { useSiteMenu } from './useSiteMenu'
import { useHeaderLinksCollapsed } from './useHeaderLinksCollapsed'
import { buildSiteNavEntries } from './siteNavEntries'
import { type NavLink } from './NavLink'
import { buildDebugSiteGroups } from './debugSiteGroups'
import { buildDevToolsEntries, DEV_TOOLS_BUILD_ENABLED } from './devToolsEntries'
import { useEffectiveEnv, useEnvOverride } from './envOverride'
import { menuIcon } from './menu-icons'
import { buildBelowHelpEntries, siteDetailsHref } from './belowHelpEntries'
// Package path (the external help entry) so no bundling cost — this pulls only the light
// HelpContext hook, never the code-split window. Safe no-op outside a HelpProvider.
//
// The help subtree lives in @agentic-toolkit/adh (Task 5.5 ported it there from
// the pre-rename @adh-shared/adh, which is how this package briefly depended on the husk).
// Nothing
// temporary remains: the specifier stays a package path, kept out of this bundle by the
// `'@agentic-toolkit/adh/*'` wildcard in tsup.config.ts's `external` — not spelled out
// individually, because that list names only modules holding module-level MUTABLE state
// (see `header/recents` above). This is a React context, and the wildcard is enough to
// keep it a single HelpContext shared with whichever AppShell mounted the provider.
import { useHelp } from '@agentic-toolkit/adh/help'

// Code-split: its own chunk via the package subpath, fetched only once the user
// actually opens the console. Unconditional (no build gate) because a signed-in
// adh admin can open the console in ANY env, production included — the chunk must
// exist in every build. Laziness, not DCE, is what keeps it off the wire for
// ordinary visitors: nothing fetches it until the Debug Options row is used, and
// that row only renders behind the dev-env / admin unlock below.
const DebugConsoleWindow = dynamic(() =>
  import('@agentic-toolkit/adh/debug-console').then((m) => m.DebugConsoleWindow),
)

// ─────────────────────────────────────────────────────────────────────────────
// Declarative config types. A config-only subclass (MarketingSiteMenu /
// WorkspaceSiteMenu) supplies a `MenuGroup[]`; this base turns it into the
// resolved {@link PopoverEntry} rows the engine renders. The subclass declares
// WHAT is in the menu; this base owns HOW each destination link is formed (per
// DEPLOYMENT_ENV), how the trigger reads, and how a chosen row navigates.
//
// A link is either a registry SITE (`site`, resolved via hrefFor — cross-site or
// in-hub, env-aware, SSO-wrapped) or a hub ROUTE (`route`, resolved via routeHref).
// `label`/`description` override the registry defaults. `section` groups rows for
// dividers (a divider falls between sections, never within one).
//
// `external` forces a SITE link to its cross-site deployment URL even from an
// in-hub workspace route (where a plain `site` link would resolve to the target's
// `/<slug>/<feature>` workspace view instead). Used by the dev site-family
// submenus, whose whole purpose is to open the actual site build — never an
// in-hub route. See useSiteMenu's hrefFor.
export type MenuLink =
  | { site: SiteId; label?: string; description?: string; external?: boolean }
  | { route: string; label: string; description?: string }
export type MenuGroup =
  // A promoted top-level link row (with an optional inline description via `blurb`).
  | { kind: 'leaf'; section: number; blurb?: boolean; link: MenuLink }
  // An always-visible link row INDENTED under the row above it (an inline sub-item,
  // e.g. Hub's ecosystem sites). Renders like a leaf but nested; not a flyout.
  | { kind: 'inline'; section: number; blurb?: boolean; link: MenuLink }
  // A row that opens a cascading flyout submenu of its `links`.
  | { kind: 'topic'; section: number; label: string; links: MenuLink[] }

/** The header-chrome props every site menu (and the dispatcher) carry. */
export type SiteMenuChromeProps = {
  /** Which site this header belongs to — marks the "current" row in the menu list.
   *  (The trigger label is always the hub brand, not this site.) */
  currentSiteId: SiteId
  /** Whether a user is signed in. Gates the settings affordance only (the trigger
   *  label is always the hub brand, regardless of route or auth state). */
  authenticated?: boolean
  /** Replaces the trigger's default "Agentic Developer Hub ⌄" content — e.g. a
   *  site's own logo. Used by bitbag.ai to surface the family menu behind its
   *  wordmark. */
  triggerContent?: ReactNode
  /** Extra class on the trigger button (e.g. to style a logo trigger). */
  triggerClassName?: string
  /** Transform a cross-site destination href before it's used (link + navigate).
   *  Injected by the auth-aware header: when the user is signed in it wraps the
   *  href into a silent SSO redirect so the target lands ALREADY logged in (no
   *  logged-out flash). Absent ⇒ plain navigation. The current site's own entry
   *  ('/') is never passed through. */
  resolveHref?: (defaultHref: string) => string
  /** The signed-in user's personal workspace slug, forwarded to {@link useSiteMenu}
   *  as the in-hub slug fallback on the slug-less workspace shell routes (`/home`,
   *  `/home/settings`, …). Supplied by the auth-aware header on the hub. */
  personalSlug?: string
  /** When signed in, the command row swaps the "?" help button for a settings
   *  gear. `onSettings` (preferred) opens an in-app overlay over the current
   *  route; otherwise `settingsHref` makes the gear a link (satellites redirect
   *  to the hub's settings page). Both absent, or signed out ⇒ the "?" help
   *  button. Gated on `authenticated`: settings never show signed out. */
  settingsHref?: string
  onSettings?: () => void
  /** The signed-OUT top-section links (Login / Sign up). Supplied by AdhHeader (its
   *  env-resolved login/signup hrefs); when signed in, or absent, those rows are
   *  omitted (the signed-in top section shows Home / Workspaces / Recents instead). */
  loginHref?: string
  signupHref?: string
  /** Curated route map for the "Routes" flyout, appended after the Marketing/Main
   *  sites submenus. Shown in local/testing/staging, and to a signed-in adh admin
   *  in every env — see {@link SiteMenu}'s devToolsSection. When a site passes
   *  none, the flyout falls back to the generated per-site route map
   *  (`@agentic-toolkit/adh-registry/routes`), loaded lazily once the dev tools unlock. */
  routes?: RouteSection[]
  /** The signed-in user holds the adh `admin` capability. Unlocks the whole dev
   *  tail of the menu (Marketing/Main sites, Routes, Debug Options) in EVERY env,
   *  production included. A display courtesy, not a security boundary — everything
   *  it reveals (site lists, route paths, the debug console) ships in the client
   *  bundle for anyone to read; the backend enforces real authorization. */
  userIsAdmin?: boolean
  /** The host site's OWN primary nav — the same `NavLink[]` the header bar draws.
   *  Surfaced here as rows ONLY while the bar has dropped them, which it does below
   *  768px (`.adh-header__links { display: none }`): the bar cannot hold the brand,
   *  three-plus destinations and the auth cluster inside a 390px phone.
   *
   *  Without this the phone has no primary nav at all. It used to be reachable in the
   *  avatar dropdown, which carried the signed-in nav; that dropdown is an account menu
   *  now, so the destinations have nowhere else to be. Signed OUT was never covered
   *  even then — the media query hides the links at every auth state.
   *
   *  Above the breakpoint these rows are ABSENT, not hidden: see
   *  {@link useHeaderLinksCollapsed}. */
  navLinks?: NavLink[]
  /** Drop the dev-only Routes / Debug Options rows (and the Debug window they own).
   *  Set by the theme editor's SiteMenuPreview, which renders a LIVE SiteMenu inside
   *  the Debug console itself — without this, its "Debug Options" row would open a
   *  second Debug console on top of the first. The same recursion the preview already
   *  guards against for the theme switcher; the window portals to <body>, so the
   *  preview's scoped-CSS trick can't reach it. */
  suppressDevTools?: boolean
}

export type SiteMenuProps = SiteMenuChromeProps & {
  /** The declarative menu config to render — supplied by a config-only subclass
   *  (MarketingSiteMenu / WorkspaceSiteMenu). This base holds ALL the logic; the
   *  subclass holds ONLY this. */
  groups: MenuGroup[]
}

/**
 * The shared site-menu base: the header's site-switcher trigger rendered as a
 * {@link NavigationPopover} command menu, driven entirely by a declarative
 * {@link MenuGroup} config. It owns everything except the content —
 *
 *  - env-aware destination links (cross-site / in-hub for SITE links via hrefFor,
 *    hub routes via routeHref), each resolved once per row;
 *  - the trigger label (always the hub brand — this menu is the family launcher);
 *  - navigation (SPA for same-origin, full-page for cross-site);
 *  - the signed-in settings gear / signed-out help affordance + the "help" search
 *    command that opens the shared sites-overview popover.
 *
 * The config-only subclasses (MarketingSiteMenu, WorkspaceSiteMenu) supply nothing
 * but their `groups`; the dispatcher (SiteMenuSwitcher) picks which to render by route.
 */
export function SiteMenu({
  groups,
  currentSiteId,
  authenticated,
  triggerContent,
  triggerClassName,
  resolveHref,
  personalSlug,
  settingsHref,
  onSettings,
  loginHref,
  signupHref,
  navLinks,
  routes,
  userIsAdmin,
  suppressDevTools,
}: SiteMenuProps): ReactElement {
  // The trigger is always the hub brand ("Agentic Developer Hub") — this menu is
  // the family launcher, not a breadcrumb, so the label never reflects the site
  // (or workspace area) you're on. The current site is still highlighted in the
  // list (via `currentSiteId` → useSiteMenu).
  const hub = getSite('hub')
  const label = hub ? siteHeaderTitle(hub) : 'Agentic Developer Hub'

  // The single unlock for the menu's whole dev tail (site-family submenus +
  // Routes + Debug Options): every visitor in a dev-env build, OR a signed-in adh
  // admin in ANY env — production included. The admin leg is a runtime condition,
  // so (unlike the original build-time-only gate) the dev-tail code now ships in
  // production bundles; it stays invisible and unfetched for non-admins.
  const devToolsUnlocked = DEV_TOOLS_BUILD_ENABLED || userIsAdmin === true

  // The config the subclass supplied, plus the dev-only site-family submenus
  // appended once here (only while unlocked) — so BOTH switcher flavors get them
  // from this single shared base. Memoized for stable identity so useSiteMenu's
  // `entries` memo doesn't re-derive every render.
  const menuGroups = useMemo(
    () => (devToolsUnlocked ? [...groups, ...buildDebugSiteGroups()] : groups),
    [groups, devToolsUnlocked],
  )

  // The resolved Hub-core rows + navigation + the Home destination — env-aware,
  // SSO-wrapped, `current`-marked, via the shared {@link useSiteMenu} engine (single
  // source of truth for the link logic).
  const { entries, navigate, homeHref, routeHref } = useSiteMenu(menuGroups, { currentSiteId, resolveHref, personalSlug })

  // This site's own `/details`, or undefined where there is no such page. Drives BOTH
  // the Details row below Help (see `belowHelp`) and the phone fold-in's duplicate
  // filter, which is why it is resolved up here rather than beside the row it describes.
  const detailsHref = siteDetailsHref(currentSiteId)

  // The auth-conditional TOP section, above the shared Hub core (section 0, so one
  // divider falls between it and the Hub block at section 1). Signed out → Login +
  // Sign up. Signed in → Home, an indented Workspaces flyout (hub-only, via context),
  // and a Recents flyout (from the on-device store; hidden when empty).
  const pathname = usePathname() ?? '/'
  const workspacesMenu = useWorkspacesMenu()
  const recents = useRecents()
  const topSection = useMemo<PopoverEntry[]>(() => {
    if (!authenticated) {
      const out: PopoverEntry[] = []
      if (loginHref) out.push({ kind: 'leaf', section: 0, item: { key: 'login', label: 'Login', href: loginHref, icon: menuIcon('login') } })
      if (signupHref) out.push({ kind: 'leaf', section: 0, item: { key: 'signup', label: 'Sign up', href: signupHref, icon: menuIcon('signup') } })
      return out
    }
    const out: PopoverEntry[] = [
      {
        kind: 'leaf',
        section: 0,
        item: {
          key: 'home',
          label: 'Home',
          href: homeHref,
          icon: menuIcon('home'),
          current: homeHref.startsWith('/') && !homeHref.startsWith('//') && pathname === homeHref,
        },
      },
    ]
    // Workspaces — an indented flyout under Home (hub-only; off-hub there's no
    // provider so it's absent). A loading placeholder keeps the flyout non-blank.
    if (workspacesMenu && (workspacesMenu.workspaces.length || workspacesMenu.loading)) {
      const items: PopoverItem[] = workspacesMenu.workspaces.map((w) => ({
        key: `ws:${w.id}`,
        label: w.label,
        href: w.href,
        current: w.current,
      }))
      out.push({
        kind: 'topic',
        section: 0,
        label: 'Workspaces',
        icon: menuIcon('workspaces'),
        indent: true,
        items: items.length ? items : [{ key: 'ws:loading', label: 'Loading…' }],
      })
    }
    // Recents — a flyout of the last places visited, newest-first; hidden when empty.
    if (recents.length) {
      const items: PopoverItem[] = recents.map((r) => ({
        key: `recent:${r.url}`,
        label: r.label,
        href: r.url,
        icon: menuIcon(r.iconKey),
        current: r.url === pathname,
      }))
      out.push({ kind: 'topic', section: 0, label: 'Recents', icon: menuIcon('recents'), items })
    }
    return out
  }, [authenticated, loginHref, signupHref, homeHref, workspacesMenu, recents, pathname])

  // The host site's own primary nav, surfaced HERE exactly while the bar has dropped
  // it (below 768px). The rows are {@link buildSiteNavEntries}' — a pure builder with
  // its own test, like the dev-tools and site-family sections — and the gate is
  // {@link useHeaderLinksCollapsed}, which reads the very media query the bar hides on.
  const linksCollapsed = useHeaderLinksCollapsed()
  const navSection = useMemo<PopoverEntry[]>(
    () =>
      linksCollapsed
        ? buildSiteNavEntries(navLinks, {
            // Only signed in does `topSection` above render a Home row for these to
            // duplicate; signed out it is Login / Sign up. Passing `homeHref`
            // regardless would delete community's "Forum" (`/home`) from the menu of
            // an anonymous phone visitor and leave the board unreachable.
            homeHref: authenticated ? homeHref : undefined,
            // Unconditional, unlike homeHref: the Details row below Help is not
            // auth-gated, so wherever it exists it exists in both states.
            detailsHref,
            pathname,
          })
        : [],
    [linksCollapsed, navLinks, authenticated, homeHref, detailsHref, pathname],
  )

  // The Routes flyout's data: the site's curated `routes` prop when it passed one,
  // else the generated per-site route map — its own lazy chunk (package subpath,
  // like the debug console) fetched only once the dev tools actually unlock, so an
  // ordinary production visitor never downloads the family's route inventory.
  // Tagged with the site it was loaded for, so a resolved import can never render
  // a *different* site's routes: today SiteMenu remounts on any cross-site change
  // (each site is its own app), but tying the data to `currentSiteId` makes that
  // correct by construction rather than by that implicit invariant.
  const [generated, setGenerated] = useState<{ siteId: SiteId; sections: RouteSection[] }>()
  const wantGeneratedRoutes =
    devToolsUnlocked && !suppressDevTools && !(routes && routes.length > 0)
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

  // The dev-only tail of the menu (Routes flyout + Debug Options row), ported from
  // AdhHeader's old header pills. The gating logic is the pure buildDevToolsEntries
  // (see devToolsEntries.ts — it explains the deliberate effective-vs-real env
  // split, and the admin bypass of both); everything here is just the wiring.
  //
  // devToolsUnlocked is checked FIRST, and matters beyond keeping the rows out of
  // non-admin production menus: it's what keeps the rows honest with the (always
  // lazily importable) DebugConsoleWindow they drive — the console only ever loads
  // behind the same unlock that showed the row.
  const host = useClientHost()
  const effectiveEnv = useEffectiveEnv(host)
  const realEnv = host ? detectEnv(host) : null
  const override = useEnvOverride()
  const [debugOpen, setDebugOpen] = useState(false)
  const devToolsSection = useMemo<PopoverEntry[]>(
    () =>
      devToolsUnlocked && !suppressDevTools
        ? buildDevToolsEntries({
            routes: effectiveRoutes,
            effectiveEnv,
            realEnv,
            adminUnlocked: userIsAdmin === true,
            override,
            pathname,
            onOpenDebug: () => setDebugOpen(true),
          })
        : [],
    [devToolsUnlocked, suppressDevTools, effectiveRoutes, effectiveEnv, realEnv, userIsAdmin, override, pathname],
  )

  // The Help modal opener — an action row (no navigation), always present regardless of
  // auth. Sits at the foot of the top section (section 0), just above the first divider.
  const openHelp = useHelp().open

  // Contact + Details, the two destinations that left hub's header bar — rows in the
  // pure {@link buildBelowHelpEntries}, which is where the asymmetry between them (a
  // hub route vs. a site-relative one) and the `current` rules are explained.
  const belowHelp = useMemo<PopoverEntry[]>(
    () => buildBelowHelpEntries({ contactHref: routeHref('/contact'), detailsHref, pathname }),
    [routeHref, detailsHref, pathname],
  )

  // The full ordered list: the site's own nav (phone only — see navSection), the auth
  // top section, the shared Hub core (which already ends with the dev site-family
  // submenus), then Routes/Debug Options.
  //
  // The site's nav goes FIRST because on a phone this menu IS the site's navigation —
  // that is the whole of what the bar handed over. Reaching a page on the site you are
  // already on should not mean scrolling past the family launcher to get to it.
  const allEntries = useMemo<PopoverEntry[]>(
    () => [
      ...navSection,
      ...topSection,
      {
        kind: 'leaf',
        section: 0,
        item: { key: 'help', label: 'Help', icon: menuIcon('help'), onSelect: () => openHelp() },
      },
      ...belowHelp,
      ...entries,
      ...devToolsSection,
    ],
    [navSection, topSection, belowHelp, entries, devToolsSection, openHelp],
  )

  // Open the single shared sites-overview popover (rendered by the always-present
  // footer). Assumes the menu is already closing (the base released focus); the rAF
  // lets Radix finish closing first, and the guard avoids showPopover() throwing if
  // it's somehow already open.
  function showOverview(): void {
    requestAnimationFrame(() => {
      const el = document.getElementById(SITES_OVERVIEW_POPOVER_ID) as
        | (HTMLElement & { showPopover?: () => void; hidePopover?: () => void })
        | null
      if (!el || el.matches(':popover-open')) return
      try {
        el.showPopover?.()
      } catch {
        return /* popover unsupported — no-op */
      }
      el.focus?.()
      // A popover opened programmatically (no invoker, focus elsewhere) isn't
      // reliably dismissed by the UA's Escape handling across browsers, so close it
      // explicitly. Capture-phase + self-cleanup on the popover's `toggle`.
      const onKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape') el.hidePopover?.()
      }
      const onToggle = () => {
        if (!el.matches(':popover-open')) {
          document.removeEventListener('keydown', onKeyDown, true)
          el.removeEventListener('toggle', onToggle)
        }
      }
      document.addEventListener('keydown', onKeyDown, true)
      el.addEventListener('toggle', onToggle)
    })
  }

  return (
    <>
      <NavigationPopover
        entries={allEntries}
        onChoose={navigate}
        triggerLabel={`${label} — switch site`}
        triggerText={label}
        // The hub brand mark before the label (currentColor ⇒ it rides the
        // trigger's accent color and hover brightening with the text).
        triggerIcon={<HubMark className="adh-nav-popover__mark" />}
        triggerContent={triggerContent}
        triggerClassName={triggerClassName}
        placeholder="Search sites, or browse topics"
        emptyLabel="No matching sites"
        // Typing "help" surfaces a command that opens the family-overview popover.
        searchCommand={{
          matches: (q) => q.toLowerCase() === 'help',
          label: 'Help — about the sites',
          shortcut: 'overview',
          onSelect: showOverview,
        }}
        // The command-row trailing control: signed-in settings gear (in-app overlay
        // or hub link), else the signed-out family-overview "?" help button.
        commandTrailing={({ close }) =>
          authenticated && onSettings ? (
            <button
              type="button"
              className="adh-site-switcher__help"
              aria-label="User settings"
              onClick={() => {
                close({ restoreFocus: false })
                requestAnimationFrame(() => onSettings())
              }}
            >
              <Settings className="adh-site-switcher__help-icon" aria-hidden />
            </button>
          ) : authenticated && settingsHref ? (
            // A real link so middle-click / new-tab work; native nav tears down the
            // page, so no explicit close needed.
            <a className="adh-site-switcher__help" aria-label="User settings" href={settingsHref}>
              <Settings className="adh-site-switcher__help-icon" aria-hidden />
            </a>
          ) : (
            <button
              type="button"
              className="adh-site-switcher__help"
              aria-label="About the Agentic Developer family"
              onClick={() => {
                close({ restoreFocus: false })
                showOverview()
              }}
            >
              <CircleHelp className="adh-site-switcher__help-icon" aria-hidden />
            </button>
          )
        }
      />
      {/* Portals to document.body (see FloatingWindow), so its position here is
          irrelevant to where it renders — this is just the one owning chokepoint
          for the dynamic import + open state, driven by the "Debug Options" row
          above. Mounted only once opened, so the chunk isn't fetched on every dev
          page load; `suppressDevTools` keeps the theme editor's in-console SiteMenu
          preview from stacking a second console on the first. */}
      {debugOpen && !suppressDevTools && (
        <DebugConsoleWindow open onClose={() => setDebugOpen(false)} />
      )}
    </>
  )
}
