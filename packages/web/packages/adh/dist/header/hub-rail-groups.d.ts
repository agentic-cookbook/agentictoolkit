import { type HubFeatureSegment } from '@agentic-toolkit/adh-registry';
/** One group row on the hub's workspace rail, and the feature segments it discloses. */
export interface HubRailGroup {
    /** Stable rail id. Namespaced with `group:` so the group space and the SEGMENT space are
     *  provably disjoint — a rail level holds one or the other, and `products` names a group AND a
     *  feature. No URL carries it; it exists only as the rail's selection key. */
    id: string;
    label: string;
    description?: string;
    /** A {@link menuIcon} key — the topic's own `iconKey`, else the site its trigger links to. */
    iconKey?: string;
    /** The hub segments this group discloses, in the menu's own order. */
    segments: HubFeatureSegment[];
}
/** The Hub group's rail id, named so a host can PLACE that group rather than only read it out of
 *  the derived list. The hub's rail draws it at the tail — last row above Settings, under a
 *  divider — because it is the family's own front door (Help, Support, the two registries, the
 *  Academy) rather than an area of anyone's work, and the tail is where the rows about the
 *  product-you-are-using-rather-than-the-work-you-are-doing belong.
 *
 *  Derived from the label rather than written as the literal `'group:hub'`, so the two cannot
 *  disagree about the namespacing rule {@link railGroupId} owns. */
export declare const HUB_PROMOTED_GROUP_ID: string;
/**
 * The fleet's groups, in the menu's order, each carrying the hub segments its rows lead to.
 *
 * Derived at module load from {@link FLEET_MENU_GROUPS}: a constant identity, like the tree it
 * reads, so a rail that memoizes on it never re-derives.
 *
 * A segment claimed by two groups goes to the FIRST — the same rule `groupSitesByCategory` uses
 * on the footer's side of this grouping. Nothing claims one twice today; the rule is here so
 * that when something does, the row appears once in a stated place rather than twice.
 */
export declare const HUB_RAIL_GROUPS: HubRailGroup[];
/** The group each hub feature segment belongs to, by group id — the reverse of the list above,
 *  which is the direction the rail asks in (it holds the segment the URL names and needs the
 *  group to open). */
export declare const HUB_RAIL_GROUP_FOR_SEGMENT: Record<HubFeatureSegment, string>;
//# sourceMappingURL=hub-rail-groups.d.ts.map