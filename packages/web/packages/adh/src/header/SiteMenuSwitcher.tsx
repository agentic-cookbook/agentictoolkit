'use client'

import { Fragment, type ReactElement } from 'react'
import { usePathname } from 'next/navigation'
import { type SiteMenuChromeProps } from './SiteMenu'
import { MarketingSiteMenu } from './MarketingSiteMenu'
import { WorkspaceSiteMenu } from './WorkspaceSiteMenu'
import { isWorkspaceMenuRoute } from './activeMenuGroups'
import { PrefetchSiblingSites } from './PrefetchSiblingSites'

export type SiteMenuSwitcherProps = SiteMenuChromeProps

/**
 * The header site-name dropdown — a thin DISPATCHER with no menu content of its
 * own. It picks one of the two config-only site menus by ROUTE: on an app route on
 * the hub (`/home` or a feature route like `/ecosystems`) it renders the
 * {@link WorkspaceSiteMenu}; on the marketing landing `/`, every other hub page,
 * satellites, and signed out it renders the {@link MarketingSiteMenu}. All menu
 * logic lives in {@link SiteMenu}; the two configs are fully independent.
 *
 * REGISTRY-AWARE composition (adh's site menu taxonomy — recents, workspaces, the
 * fleet tree). Named `SiteMenuSwitcher` rather than `SiteSwitcher`: this package already
 * has a `SiteSwitcher` — the registry-FREE primitive (plain caller-supplied
 * `sites` list, no menu taxonomy) that `AdhHeader`'s `siteSwitcher` slot expects.
 * The two are unrelated components that happen to share a role name; this one is
 * adh's actual switcher, injected through that slot by {@link SiteHeader}.
 */
export function SiteMenuSwitcher(props: SiteMenuSwitcherProps): ReactElement {
  const pathname = usePathname() ?? '/'
  const onWorkspaceRoute = isWorkspaceMenuRoute(props.currentSiteId, pathname)
  return (
    <Fragment>
      {/* Prerender same-site siblings on hover so the switch is instant + flash-free
          (local dev only; a no-op cross-site). See PrefetchSiblingSites. */}
      <PrefetchSiblingSites />
      {onWorkspaceRoute ? <WorkspaceSiteMenu {...props} /> : <MarketingSiteMenu {...props} />}
    </Fragment>
  )
}
