// Folding the owner's category rows into the FOREST the notebook rail navigates.
//
// The set is a DAG, not a tree: `content.category_edges` holds one row per parent→child
// link, so a category may sit under any number of parents, or none. A fold therefore draws
// some categories in MORE THAN ONE PLACE, and that is the feature — "Q3" filed under both
// "Work" and "Planning" is reachable from either. A node's identity in the rail is
// consequently its PATH, not its id (see {@link CategoryNode.path}); ids repeat.
//
// The edges have real foreign keys now, and the backend refuses the edge that would close
// a cycle, so the defects this fold has to survive are narrower than they were — but not
// gone. A parent id can still name a row that isn't in `rows` (another workspace's, or one
// deleted between the two reads), and a cycle written before that guard existed would still
// be served. The rules:
//
//   * A parent that isn't in `rows` is skipped. A category with NO surviving parent becomes
//     a ROOT — never dropped, because a corrupt link must cost the user the row's
//     PLACEMENT, never its existence, or notes would sit in a category that has vanished.
//   * A cycle is broken where it closes back on the current PATH, and the rows it isolates
//     from every root are re-seeded as roots in row order. So a looped graph still renders
//     every category exactly once at top level, and the walk terminates.
//   * The EXPANSION is capped ({@link MAX_TREE_NODES}) — the expansion, not the row set. A
//     wide DAG has exponentially many paths and a rail that hangs is worse than one that
//     stops drawing, but the rows are what the backend served and there are linearly many
//     of them. So a row's FIRST drawing is always free and only its REPEAT drawings are
//     charged. Truncation therefore costs DEPTH (the tail of one branch's re-expansion),
//     never BREADTH: no top-level category can vanish because another one was wide.
//   * A category's slug is unique WITHIN ITS LEVEL, because `slugify` is not injective and
//     two sibling names can land on one slug (see {@link siblingSlugs}).
import { slugify } from "../lib/slug";

/** One category in the owner's hierarchy. It is a DAG: `parentIds` may hold any number of
 *  parents, or none, so a category can sit in several places at once. The walk below also
 *  tolerates a parent id naming no node, and a cycle, rather than trusting the data. */
export interface CategoryTreeNode {
  id: string;
  name: string;
  parentIds: string[];
}

/**
 * How many REPEAT drawings one fold may materialise. A DAG's path count is exponential in its
 * depth (ten categories each filed under the two above them is already a thousand paths), and
 * the rail renders paths. The cap is far above any hand-built taxonomy and far below a hang.
 *
 * It counts repeats only. Every row's first drawing is free, so the cap can never cost a
 * category its place in the forest — only the tail of some branch's RE-expansion. It used to
 * count every node and also gate the top-level loop, which meant a single wide root could
 * exhaust it and silently delete every root after it from the rail.
 */
export const MAX_TREE_NODES = 4000;

/** One category AT ONE PLACE in the forest, with its children attached. */
export interface CategoryNode {
  id: string;
  name: string;
  /** URL identity: `slugify(name)`, falling back to the id (see {@link slugFor}), then made
   *  unique among its SIBLINGS (see {@link siblingSlugs}) — two different names can slugify
   *  the same, and a level with two identical slugs has an unreachable second category. */
  slug: string;
  /** Every parent this category is filed under — including ones not in this forest. */
  parentIds: string[];
  /**
   * The ids from the outermost root down to and including this node. Its identity HERE:
   * a category with two parents is two nodes with the same `id` and different paths, so
   * `id` is not a usable React key and `path` is (see {@link categoryKey}).
   */
  path: string[];
  children: CategoryNode[];
}

/**
 * A category's URL identity. `slugify` strips everything that isn't alphanumeric, so a name
 * made entirely of punctuation ("***") slugifies to the EMPTY string — and an empty segment
 * is dropped by both the parser and `pushDeep`, which would leave that category permanently
 * unselectable. The id is the fallback: ugly in the address bar, but addressable, and it
 * can never be the `-` separator either.
 */
