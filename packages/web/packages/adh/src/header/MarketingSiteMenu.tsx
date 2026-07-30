'use client'

import { useMemo, type ReactElement } from 'react'
import { SiteMenu, type SiteMenuChromeProps } from './SiteMenu'
import { hubCoreGroups } from './hubCoreGroups'

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING site menu — the public browse experience, shown on the marketing
// landing `/` (and every non-app context: satellites, signed out). CONFIG ONLY:
// it supplies the shared {@link hubCoreGroups} (the Hub row + its inline
// sub-items); the auth-conditional TOP section — Login / Sign up when signed out,
// Home / Workspaces / Recents when signed in — is added by SiteMenu.
//
// Kept as its own component (distinct from the workspace menu) even though both
// render the same core today, so the two can diverge later without churn. The
// built-in search/filter box is always present (rendered by SiteMenu itself).
export function MarketingSiteMenu(props: SiteMenuChromeProps): ReactElement {
  // Memoized for stable config identity between renders (was a module constant) — so
  // useSiteMenu's `entries` memo doesn't re-derive every render.
  const groups = useMemo(() => hubCoreGroups(props.authenticated ?? false), [props.authenticated])
  return <SiteMenu groups={groups} {...props} />
}
