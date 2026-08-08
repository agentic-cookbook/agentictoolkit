import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '@agentic-toolkit/adh-registry'
import { type MenuGroup } from './SiteMenu'

// ─────────────────────────────────────────────────────────────────────────────
// Dev-only site-family submenus, appended to the END of the site menu in every
// NON-production env — and, for a signed-in adh admin, in EVERY env including
// production. Two flyout topics — "Marketing sites" and "Main sites" — each
// listing every site under `websites/marketing/` / `websites/main/` (the
// registry's MARKETING_SITE_IDS / MAIN_SITE_IDS) as a link to that site's
// deployment in the CURRENT environment, so a developer can jump straight to any
// site's testing/staging/local build.
//
// Appended once in the shared {@link SiteMenu} base, so it shows in BOTH site
// switchers (the marketing and workspace flavors) from a single place. The
// Routes flyout (SiteMenu's devToolsSection) is deliberately separate — it
// switches routes within the current site, not sites.
//
// The links are `external` so they resolve to the cross-site deployment even from
// an in-hub workspace route, where a plain site link would open the
// `/<slug>/<feature>` workspace view instead (see useSiteMenu's hrefFor).

// One section past the fleet tree (section 1, in fleetMenuGroups) so a single divider
// falls between the family menu and this dev section. Exported so the Routes /
// Debug Options rows SiteMenu appends after these site-family flyouts share the
// same section — they're all part of one contiguous "dev tools" run, no divider.
export const DEBUG_SECTION = 2

/**
 * The two dev site-family flyouts — "Marketing sites" and "Main sites" — as pure
 * data, independent of the environment. The gate lives in {@link SiteMenu}'s
 * `devToolsUnlocked` (build-time dev-env allowlist OR the signed-in-admin
 * runtime unlock) — a RUNTIME condition now, so there is no module-load
 * DCE'able constant here anymore: production bundles must carry this builder
 * for the admin path. It's pure registry data, so the cost is a few hundred
 * bytes of ids the registry ships anyway.
 */
export function buildDebugSiteGroups(): MenuGroup[] {
  return [
    {
      kind: 'topic',
      section: DEBUG_SECTION,
      label: 'Marketing sites',
      links: MARKETING_SITE_IDS.map((site) => ({ site, external: true })),
    },
    {
      kind: 'topic',
      section: DEBUG_SECTION,
      label: 'Main sites',
      links: MAIN_SITE_IDS.map((site) => ({ site, external: true })),
    },
  ]
}
