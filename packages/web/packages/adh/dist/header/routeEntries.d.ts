import type { PopoverItem } from './NavigationPopover';
/** One route in a {@link RouteSection}: its relative path from the site root, and
 *  an optional human description shown beside the path. */
export type RouteDef = {
    path: string;
    description?: string;
};
/** A named group of routes (e.g. "Features", "Auth"). The grouping only organizes
 *  the hand-maintained source list — the dev Routes menu flattens every section
 *  into ONE alphabetical list of paths, so the label is not rendered. */
export type RouteSection = {
    label: string;
    routes: RouteDef[];
};
/**
 * The listed route the user is currently "on": the longest navigable path that
 * is `pathname` exactly, or a path-segment prefix of it (so `/settings`
 * lights up on `/settings/profile`). `/` only matches `/` exactly, never as
 * a prefix (else it would claim every path). Returns the single best match, or
 * null — so at most one row is marked current.
 */
export declare function currentRoutePath(navigablePaths: string[], pathname: string): string | null;
/**
 * Flatten every section's routes into ONE alphabetically-sorted list of
 * {@link PopoverItem} rows — each row's label its relative path. Dynamic-segment
 * routes get no href (non-navigable); the current route is marked via
 * {@link currentRoutePath}. Pure (no hooks/DOM) so it can be unit-tested.
 */
export declare function buildRouteItems(sections: RouteSection[], pathname: string): PopoverItem[];
//# sourceMappingURL=routeEntries.d.ts.map