export function slugFor(name: string, id: string): string {
  return slugify(name) || id;
}

/**
 * Hand out slugs that are unique WITHIN ONE SIBLING SET.
 *
 * `slugify` is not injective and the backend's uniqueness rule is on the NAME, so two
 * different sibling names legitimately collide on one slug: "Work - Q3" and "Work Q3" both
 * become `work-q3`. Before this, both nodes carried that slug and all three consequences were
 * live — React saw duplicate `key`s and could attach a row's state to its twin, selection
 * compares by slug so BOTH rows highlighted at once, and {@link resolveCategoryChain} takes
 * the first match, so the second category could never be opened: its gear menu acted on the
 * first one.
 *
 * The first claimant keeps the bare slug, so a set with no collision is byte-identical to what
 * shipped before and no existing URL moves. Only a later twin is suffixed, and the suffix is
 * re-tried until it is genuinely free, because `-2` can itself be some other sibling's real
 * slug (a category actually named "Work Q3 2").
 *
 * Uniqueness is per LEVEL, not per forest, which is all the rail and the parser need: a chain
 * is resolved one level at a time. Sibling order is the backend's (`sortOrder`, then name), so
 * the assignment is deterministic and stable across loads for a given ordering. It is NOT
 * stable across a re-order that moves twins past each other — but a slug is derived from the
 * NAME and already moves on rename, so it was never a durable identity; {@link categoryKey} is.
 */
function siblingSlugs(): (row: CategoryTreeNode) => string {
  const taken = new Set<string>();
  return (row) => {
    const base = slugFor(row.name, row.id);
    if (!taken.has(base)) {
      taken.add(base);
      return base;
    }
    for (let n = 2; ; n += 1) {
      const candidate = `${base}-${n}`;
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
  };
}

/** A node's stable key within one forest — its path, which is unique where its id is not. */
export function categoryKey(node: CategoryNode): string {
  return node.path.join("/");
}

/**
 * Fold the owner's categories into a forest of roots. Sibling order is the backend's
 * (`sortOrder`, then name), preserved because the rows arrive already sorted and every
 * index below is built by walking them in order.
 *
 * A category appears under EVERY parent it is filed under. One with no parent in `rows`
 * is a root; one reachable only through a cycle is re-seeded as a root by the second pass,
 * so no row is ever lost — and the cap cannot lose one either, because it charges only
 * REPEAT drawings ({@link MAX_TREE_NODES}).
 */
export function buildCategoryTree(
  rows: readonly CategoryTreeNode[]
): CategoryNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  for (const row of rows) byId.set(row.id, row);

  // parent id → the rows filed under it, in the backend's order. Links to a row we can't
  // see, and a row filed under itself, are dropped here so nothing below has to re-check.
  const childrenOf = new Map<string, CategoryTreeNode[]>();
  const visibleParents = (row: CategoryTreeNode): string[] =>
    [...new Set(row.parentIds)].filter((id) => id !== row.id && byId.has(id));
  for (const row of rows) {
    for (const parentId of visibleParents(row)) {
      const bucket = childrenOf.get(parentId);
      if (bucket) bucket.push(row);
      else childrenOf.set(parentId, [row]);
    }
  }

  const drawn = new Set<string>();
  let budget = MAX_TREE_NODES;

  // `onPath` is the ancestor set of the node being built — not of the whole walk. A child
  // already on the path would close a cycle and is skipped; one seen on a SIBLING branch is
  // drawn again, because that is the second place it is genuinely filed.
  function materialise(
    row: CategoryTreeNode,
    ancestors: string[],
    onPath: Set<string>,
    slug: string
  ): CategoryNode {
    // A row's FIRST drawing is free; only a REPEAT costs budget. That is what makes
    // truncation cost depth instead of breadth — see the header. Both counts are bounded
    // (first drawings by `rows.length`, since `drawn` only grows; repeats by the budget), so
    // the walk still terminates on a cyclic or exponentially-wide graph.
    if (drawn.has(row.id)) budget -= 1;
    drawn.add(row.id);
    const path = [...ancestors, row.id];
    const node: CategoryNode = {
      id: row.id,
      name: row.name,
      slug,
      parentIds: [...row.parentIds],
      path,
      children: [],
    };
    onPath.add(row.id);
    const slugOf = siblingSlugs();
    for (const child of childrenOf.get(row.id) ?? []) {
      if (onPath.has(child.id)) continue;
      // Out of budget, a child that has already been drawn elsewhere is dropped — but one
      // being drawn for the FIRST time is still free, so `continue` rather than `break`:
      // a later sibling may be that first drawing, and no row may be lost to a wide cousin.
      if (drawn.has(child.id) && budget <= 0) continue;
      node.children.push(materialise(child, path, onPath, slugOf(child)));
    }
    onPath.delete(row.id);
    return node;
  }

  const roots: CategoryNode[] = [];
  // ONE slug scope for the whole top level, spanning both passes: the two loops append to a
  // single sibling set, so a cycle-seeded root cannot collide with a parentless one.
  const rootSlug = siblingSlugs();
  // Neither loop is gated on the budget. A root is by definition the first drawing of its row
  // (the second pass tests `drawn`), so it is free, and dropping one would be exactly the
  // breadth truncation this fold promises never to do.
  for (const row of rows) {
    if (visibleParents(row).length === 0)
      roots.push(materialise(row, [], new Set(), rootSlug(row)));
  }
  // Anything still undrawn is filed only under categories that are themselves unreachable —
  // a cycle. Seeding the first such row in row order (and letting it draw its own subtree)
  // keeps the result deterministic and still shows every category exactly once.
  for (const row of rows) {
    if (!drawn.has(row.id)) roots.push(materialise(row, [], new Set(), rootSlug(row)));
  }
  return roots;
}

