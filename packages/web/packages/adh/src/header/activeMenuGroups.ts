'use client'

import { type SiteId } from '@agentic-toolkit/adh-registry'
// By the PACKAGE PATH for the reason useSiteMenu.ts records: this leaf has its own entry and is
// listed `external`, and a relative specifier here would inline a second copy into the header.
import { isHubWorkspacePath } from '@agentic-toolkit/adh/site/hubWorkspacePath'

/**
 * The dispatch the header's {@link SiteMenuSwitcher} keys off: is this the signed-in
 * hub WORKSPACE context (`/home`, `/<workspace>`, `/<workspace>/products`, …) rather
 * than the MARKETING browse context (the hub landing, its feature pages, a public
 * profile, satellites, signed out)? Selects which menu config the switcher renders.
 */
export function isWorkspaceMenuRoute(currentSiteId: SiteId, pathname: string): boolean {
  return currentSiteId === 'hub' && isHubWorkspacePath(pathname)
}
