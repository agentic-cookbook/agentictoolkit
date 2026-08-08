'use client'

import { type ReactElement } from 'react'
import { SiteMenu, type SiteMenuChromeProps } from './SiteMenu'
import { FLEET_MENU_GROUPS } from './fleetMenuGroups'

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING site menu — the public browse experience, shown on the marketing
// landing `/` (and every non-app context: satellites, signed out). CONFIG ONLY:
// it supplies the shared {@link FLEET_MENU_GROUPS} (the whole family tree); the
// auth-conditional chrome around it — Login / Sign up when signed out, Home /
// Workspaces / Recents when signed in — is added by SiteMenu.
//
// Kept as its own component (distinct from the workspace menu) even though both
// render the same tree today, so the two can diverge later without churn. The
// built-in search/filter box is always present (rendered by SiteMenu itself).
//
// The tree is a module constant, so it passes straight through: no memo is needed
// for useSiteMenu's `entries` memo to hold, because the identity never changes.
export function MarketingSiteMenu(props: SiteMenuChromeProps): ReactElement {
  return <SiteMenu groups={FLEET_MENU_GROUPS} {...props} />
}
