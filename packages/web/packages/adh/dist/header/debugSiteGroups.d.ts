import { type MenuGroup } from './SiteMenu';
export declare const DEBUG_SECTION = 2;
/**
 * The two dev site-family flyouts — "Marketing sites" and "Main sites" — as pure
 * data, independent of the environment. The gate lives in {@link SiteMenu}'s
 * `devToolsUnlocked` (build-time dev-env allowlist OR the signed-in-admin
 * runtime unlock) — a RUNTIME condition now, so there is no module-load
 * DCE'able constant here anymore: production bundles must carry this builder
 * for the admin path. It's pure registry data, so the cost is a few hundred
 * bytes of ids the registry ships anyway.
 */
export declare function buildDebugSiteGroups(): MenuGroup[];
//# sourceMappingURL=debugSiteGroups.d.ts.map