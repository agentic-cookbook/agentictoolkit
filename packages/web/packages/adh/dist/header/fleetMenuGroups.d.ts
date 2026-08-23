import type { MenuGroup } from './SiteMenu';
/** The section every fleet row carries. See the module comment. */
export declare const FLEET_SECTION = 1;
/** The section {@link ADMIN_MENU_GROUPS} carries — one more than the fleet's, so a
 *  divider falls between the family and the consoles. */
export declare const ADMIN_SECTION: number;
/**
 * The family, in the order it is meant to be read.
 *
 * A constant rather than a builder: it takes no arguments, and a stable identity
 * is what keeps {@link useSiteMenu}'s `entries` memo from re-deriving every row
 * on every render.
 */
export declare const FLEET_MENU_GROUPS: MenuGroup[];
/**
 * The consoles, for admins only — rendered by {@link SiteMenu} beneath the fleet
 * tree when (and ONLY when) the header resolves the signed-in user as an adh
 * admin. A separate export rather than a flag on a row in the tree above, because
 * the tree above is what every visitor sees and is worth being able to read as
 * exactly that.
 *
 * The two site rows are derived from the registry's {@link ADMIN_SITE_IDS} — the
 * sites marked `adminOnly`, the same fact that keeps them out of the footer's
 * sites overview — so the set an admin is shown and the set everyone else is
 * denied cannot drift apart. The third row is the fleet monitor, which is a
 * backend service rather than a family site and so has no registry entry to
 * derive from.
 *
 * ⚠️ Gating a MENU is not authorization. Each console does its own; this only
 * decides who is shown the door.
 */
export declare const ADMIN_MENU_GROUPS: MenuGroup[];
//# sourceMappingURL=fleetMenuGroups.d.ts.map