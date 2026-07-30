import { type SiteId } from '@agentic-toolkit/adh-registry'
import { assembleTree, getLocale } from './assemble'
import { conceptStructure } from './structure'
import { catalogs } from './content'
import type { ConceptNode, GraphNode, NodeKind } from './types'

export * from './types'
export * from './assemble'
export type { SiteId } from '@agentic-toolkit/adh-registry'
// Re-exported so server components (e.g. the help-site doc backlink) can build a
// cross-site `/details` URL without importing the 'use client' main barrel.
export { siteProdUrl } from '@agentic-toolkit/adh-registry'
export { conceptStructure } from './structure'
export { catalogs } from './content'
// PRESERVED IMPORT — the package path, never './participating'. The header entry
// reaches this module too (SiteHeader's "Details" link), and under `bundle: true,
// splitting: false` a relative specifier gives each entry its own copy of the
// module-level Set. Its own tsup entry + `external` + exports subpath is the other
// half of the remedy; see verify-bundle-boundaries.py.
export {
  CONCEPT_SITE_IDS,
  isConceptSite,
} from '@agentic-toolkit/adh/concepts/participating'

// The taxonomy every query below reads is ASSEMBLED from two authored layers: the
// locale-agnostic `structure.json` (the shape) + the active locale's content
// catalog (`content/<locale>.json`, the copy). See `assemble.ts`. The content
// studio edits those JSON files; nothing here changes when the copy does.

/** The assembled taxonomy for the active locale — the single rooted node behind
 *  the graph, the `/details` routes, and every derived index in this module. */
export const conceptTree: ConceptNode = assembleTree(
  conceptStructure,
  catalogs,
  getLocale(),
)

// ── Derived indexes (computed once at module load — pure + deterministic) ────

interface FlatEntry {
  node: ConceptNode
  parent: ConceptNode | null
}

const flat: FlatEntry[] = []
;(function walk(node: ConceptNode, parent: ConceptNode | null) {
  flat.push({ node, parent })
  for (const child of node.children ?? []) walk(child, node)
})(conceptTree, null)

const byId = new Map<string, FlatEntry>(flat.map((e) => [e.node.id, e]))

/** Every node, keyed by id. */
export const conceptById: ReadonlyMap<string, ConceptNode> = new Map(
  flat.map((e) => [e.node.id, e.node]),
)

/** Every node id (for reserved-slug guards + generateStaticParams sources). */
export const conceptIds: ReadonlySet<string> = new Set(flat.map((e) => e.node.id))

export function getConcept(id: string): ConceptNode | undefined {
  return byId.get(id)?.node
}

/** The concept a help-site doc maps to (reverse of `node.docs`). Lets a doc page
 *  link back to its concept's `/details` page. */
export function conceptByDoc(slug: string): ConceptNode | undefined {
  return flat.find((e) => e.node.docs === slug)?.node
}

/** A node has a `/details/<id>` page when it carries body content. Concepts +
 *  the root have none (they live in the graph; breadcrumbs link them to `/`). */
export function hasDetailPage(node: ConceptNode): boolean {
  return (node.detail?.length ?? 0) > 0 || (node.keyPoints?.length ?? 0) > 0
}

/** The KIND of a node — the graph renders this as a distinct shape. Honours an
 *  explicit `kind`, else derives it: the tree root is `root`; anything with a
 *  `siteId` is a `site`; a childless leaf with body content is a `feature`;
 *  everything else (a grouping with children) is a `category`. */
export function nodeKind(node: ConceptNode): NodeKind {
  if (node.kind) return node.kind
  if (node.id === conceptTree.id) return 'root'
  if (node.siteId) return 'site'
  const hasChildren = (node.children?.length ?? 0) > 0
  if (!hasChildren && hasDetailPage(node)) return 'feature'
  return 'category'
}

/** Root → node inclusive chain. Empty if the id is unknown. */
export function chainTo(id: string): ConceptNode[] {
  const out: ConceptNode[] = []
  let cur = byId.get(id)
  while (cur) {
    out.unshift(cur.node)
    cur = cur.parent ? byId.get(cur.parent.id) : undefined
  }
  return out
}

/** Ancestors of a node, root-first, excluding the node itself. */
export function ancestorsOf(id: string): ConceptNode[] {
  return chainTo(id).slice(0, -1)
}

export function childrenOf(id: string): ConceptNode[] {
  return getConcept(id)?.children ?? []
}

export function relatedOf(id: string): ConceptNode[] {
  const node = getConcept(id)
  if (!node?.related) return []
  return node.related
    .map((rid) => getConcept(rid))
    .filter((n): n is ConceptNode => n != null)
}

/** The node a marketing site focuses its landing graph on. */
export function conceptForSite(siteId: SiteId): ConceptNode | undefined {
  return flat.find((e) => e.node.siteId === siteId)?.node
}

/** The concept a site is anchored to — its `siteId`-tagged node, or, for a site
 *  whose id IS a node id (the hub, whose root node carries no `siteId`), that
 *  node. So the hub anchors to the tree root and gets the whole tree's details. */
export function siteConcept(siteId: SiteId): ConceptNode | undefined {
  return conceptForSite(siteId) ?? getConcept(siteId)
}

/** The marketing site a node belongs to — the nearest ancestor (incl. self)
 *  with a `siteId`. Used to resolve cross-site links for "related" topics. */
export function ownerSiteOf(id: string): SiteId | undefined {
  const chain = chainTo(id)
  for (let i = chain.length - 1; i >= 0; i--) {
    const sid = chain[i]?.siteId
    if (sid) return sid
  }
  return undefined
}

/** Every node that has a details page (drives the details-page rail + routes). */
export const detailTopics: ConceptNode[] = flat
  .map((e) => e.node)
  .filter(hasDetailPage)

/** The subtree rooted at a node (inclusive), depth-first in declared order. */
export function subtreeOf(id: string): ConceptNode[] {
  const root = getConcept(id)
  if (!root) return []
  const out: ConceptNode[] = []
  ;(function walk(n: ConceptNode) {
    out.push(n)
    for (const c of n.children ?? []) walk(c)
  })(root)
  return out
}

/** Slim ANY ConceptNode subtree to a GraphNode (labels + structure, no detail
 *  bodies). Pure — pass an assembled-but-uncommitted tree (e.g. the content
 *  studio's edited draft) to preview it in the graph without going through the
 *  committed `conceptTree`. */
export function toGraphTree(node: ConceptNode): GraphNode {
  return {
    id: node.id,
    label: node.label,
    kicker: node.kicker,
    blurb: node.blurb,
    hasDetail: hasDetailPage(node),
    siteId: node.siteId,
    accent: node.accent,
    kind: nodeKind(node),
    children: (node.children ?? []).map(toGraphTree),
  }
}

/** Build the slim graph tree for the committed taxonomy. Call this server-side
 *  and pass the result as a prop so detail prose never ships in the client bundle. */
export function graphTree(): GraphNode {
  return toGraphTree(conceptTree)
}

/** The detail topics within a given site's branch — what that site's
 *  `/details/[topic]` route should statically generate. Falls back to the empty
 *  list for a site with no concept node. (Next `Metadata` for these pages is
 *  built by `detailsMetadata` in `@agentic-toolkit/adh/details`, which is allowed to
 *  depend on `next`; this module stays framework-free.) */
export function detailsParamsForSite(siteId: SiteId): { topic: string }[] {
  const node = siteConcept(siteId)
  if (!node) return []
  return subtreeOf(node.id)
    .filter(hasDetailPage)
    .map((n) => ({ topic: n.id }))
}
