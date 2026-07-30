import type { SiteId } from '@agentic-toolkit/adh-registry';
/** A call-to-action / link rendered under a node's blurb or in a details page. */
export interface ConceptCta {
    label: string;
    /** A path on THIS site (e.g. '/details/personas') or an absolute cross-site URL. */
    href: string;
    /** Absolute external link — renders with target=_blank rel="noopener noreferrer". */
    external?: boolean;
}
/** One body block of a details page. Structured (not raw MDX) so copy stays
 *  typed, lint-clean, and renders to deterministic, crawlable server markup. */
export type DetailSection = {
    kind: 'prose';
    heading?: string;
    body: string;
} | {
    kind: 'points';
    heading?: string;
    items: string[];
} | {
    kind: 'diagram';
    heading?: string;
    ascii: string;
};
/** What KIND of thing a node is — the graph encodes this as a distinct SHAPE
 *  (root/category = circle, site = rounded-rect card, feature = flat pill), so
 *  the meaning of each orb is obvious at a glance. Orthogonal to `accent` (family
 *  hue) and the focus size/glow. Usually derived (see `nodeKind`); pin explicitly
 *  only to override an ambiguous case. */
export type NodeKind = 'root' | 'category' | 'site' | 'feature';
/** A node in the concept tree: a concept (broad), a site (the 24 marketing
 *  landings), or a feature leaf (most specific). */
export interface ConceptNode {
    /** URL-safe slug. Also the `/details/<topic>` param and the graph/d3 node id.
     *  MUST be globally unique across the whole tree. */
    id: string;
    /** Graph node label + details-page <h1>. */
    label: string;
    /** Small uppercase mono eyebrow shown above the label. */
    kicker?: string;
    /** One-paragraph summary — shown under the focused graph node and as the
     *  details-page lead. */
    blurb: string;
    /** The details-page body. Omit for a node that lives only in the graph
     *  (concepts + the root): those have no `/details/<id>` page; breadcrumbs link
     *  them back to the graph instead. */
    detail?: DetailSection[];
    /** Shorthand: when `detail` is omitted but this is present, the details page
     *  renders a single "Key points" section from it. */
    keyPoints?: string[];
    /** ids of related concepts (the "Connected" row on the details page). */
    related?: string[];
    /** Extra CTA buttons under the blurb (e.g. a link to the live product). */
    ctas?: ConceptCta[];
    /** Links this node to a registry SiteDef. Set on the node a given marketing
     *  site focuses its landing graph on (`conceptForSite(siteId)`). Usually
     *  `id === siteId`, but they may differ when a clearer label is wanted (e.g.
     *  the `community` site's node is labelled "Forums"). */
    siteId?: SiteId;
    /** Family hue (any CSS color). Set on a top-level category; its whole subtree
     *  (the sites + features under it) inherits the tint, which the graph applies as
     *  that node's `--cg-accent` (border/glow/fill). Encodes "these belong together"
     *  — independent of `kind` (shape) and focus (size). Undefined ⇒ the brand gold. */
    accent?: string;
    /** Override the derived node kind (shape). Almost always left unset. */
    kind?: NodeKind;
    /** Optional help-site doc slug this concept maps to (docs linkage). Undefined
     *  for nodes with no dedicated documentation page. */
    docs?: string;
    children?: ConceptNode[];
}
/** The whole taxonomy is one rooted node (the Hub). */
export type ConceptTree = ConceptNode;
/** Supported content locales. `en` is the only one today; the catalog + assembly
 *  seam are locale-keyed so adding a language is a data change, not a code change. */
export type Locale = 'en';
/** The locale-agnostic SHAPE of one taxonomy node — ids, hierarchy, routing,
 *  theming, relationships: everything identical across translations. Carries NO
 *  human-readable copy (that lives in a {@link ContentCatalog}, keyed by `id`). */
export interface StructureNode {
    /** Globally-unique, URL-safe slug (also the graph id + `/details/<id>` param). */
    id: string;
    siteId?: SiteId;
    accent?: string;
    kind?: NodeKind;
    /** ids of related concepts (the "Connected" row); resolved against the tree. */
    related?: string[];
    /** Optional help-site doc slug this concept maps to (docs linkage). */
    docs?: string;
    children?: StructureNode[];
}
/** The translatable COPY for one node, looked up by node id. */
export interface NodeContent {
    label: string;
    kicker?: string;
    blurb: string;
    detail?: DetailSection[];
    keyPoints?: string[];
    ctas?: ConceptCta[];
}
/** One locale's copy for the whole tree, keyed by node id (flat — mirrors the
 *  `conceptById` index, so it's decoupled from tree shape and easy to diff/edit). */
export type ContentCatalog = Record<string, NodeContent>;
/** A slimmed node for the client graph — labels + structure only, NO detail
 *  bodies. The graph component receives this (built server-side by `graphTree()`)
 *  so the full prose of every details page never ships in the client bundle. */
export interface GraphNode {
    id: string;
    label: string;
    kicker?: string;
    blurb: string;
    /** Whether this node has a `/details/<id>` page (drives spoke hrefs). */
    hasDetail: boolean;
    siteId?: SiteId;
    /** Family hue (own, not yet inherited — the client propagates it down the tree). */
    accent?: string;
    /** Node kind → orb SHAPE. Derived server-side by `graphTree()` via `nodeKind`. */
    kind: NodeKind;
    children: GraphNode[];
}
//# sourceMappingURL=types.d.ts.map