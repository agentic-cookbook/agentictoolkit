'use client'

import { isHubWorkspacePath, type SiteId } from '@agentic-toolkit/adh-registry'

/**
 * The dispatch the header's {@link SiteMenuSwitcher} keys off: is this the signed-in
 * hub WORKSPACE context (`/home`, `/ecosystems`, …) rather than the MARKETING
 * browse context (the hub landing, satellites, signed out)? Selects which menu
 * config the switcher renders.
 */
export function isWorkspaceMenuRoute(currentSiteId: SiteId, pathname: string): boolean {
  return currentSiteId === 'hub' && isHubWorkspacePath(pathname)
}
