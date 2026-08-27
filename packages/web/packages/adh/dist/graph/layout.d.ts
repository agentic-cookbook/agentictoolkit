import type { GraphNode } from '@agentic-toolkit/adh/concepts';
/** Centre of the focused node — also the hub the child spokes radiate from. Sits
 *  in the upper portion of the square so the breadcrumb row can live below it. */
export declare const FOCUS_X = 50;
export declare const FOCUS_Y = 42;
/** Breadcrumb row: a horizontally-centred row of half-scale replicas BELOW the
 *  main diagram (near the bottom of the square). */
export declare const CRUMB_Y = 91;
/** The parent orb's spot — straight LEFT of the focus, one ring-radius away, so
 *  "back" reads as moving left rather than up. */
export declare function parentSpot(): {
    x: number;
    y: number;
};
export interface Placed {
    node: GraphNode;
    /** Centre of the node as a percentage of the (square) chart. */
    xPct: number;
    yPct: number;
}
/** Lay the ancestor crumbs out as a horizontally-centred row near the bottom. */
export declare function placeCrumbs(ancestors: GraphNode[]): Placed[];
/** Place the focused node's ring nodes around the centre.
 *
 *  - `reserveParent = false` (root, no parent orb): EVEN full-circle 360/n spacing,
 *    rotated so straight-DOWN is a gap (the info-panel line's lane). A lone child
 *    is nudged off the vertical so it never sits straight up.
 *  - `reserveParent = true` (a parent orb sits to the LEFT): children fan the whole
 *    ring except the parent wedge (left) and a small straight-down notch — so they
 *    may sit at the bottom and overlap the panel line, just never directly below
 *    it. Walk the open arc clockwise from just past the parent wedge, skipping the
 *    straight-down notch mid-walk. */
export declare function placeChildren(kids: GraphNode[], reserveParent?: boolean): Placed[];
/** A breadcrumb is a scaled-down *replica* of a node's own expanded state: the
 *  crumb orb with ALL its children fanned around it (textless dots) at the SAME
 *  angles they hold when expanded, just at a small radius. The child the path
 *  runs through is kept too — the caller anchors the outgoing trail line on it. */
export declare function placeCrumbChildren(crumb: Placed, children: GraphNode[]): Placed[];
/** Find a node by id within a (slim) graph tree. */
export declare function findGraphNode(root: GraphNode, id: string): GraphNode | null;
/** Root → node inclusive chain (the breadcrumb). Returns [root] if id is absent. */
export declare function graphChain(root: GraphNode, id: string): GraphNode[];
//# sourceMappingURL=layout.d.ts.map