/**
 * Resolve a slug chain against the forest, stopping at the first slug that names no child of
 * the level above. Returns the nodes it actually resolved, so a deep link to a renamed or
 * deleted category degrades to the deepest ancestor that still exists instead of showing
 * nothing.
 *
 * Nothing ties within a level any more. `slugify` is not injective — "My notes" and
 * "my-notes" are different category names (the backend's uniqueness rule is on the NAME) that
 * produce one slug — so {@link siblingSlugs} suffixes the later twin when the fold assigns
 * slugs, and every child of one node now carries a distinct one. A category filed under two
 * parents still appears on both their child lists, but never twice on the SAME one, so it
 * cannot collide with itself. Sibling order is the backend's, so the walk is deterministic
 * and stable across loads.
 */
export function resolveCategoryChain(
  roots: CategoryNode[],
  slugs: string[]
): CategoryNode[] {
  const chain: CategoryNode[] = [];
  let level = roots;
  for (const slug of slugs) {
    const hit = level.find((node) => node.slug === slug);
    if (!hit) break;
    chain.push(hit);
    level = hit.children;
  }
  return chain;
}

/** One row of a flattened forest: the node and how deep it sits. */
export interface FlatCategory {
  node: CategoryNode;
  depth: number;
}

/**
 * Walk the forest depth-first into a flat, indent-carrying list — what a MANAGEMENT view
 * needs, where every category is on screen at once rather than one level at a time. The
 * rail walks the same forest the other way (one level per depth), so both readings come
 * from the single fold above and cannot disagree about a corrupt link.
 *
 * A multi-parent category appears once per parent, exactly as the rail shows it. That
 * repetition is the honest picture — each row is a real filing, and unfiling one leaves
 * the others — so a management view must key by {@link categoryKey}, not by id.
 */
