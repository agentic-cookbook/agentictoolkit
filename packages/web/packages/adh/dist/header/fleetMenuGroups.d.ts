import { type MenuGroup } from './SiteMenu';
/** The section every fleet row carries. See the module comment. */
export declare const FLEET_SECTION = 1;
/**
 * The family, in the order it is meant to be read.
 *
 * A constant rather than a builder: it takes no arguments, and a stable identity
 * is what keeps {@link useSiteMenu}'s `entries` memo from re-deriving every row
 * on every render.
 */
export declare const FLEET_MENU_GROUPS: MenuGroup[];
//# sourceMappingURL=fleetMenuGroups.d.ts.map