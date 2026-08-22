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
//   * The materialisation is capped ({@link MAX_TREE_NODES}). A wide DAG has exponentially
//     many paths, and a rail that hangs is worse than one that stops drawing.
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import type { NoteCategory } from "@agentic-toolkit/data/notes";

/**
 * How many nodes one fold may materialise. A DAG's path count is exponential in its depth
 * (ten categories each filed under the two above them is already a thousand paths), and the
 * rail renders paths. The cap is far above any hand-built taxonomy and far below a hang:
 * past it, expansion stops and the nodes already built still render.
 */
const MAX_TREE_NODES = 4000;

/** One category AT ONE PLACE in the forest, with its children attached. */
export interface CategoryNode {
  id: string;
  name: string;
  /** URL identity: `slugify(name)`, falling back to the id (see {@link slugFor}). */
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
 * so no row is ever lost.
 */
export function buildCategoryTree(rows: NoteCategory[]): CategoryNode[] {
  const byId = new Map<string, NoteCategory>();
  for (const row of rows) byId.set(row.id, row);

  // parent id → the rows filed under it, in the backend's order. Links to a row we can't
  // see, and a row filed under itself, are dropped here so nothing below has to re-check.
  const childrenOf = new Map<string, NoteCategory[]>();
  const visibleParents = (row: NoteCategory): string[] =>
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
  function materialise(row: NoteCategory, ancestors: string[], onPath: Set<string>): CategoryNode {
    drawn.add(row.id);
    budget -= 1;
    const path = [...ancestors, row.id];
    const node: CategoryNode = {
      id: row.id,
      name: row.name,
      slug: slugFor(row.name, row.id),
      parentIds: [...row.parentIds],
      path,
      children: [],
    };
    onPath.add(row.id);
    for (const child of childrenOf.get(row.id) ?? []) {
      if (budget <= 0) break;
      if (onPath.has(child.id)) continue;
      node.children.push(materialise(child, path, onPath));
    }
    onPath.delete(row.id);
    return node;
  }

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    if (visibleParents(row).length === 0) roots.push(materialise(row, [], new Set()));
  }
  // Anything still undrawn is filed only under categories that are themselves unreachable —
  // a cycle. Seeding the first such row in row order (and letting it draw its own subtree)
  // keeps the result deterministic and still shows every category exactly once.
  for (const row of rows) {
    if (!drawn.has(row.id)) roots.push(materialise(row, [], new Set()));
  }
  return roots;
}

/**
 * Resolve a slug chain against the forest, stopping at the first slug that names no child of
 * the level above. Returns the nodes it actually resolved, so a deep link to a renamed or
 * deleted category degrades to the deepest ancestor that still exists instead of showing
 * nothing.
 *
 * First match wins within a level. Two things can tie: `slugify` is not injective — "My
 * notes" and "my-notes" are different category names (the backend's uniqueness rule is on
 * the NAME) that produce one slug — and one category filed under two parents appears on
 * both their child lists, though never twice on the SAME one. Sibling order is the
 * backend's, so the pick is deterministic and stable across loads.
 */
export function resolveCategoryChain(roots: CategoryNode[], slugs: string[]): CategoryNode[] {
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
export function flattenCategoryTree(roots: CategoryNode[], depth = 0): FlatCategory[] {
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
export function categoryNames(rows: NoteCategory[]): string[] {
  return [...new Set(rows.map((row) => row.name))].sort((a, b) => a.localeCompare(b));
}
