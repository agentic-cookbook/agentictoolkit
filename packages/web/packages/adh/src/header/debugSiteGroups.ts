import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '@agentic-toolkit/adh-registry'
import { type MenuGroup } from './SiteMenu'

// ─────────────────────────────────────────────────────────────────────────────
// Dev-only site-family submenus: the first rows of the header's dev-tools
// dropdown ({@link DevToolsMenu}), which exists in every NON-production env — and,
// for a signed-in adh admin, in EVERY env including production. Two flyout topics
// — "Marketing sites" and "Main sites" — each listing every site under
// `websites/marketing/` / `websites/main/` (the registry's MARKETING_SITE_IDS /
// MAIN_SITE_IDS) as a link to that site's deployment in the CURRENT environment,
// so a developer can jump straight to any site's testing/staging/local build.
//
// These used to be appended to the tail of the shared {@link SiteMenu} base, which
// is why they are a single builder rather than one per switcher flavor: they showed
// in both. They now live in a menu of their OWN, beside the site menu instead of
// inside it, so the site menu is the same in a dev build as in a shipped one. The
// Routes flyout ({@link buildDevToolsEntries}) is still deliberately separate — it
// switches routes within the current site, not sites.
//
// The links are `external` so they resolve to the cross-site deployment even from
// an in-hub workspace route, where a plain site link would open the
// `/<slug>/<feature>` workspace view instead (see useSiteMenu's hrefFor).

// One section past the fleet tree (section 1, in fleetMenuGroups) — the numbering the
// site menu's sections established, kept because {@link useSiteMenu} still resolves
// these groups and a divider falls between sections. Exported so the Routes / Debug
// Options rows appended after these flyouts share the same section: the dev-tools
// menu is one contiguous run, with no divider anywhere in it.
export const DEBUG_SECTION = 2

/**
 * The two dev site-family flyouts — "Marketing sites" and "Main sites" — as pure
 * data, independent of the environment. The gate lives in {@link DevToolsMenu}
 * (build-time dev-env allowlist OR the signed-in-admin runtime unlock) — a RUNTIME
 * condition, so there is no module-load DCE'able constant here: production bundles
 * must carry this builder for the admin path. It's pure registry data, so the cost
 * is a few hundred bytes of ids the registry ships anyway.
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
