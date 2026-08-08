'use client'

import { type ReactElement } from 'react'
import { SiteMenu, type SiteMenuChromeProps } from './SiteMenu'
import { FLEET_MENU_GROUPS } from './fleetMenuGroups'

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE site menu — the signed-in hub APP menu, shown on app routes (`/home`
// and the feature routes like `/ecosystems`). CONFIG ONLY: it supplies the shared
// {@link FLEET_MENU_GROUPS} (the whole family tree); the auth-conditional chrome
// around it (Home / Workspaces / Recents when signed in) is added by SiteMenu.
//
// It's kept as its own component — distinct from the marketing menu — even though
// both render the same tree today, so the two can diverge later without churn.
//
// The tree is a module constant, so it passes straight through: no memo is needed
// for useSiteMenu's `entries` memo to hold, because the identity never changes.
export function WorkspaceSiteMenu(props: SiteMenuChromeProps): ReactElement {
  return <SiteMenu groups={FLEET_MENU_GROUPS} {...props} />
}
