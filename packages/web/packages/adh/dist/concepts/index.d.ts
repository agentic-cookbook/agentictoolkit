import { type SiteId } from '@agentic-toolkit/adh-registry';
import type { ConceptNode, GraphNode, NodeKind } from './types';
export * from './types';
export * from './assemble';
export type { SiteId } from '@agentic-toolkit/adh-registry';
export { siteProdUrl } from '@agentic-toolkit/adh-registry';
export { conceptStructure } from './structure';
export { catalogs } from './content';
export { CONCEPT_SITE_IDS, isConceptSite, } from '@agentic-toolkit/adh/concepts/participating';
/** The assembled taxonomy for the active locale — the single rooted node behind
 *  the graph, the `/details` routes, and every derived index in this module. */
export declare const conceptTree: ConceptNode;
/** Every node, keyed by id. */
export declare const conceptById: ReadonlyMap<string, ConceptNode>;
/** Every node id (for reserved-slug guards + generateStaticParams sources). */
export declare const conceptIds: ReadonlySet<string>;
export declare function getConcept(id: string): ConceptNode | undefined;
/** The concept a help-site doc maps to (reverse of `node.docs`). Lets a doc page
 *  link back to its concept's `/details` page. */
export declare function conceptByDoc(slug: string): ConceptNode | undefined;
/** A node has a `/details/<id>` page when it carries body content. Concepts +
 *  the root have none (they live in the graph; breadcrumbs link them to `/`). */
export declare function hasDetailPage(node: ConceptNode): boolean;
/** The KIND of a node — the graph renders this as a distinct shape. Honours an
 *  explicit `kind`, else derives it: the tree root is `root`; anything with a
 *  `siteId` is a `site`; a childless leaf with body content is a `feature`;
 *  everything else (a grouping with children) is a `category`. */
export declare function nodeKind(node: ConceptNode): NodeKind;
/** Root → node inclusive chain. Empty if the id is unknown. */
export declare function chainTo(id: string): ConceptNode[];
/** Ancestors of a node, root-first, excluding the node itself. */
export declare function ancestorsOf(id: string): ConceptNode[];
export declare function childrenOf(id: string): ConceptNode[];
export declare function relatedOf(id: string): ConceptNode[];
/** The node a marketing site focuses its landing graph on. */
export declare function conceptForSite(siteId: SiteId): ConceptNode | undefined;
/** The concept a site is anchored to — its `siteId`-tagged node, or, for a site
 *  whose id IS a node id (the hub, whose root node carries no `siteId`), that
 *  node. So the hub anchors to the tree root and gets the whole tree's details. */
export declare function siteConcept(siteId: SiteId): ConceptNode | undefined;
/** The marketing site a node belongs to — the nearest ancestor (incl. self)
 *  with a `siteId`. Used to resolve cross-site links for "related" topics. */
export declare function ownerSiteOf(id: string): SiteId | undefined;
/** Every node that has a details page (drives the details-page rail + routes). */
export declare const detailTopics: ConceptNode[];
/** The subtree rooted at a node (inclusive), depth-first in declared order. */
export declare function subtreeOf(id: string): ConceptNode[];
/** Slim ANY ConceptNode subtree to a GraphNode (labels + structure, no detail
 *  bodies). Pure — pass an assembled-but-uncommitted tree (e.g. the content
 *  studio's edited draft) to preview it in the graph without going through the
 *  committed `conceptTree`. */
export declare function toGraphTree(node: ConceptNode): GraphNode;
/** Build the slim graph tree for the committed taxonomy. Call this server-side
 *  and pass the result as a prop so detail prose never ships in the client bundle. */
export declare function graphTree(): GraphNode;
/** The detail topics within a given site's branch — what that site's
 *  `/details/[topic]` route should statically generate. Falls back to the empty
 *  list for a site with no concept node. (Next `Metadata` for these pages is
 *  built by `detailsMetadata` in `@agentic-toolkit/adh/details`, which is allowed to
 *  depend on `next`; this module stays framework-free.) */
export declare function detailsParamsForSite(siteId: SiteId): {
    topic: string;
}[];
//# sourceMappingURL=index.d.ts.map