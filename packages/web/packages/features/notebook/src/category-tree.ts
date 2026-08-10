// Folding the owner's flat category rows into the TREE the notebook rail navigates.
//
// The backend stores one row per category with a `parentId` pointer and NO foreign key —
// the hierarchy is an application convention, not a database constraint. So this fold has
// to survive a parent pointer that names a row it can't see (another workspace's, or a
// deleted one) and one that closes a loop: `POST /content/markdown/categories` can't
// create either (it never re-parents an existing row, so a fresh row can never be its own
// ancestor), but the generic `/content/categories` CRUD writes the same table and can.
//
// The rule for both defects is the same: the category becomes a ROOT. Never drop it —
// a corrupt pointer must cost the user the row's PLACEMENT, never its existence, or
// notes would sit in a category that has vanished from the rail.
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import type { NoteCategory } from "@agentic-toolkit/data/notes";

/** One category with its children attached — the shape the rail levels walk. */
export interface CategoryNode {
  id: string;
  name: string;
  /** URL identity: `slugify(name)`, falling back to the id (see {@link slugFor}). */
  slug: string;
  parentId: string | null;
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
 * True when attaching a child under `parent` would close a loop — i.e. walking up from
 * `parent` reaches `childId`. The walk is bounded by the node count, so a loop that
 * already exists among the ANCESTORS (which no amount of looking at this one edge would
 * reveal) terminates too, and is reported as a cycle.
 */
function wouldCycle(
  parent: CategoryNode,
  childId: string,
  nodes: Map<string, CategoryNode>,
): boolean {
  let cursor: CategoryNode | undefined = parent;
  for (let steps = 0; steps <= nodes.size; steps++) {
    if (!cursor) return false; // reached a root: the chain is finite and clean
    if (cursor.id === childId) return true;
    cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
  }
  return true; // walked further than there are nodes — the ancestor chain loops
}

/**
 * Fold the owner's categories into a forest of roots. Sibling order is the backend's
 * (`sortOrder`, then name), preserved because a Map iterates in insertion order and the
 * rows arrive already sorted.
 */
export function buildCategoryTree(rows: NoteCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: slugFor(row.name, row.id),
      parentId: row.parentId,
      children: [],
    });
  }
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && !wouldCycle(parent, node.id, nodes)) parent.children.push(node);
    else roots.push(node); // no parent, an unseen parent, or a cycle — see the header
  }
  return roots;
}

/**
 * Resolve a slug chain against the tree, stopping at the first slug that names no child of
 * the level above. Returns the nodes it actually resolved, so a deep link to a renamed or
 * deleted category degrades to the deepest ancestor that still exists instead of showing
 * nothing.
 *
 * First match wins within a level. `slugify` is not injective — "My notes" and "my-notes"
 * are different category names (the backend's uniqueness rule is on the NAME) that produce
 * one slug — and sibling order is the backend's, so the pick is at least deterministic and
 * stable across loads.
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

/** One row of a flattened tree: the node and how deep it sits. */
export interface FlatCategory {
  node: CategoryNode;
  depth: number;
}

/**
 * Walk the forest depth-first into a flat, indent-carrying list — what a MANAGEMENT view
 * needs, where every category is on screen at once rather than one level at a time. The
 * rail walks the same tree the other way (one level per depth), so both readings come from
 * the single fold above and cannot disagree about a corrupt parent pointer.
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
 * per owner across the whole tree; that rule is exactly what lets a note carry its
 * category as a bare string while the rail shows it in its place.
 */
export function categoryNames(rows: NoteCategory[]): string[] {
  return [...new Set(rows.map((row) => row.name))].sort((a, b) => a.localeCompare(b));
}
