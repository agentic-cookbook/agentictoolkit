'use client'

import { useMemo, type ReactElement } from 'react'
import { SiteMenu, type SiteMenuChromeProps } from './SiteMenu'
import { hubCoreGroups } from './hubCoreGroups'

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE site menu — the signed-in hub APP menu, shown on app routes (`/home`
// and the feature routes like `/ecosystems`). CONFIG ONLY: it supplies the shared
// {@link hubCoreGroups} (the Hub row + its inline sub-items); the auth-conditional
// TOP section (Home / Workspaces / Recents when signed in) is added by SiteMenu.
//
// It's kept as its own component — distinct from the marketing menu — even though
// both render the same core today, so the two can diverge later without churn.
export function WorkspaceSiteMenu(props: SiteMenuChromeProps): ReactElement {
  // Memoized so the config array keeps a stable identity between renders (it was a
  // module constant before) — otherwise useSiteMenu's `entries` memo re-derives every
  // render, re-running env-aware href resolution across every row.
  const groups = useMemo(() => hubCoreGroups(props.authenticated ?? false), [props.authenticated])
  return <SiteMenu groups={groups} {...props} />
}