export function flattenCategoryTree(
  roots: CategoryNode[],
  depth = 0
): FlatCategory[] {
  return roots.flatMap((node) => [
    { node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}

/**
 * Every category NAME the owner has, alphabetical — the editor's category autocomplete.
 * A FLAT list is still an unambiguous vocabulary because the backend keeps a name unique
 * per owner across the whole hierarchy; that rule is exactly what lets a note carry its
 * category as a bare string while the rail shows it in every place it is filed.
 */
export function categoryNames(rows: readonly CategoryTreeNode[]): string[] {
  return [...new Set(rows.map((row) => row.name))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** How many trails one value may show. A DAG has exponentially many paths and this is a form
 *  row; past a handful, the breadcrumb stops being the thing that made the name legible. */
const MAX_TRAILS = 4;

/**
 * Every path from a root down to `leaf`, each outermost-first — one per place the category is
 * filed. Guards a broken graph three ways: a parent id naming no node ends that branch, a
 * parent already on the current path is skipped (so a cycle cannot recur), and the result is
 * capped. The caller always gets at least one trail — `[leaf]` for a category with no
 * reachable parent — never a hang.
 */
export function categoryTrails(
  nodes: readonly CategoryTreeNode[],
  leaf: CategoryTreeNode
): CategoryTreeNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trails: CategoryTreeNode[][] = [];
  const walk = (
    node: CategoryTreeNode,
    below: CategoryTreeNode[],
    onPath: Set<string>
  ): void => {
    if (trails.length >= MAX_TRAILS) return;
    const trail = [node, ...below];
    const parents = [...new Set(node.parentIds)]
      .filter((id) => id !== node.id && !onPath.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is CategoryTreeNode => p !== undefined);
    if (parents.length === 0) {
      trails.push(trail);
      return;
    }
    onPath.add(node.id);
    for (const parent of parents) walk(parent, trail, onPath);
    onPath.delete(node.id);
  };
  walk(leaf, [], new Set());
  return trails;
}

/** The node a name refers to. Names are unique per owner across the whole tree, so this is exact;
 *  the case-insensitive fallback is for a name typed back in with different capitalisation. */
export function nodeForName(
  nodes: readonly CategoryTreeNode[],
  name: string
): CategoryTreeNode | null {
  const want = name.trim();
  if (want === "") return null;
  return (
    nodes.find((n) => n.name === want) ??
    nodes.find((n) => n.name.toLowerCase() === want.toLowerCase()) ??
    null
  );
}

/**
 * Where the route must go after a category is RENAMED — or `null` to leave it alone.
 *
 * A category's URL identity is `slugFor(name, id)`, so its slug is derived from its name and
 * a rename necessarily invalidates every route built from the old one. Nothing else notices:
 * the old chain simply stops resolving, `resolveCategoryChain` returns a shorter chain, and
 * the rail falls back to `All` — the user renames the category they are looking at and is
 * silently dropped somewhere else, on a URL that no longer exists. Following the rename is
 * the only reading that matches what they did: they renamed this category, they did not
 * leave it.
 *
 * Only the renamed SEGMENT changes. Every descendant's slug comes from its OWN name, which
 * the rename did not touch, so a deeper chain keeps its tail: renaming "Work" while sitting
 * in `work/planning/q3` lands on `strategy/planning/q3`, still at the same place in the tree.
 *
 * Matched on `categoryKey` (the node's PATH), not its id: a category filed under two parents
 * is two nodes with one id, and only the one the user actually walked in through is the one
 * whose segment this chain carries. A node that is not on the chain at all — a rename driven
 * from somewhere other than the current selection — yields `null`, because that rename says
 * nothing about where the user is.
 *
 * The new segment comes from {@link freeSlugAmong}, not from `slugFor` alone: a slug is only
 * a name until the level has been de-collided, and a new name that collides with a sibling's
 * is one this function declines to predict.
 */
export function chainAfterRename(
  chainSlugs: readonly string[],
  chain: readonly CategoryNode[],
  roots: readonly CategoryNode[],
  renamed: CategoryNode,
  nextName: string
): string[] | null {
  const key = categoryKey(renamed);
  const at = chain.findIndex((node) => categoryKey(node) === key);
  if (at < 0 || at >= chainSlugs.length) return null;
  const siblings = at === 0 ? roots : (chain[at - 1]?.children ?? []);
  const slug = freeSlugAmong(siblings, renamed.id, nextName);
  if (slug === null || slug === chainSlugs[at]) return null;
  return [...chainSlugs.slice(0, at), slug, ...chainSlugs.slice(at + 1)];
}

/** The nodes from a root down to and including the first placement of `id`, or `null` when
 *  the forest holds no such category. FIRST placement, in sibling order: a category filed
 *  under two parents is drawn twice and either path reaches it, so the tie-break is the same
 *  deterministic one `resolveCategoryChain` and `buildCategoryTree` already use. */
function nodePathTo(
  roots: readonly CategoryNode[],
  id: string
): CategoryNode[] | null {
  for (const node of roots) {
    if (node.id === id) return [node];
    const below = nodePathTo(node.children, id);
    if (below) return [node, ...below];
  }
  return null;
}

/**
 * The slug `id` will carry among `siblings` once it is named `name` — or `null` when that
 * cannot be known from here.
 *
 * Both {@link chainAfterRename} and {@link chainAfterMove} have to predict a slug the NEXT
 * fold will assign, and a slug is only a name until {@link siblingSlugs} has seen the level:
 * two different sibling names can slugify the same, and the later twin is suffixed. Both
 * used to skip that step — `chainAfterRename` returned `slugFor(nextName, id)` and
 * `chainAfterMove` reused the slug the category carried under its OLD parent — so renaming
 * "Reports" to "My notes" beside a sibling actually named "my-notes" navigated to the
 * SIBLING's route, and moving a suffixed twin under a parent where its bare slug is free
 * navigated to a segment that resolves to nothing.
 *
 * When the base slug is free among the other siblings, the fold gives it to this category
 * whatever the order — first claimant, and there is no other claimant — so the answer is
 * exact. When it is NOT free, which twin keeps the bare slug depends on the level's ORDER,
 * and the write itself can change that order (siblings sort by `sortOrder`, then NAME, so a
 * rename can move a category past its twin). Guessing there would risk sending the user into
 * the OTHER category, which is worse than not moving: `null` leaves the route alone, the
 * stale chain degrades to the deepest ancestor that still resolves, and the user is one level
 * up looking at the list that contains what they just renamed.
 */
function freeSlugAmong(
  siblings: readonly CategoryNode[],
  id: string,
  name: string
): string | null {
  const base = slugFor(name, id);
  // By id, not by `categoryKey`: within ONE sibling list a category appears at most once, and
  // the moved node's key still spells its path under the parent it is leaving.
  const taken = siblings.some(
    (sib) => sib.id !== id && slugFor(sib.name, sib.id) === base
  );
  return taken ? null : base;
}

/**
 * Where the route must go after a category is MOVED — or `null` to leave it alone.
 *
 * The sibling of {@link chainAfterRename}, for the other write that expires the URL. A
 * rename re-slugs the segment; a move keeps every slug and re-parents the whole tail, so the
 * chain the user is standing on stops resolving from the segment ABOVE the moved category
 * downward — `resolveCategoryChain` walks children, and the moved category is no longer a
 * child of the parent the URL walked in through. Left alone, the user re-files a category
 * and is dropped to "All" on a URL that resolves to nothing, exactly the defect
 * `must-follow-a-rename-to-the-new-slug` was written against.
 *
 * The destination is the new parent's OWN chain, then the moved category, then whatever of
 * the old chain hung BELOW it — those descendants are untouched by the move, so they still
 * resolve under it wherever it now sits. For `parentId === null` the category becomes a
 * root — but ONLY when the filing being rewritten was its last one. A category filed
 * elsewhere as well does not become a root by losing this filing; it simply stops being
 * here, and the place it is still filed under is not something this move named. Predicting
 * one would send the user somewhere they did not ask to go, so that case yields `null` and
 * the stale chain degrades to the level they acted from — which is the honest answer, since
 * what they did was remove the category from that level. The moved category's own segment is
 * re-derived against its NEW siblings ({@link freeSlugAmong}) rather than carried over: slug
 * uniqueness is per level, so the slug it holds under the parent it is leaving is not
 * necessarily the one it will hold under the parent it is joining.
 *
 * Matched on `categoryKey` (the node's PATH), not its id, for {@link chainAfterRename}'s
 * reason: a category filed under two parents is two nodes with one id, and only the
 * placement the user actually walked in through is the one this chain carries. A move driven
 * from off the chain says nothing about where the user is, so it yields `null` — as does a
 * `parentId` naming no category in this forest, a destination where the moved category's slug
 * collides with a sibling's, an unfiling that leaves the category filed somewhere this move
 * did not name, and a move that would land on the chain already showing.
 *
 * `roots`/`chain` are the PRE-move forest, which is what the caller has: the new parent's own
 * ancestry is not what the move changed, so reading it from the old fold is exact.
 */
/**
 * The chain to select after `deleted` is removed, or `null` when the current chain is
 * unaffected and must be left exactly as it is.
 *
 * The third of the trio, and the one whose absence was a live bug: the delete handler used to
 * navigate to `chainSlugs.slice(0, -1)` unconditionally, which is neither depth-aware nor
 * membership-aware. Deleting an unrelated root while standing in `work/q3/reports` threw the
 * user up to `work/q3` — a level they were not in, for a category they had not touched — and
 * deleting `work` itself from level 0 sent them to `work/q3`, whose first segment no longer
 * resolves.
 *
 * Truncation is at the deleted node's OWN depth: everything below it is gone with it, and
 * everything above it still stands. Membership is tested on {@link categoryKey}, not on `id`,
 * for the same reason its two siblings do — a category filed under two parents is two nodes
 * sharing one id, and only one of them is the one on this chain. Deleting the other place it
 * is filed leaves this chain alone.
 */
export function chainAfterDelete(
  chainSlugs: readonly string[],
  chain: readonly CategoryNode[],
  deleted: CategoryNode
): string[] | null {
  const key = categoryKey(deleted);
  const at = chain.findIndex((node) => categoryKey(node) === key);
  if (at < 0 || at >= chainSlugs.length) return null;
  return chainSlugs.slice(0, at);
}

export function chainAfterMove(
  chainSlugs: readonly string[],
  chain: readonly CategoryNode[],
  roots: readonly CategoryNode[],
  moved: CategoryNode,
  parentId: string | null
): string[] | null {
  const key = categoryKey(moved);
  const at = chain.findIndex((node) => categoryKey(node) === key);
  if (at < 0 || at >= chainSlugs.length) return null;
  if (parentId === null) {
    // Unfiling, not rooting. The filing being rewritten is the one the URL walked in
    // through, which is `chain[at - 1]` (nothing, at the top level) — so what the category
    // is left filed under is every OTHER parent it carries. When that is not empty it is
    // still somewhere, just not here, and which of those places to send the user to is a
    // question this move did not answer. See the note above.
    const leaving = at === 0 ? null : chain[at - 1]?.id ?? null;
    const remaining = moved.parentIds.filter((id) => id !== leaving);
    if (remaining.length > 0) return null;
  }
  const destination = parentId === null ? [] : nodePathTo(roots, parentId);
  if (destination === null) return null;
  const above = destination.map((node) => node.slug);
  // The moved category's own segment is re-derived, not carried over: a slug is unique within
  // ONE level, so the one it holds under the parent it is LEAVING says nothing about the
  // level it is joining — a twin there can take it, and a suffix it only carried because of a
  // twin here is not its slug there. Everything BELOW it does carry over untouched: those
  // slugs are scoped to the moved category's own children, which the move did not reshape.
  const destinationSiblings =
    destination.length === 0 ? roots : destination[destination.length - 1]!.children;
  const slug = freeSlugAmong(destinationSiblings, moved.id, moved.name);
  if (slug === null) return null;
  const next = [...above, slug, ...chainSlugs.slice(at + 1)];
  if (next.join("/") === chainSlugs.join("/")) return null;
  return next;
}
