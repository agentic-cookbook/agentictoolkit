import { type CategoryNode } from "@agenticdevelopertoolkit/ui/blocks";

/**
 * The rail's three reserved URL tokens — the separator between a category chain and the id
 * that follows it, and the root list's two synthetic rows ("All" and "Uncategorized").
 *
 * They are DECLARED one file down, in `./chain`, and re-exported here so that every import
 * site that already names `category-scope` (and the `@agentic-toolkit/categories` barrel above
 * it) keeps working unchanged. The reason for the extra file is not organisational, it is a
 * build fact: this module imports `@agenticdevelopertoolkit/ui/blocks` and the barrel that re-exports
 * it opens with `"use client"`, so everything reachable from here is a client module. A
 * constant imported from a client module into an RSC is an opaque client reference, not a
 * string — `indexOf(CHAIN_SEPARATOR)` then never matches and every research/notebook deep link
 * silently resolves to the empty list. `./chain` imports nothing at all, ships as its own
 * directive-free chunk on the `./chain` subpath, and is what the two `parse-path.ts` modules
 * import. See the header of `./chain` for the full account; keep the values there.
 */
export { CHAIN_SEPARATOR, ALL_CATEGORIES_ID, UNCATEGORIZED_SLUG } from "./chain";
// A separate import (a re-export alone creates no local binding) so `scopeFor` below can still
// read the uncategorized slug by name.
import { UNCATEGORIZED_SLUG } from "./chain";

/**
 * What the item list below the category rail should show.
 *
 * A DISCRIMINATED UNION, not a widened record with an optional `name`. Every consumer
 * narrows on `kind` and then reads `name`, so in the `named` arm `name` must be `string`
 * and not `string | undefined` — `resolveListCategory` below assigns it straight into a
 * `query: string`, which a `name?: string` shape does not satisfy. The chain is NOT a
 * member here; the hook returns it as its own field.
 */
export type CategoryScope =
  | { kind: "all" }
  | { kind: "uncategorized" }
  /** `name` is the category's NAME, which is what the backend's `?category=` filter takes
   *  (an exact match: a category lists what is filed DIRECTLY under it, not its
   *  descendants). */
  | { kind: "named"; name: string };

export function scopeFor(
  chainSlugs: readonly string[],
  chain: CategoryNode[]
): CategoryScope {
  if (chainSlugs[0] === UNCATEGORIZED_SLUG) return { kind: "uncategorized" };
  const deepest = chain[chain.length - 1];
  if (!deepest) return { kind: "all" };
  return { kind: "named", name: deepest.name };
}

/** Where in the notebook the RAIL is standing. `all` is the whole notebook; `uncategorized`
 *  is the rail row for notes filed nowhere; `named` is a category chain's leaf. */
export interface ListCategoryQuery {
  /** The one `?category=` name the request carries — `""` for no category parameter. */
  query: string;
  /** Keep only notes with NO category. The backend has no parameter for this axis (a blank
   *  `category` means "don't filter"), so the caller applies it to the rows it gets back. */
  uncategorizedOnly: boolean;
  /** The two axes contradict each other, so nothing can match and no request is worth making. */
  empty: boolean;
}

/**
 * Fold the rail's SCOPE and the button bar's category FILTER into one list query.
 *
 * They are two different questions — "which part of the notebook am I in" and "narrow that to
 * this category" — but both are exact category names, and a note has exactly one category. So
 * two DIFFERENT names intersect to nothing. That is reported as `empty` rather than letting one
 * axis quietly win: a user who scoped to Work and then filtered to Personal asked for notes in
 * both, and an empty list is the true answer. Silently showing one or the other would look like
 * a working filter that ignores half of what was asked.
 */
export function resolveListCategory(
  scope: CategoryScope,
  filter: string
): ListCategoryQuery {
  const narrowed = filter.trim();
  const none = { query: "", uncategorizedOnly: false, empty: false };
  if (scope.kind === "uncategorized") {
    // A note in a named category is by definition not uncategorized.
    if (narrowed) return { ...none, empty: true };
    return { ...none, uncategorizedOnly: true };
  }
  if (scope.kind === "all")
    return narrowed ? { ...none, query: narrowed } : none;
  if (!narrowed) return { ...none, query: scope.name };
  if (narrowed.toLowerCase() === scope.name.toLowerCase())
    return { ...none, query: scope.name };
  return { ...none, empty: true };
}

/**
 * The two route-following helpers live one layer DOWN, in `@agenticdevelopertoolkit/ui/blocks`
 * beside `resolveCategoryChain` and `slugFor` — the functions whose contracts they follow.
 * They are pure functions over a forest and a slug chain with no notion of a notebook, a
 * list query, or a network, so `blocks` is where they belong; keeping them here would have
 * made them unreachable from anything that does not link this feature package (the
 * ui-showcase demo among them, which was left hand-mirroring `chainAfterRename` and drifted
 * out of agreement with it).
 *
 * Re-exported rather than relocated silently: `category-scope` is the import site every
 * consumer already names, and the pair reads as part of this module's story.
 */
export { chainAfterRename, chainAfterMove, chainAfterDelete } from "@agenticdevelopertoolkit/ui/blocks";
