import { describe, it, expect } from "vitest";
import type { NoteCategory } from "@agentic-toolkit/data/notes";
import {
  buildCategoryTree,
  categoryKey,
  categoryNames,
  flattenCategoryTree,
  resolveCategoryChain,
  slugFor,
  type CategoryNode,
} from "./category-tree";

function row(id: string, name: string, ...parentIds: string[]): NoteCategory {
  return { id, name, parentIds, sortOrder: 0 };
}

/** Ids of a level, so a shape assertion reads as the rail would render it. */
function ids(nodes: CategoryNode[]): string[] {
  return nodes.map((node) => node.id);
}

describe("slugFor", () => {
  it("slugifies the name", () => {
    expect(slugFor("Team Meetings", "cat-1")).toBe("team-meetings");
  });

  it("falls back to the id when the name slugifies to nothing", () => {
    // Otherwise the category would be unaddressable: an empty segment is dropped by both
    // the parser and the router, so its URL would be its parent's.
    expect(slugFor("***", "cat-1")).toBe("cat-1");
    expect(slugFor("   ", "cat-1")).toBe("cat-1");
  });
});

describe("buildCategoryTree", () => {
  it("nests children under their parent and returns only the roots", () => {
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("meetings", "Meetings", "work"),
      row("q3", "Q3", "meetings"),
      row("personal", "Personal"),
    ]);
    expect(ids(tree)).toEqual(["work", "personal"]);
    expect(ids(tree[0].children)).toEqual(["meetings"]);
    expect(ids(tree[0].children[0].children)).toEqual(["q3"]);
  });

  it("draws a category under EVERY parent it is filed under", () => {
    // The whole point of the DAG: "Q3" is genuinely filed in two places, and is reachable
    // from either. Nothing here picks a winner — there is no primary parent.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("planning", "Planning"),
      row("q3", "Q3", "work", "planning"),
    ]);
    expect(ids(tree)).toEqual(["work", "planning"]);
    expect(ids(tree[0].children)).toEqual(["q3"]);
    expect(ids(tree[1].children)).toEqual(["q3"]);
  });

  it("gives the two drawings of one category distinct paths", () => {
    // Its id repeats, so `path` is what a React key and a selection have to be built on.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("planning", "Planning"),
      row("q3", "Q3", "work", "planning"),
    ]);
    expect(categoryKey(tree[0].children[0])).toBe("work/q3");
    expect(categoryKey(tree[1].children[0])).toBe("planning/q3");
    expect(tree[0].children[0].parentIds).toEqual(["work", "planning"]);
  });

  it("draws a diamond's floor under both of its sides", () => {
    const tree = buildCategoryTree([
      row("top", "Top"),
      row("left", "Left", "top"),
      row("right", "Right", "top"),
      row("floor", "Floor", "left", "right"),
    ]);
    expect(ids(tree)).toEqual(["top"]);
    expect(ids(tree[0].children)).toEqual(["left", "right"]);
    expect(ids(tree[0].children[0].children)).toEqual(["floor"]);
    expect(ids(tree[0].children[1].children)).toEqual(["floor"]);
    expect(categoryKey(tree[0].children[1].children[0])).toBe("top/right/floor");
  });

  it("preserves the backend's sibling order", () => {
    const tree = buildCategoryTree([row("b", "Beta"), row("a", "Alpha")]);
    expect(ids(tree)).toEqual(["b", "a"]);
  });

  it("promotes a category whose every parent is missing from the rows to a root", () => {
    // A link to another owner's row, or one deleted between the two reads. The category
    // keeps its notes, so it must keep a place in the rail.
    const tree = buildCategoryTree([row("orphan", "Orphan", "missing")]);
    expect(ids(tree)).toEqual(["orphan"]);
  });

  it("files a category under its surviving parent when only one link is broken", () => {
    // Not a root: one real parent is still a placement, so promoting it would move a
    // category the user can see perfectly well.
    const tree = buildCategoryTree([row("work", "Work"), row("q3", "Q3", "gone", "work")]);
    expect(ids(tree)).toEqual(["work"]);
    expect(ids(tree[0].children)).toEqual(["q3"]);
  });

  it("breaks a cycle where it closes, keeping both categories visible", () => {
    // The backend refuses the edge that would close a loop, but a graph written before that
    // guard is still served. Neither row can be a root by the parent rule, so the second
    // pass seeds the first of them in row order and the walk stops when it returns.
    const tree = buildCategoryTree([row("a", "A", "b"), row("b", "B", "a")]);
    expect(ids(tree)).toEqual(["a"]);
    expect(ids(tree[0].children)).toEqual(["b"]);
    expect(tree[0].children[0].children).toEqual([]);
  });

  it("promotes a self-parented category to a root", () => {
    const tree = buildCategoryTree([row("loop", "Loop", "loop")]);
    expect(ids(tree)).toEqual(["loop"]);
    expect(tree[0].children).toEqual([]);
  });

  it("keeps a category hanging off a cycle in its place rather than losing it", () => {
    const tree = buildCategoryTree([
      row("a", "A", "b"),
      row("b", "B", "a"),
      row("child", "Child", "a"),
    ]);
    expect(ids(tree)).toEqual(["a"]);
    expect(ids(tree[0].children)).toEqual(["b", "child"]);
  });

  it("terminates on a graph with exponentially many paths, and stays bounded", () => {
    // Each level filed under the two above it: the path count grows like Fibonacci, so
    // thirty levels is millions of drawings. The cap is what makes this render at all.
    const rows: NoteCategory[] = [row("c0", "c0"), row("c1", "c1", "c0")];
    for (let i = 2; i < 30; i++) rows.push(row(`c${i}`, `c${i}`, `c${i - 1}`, `c${i - 2}`));
    const flat = flattenCategoryTree(buildCategoryTree(rows));
    expect(flat.length).toBeGreaterThan(100);
    expect(flat.length).toBeLessThanOrEqual(4000);
    // Bounded, but never at the cost of a row: every category is still somewhere on screen.
    expect(new Set(flat.map(({ node }) => node.id)).size).toBe(rows.length);
  });

  it("returns nothing for no rows", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});

describe("resolveCategoryChain", () => {
  const tree = buildCategoryTree([
    row("work", "Work"),
    row("meetings", "Meetings", "work"),
    row("q3", "Q3", "meetings"),
    row("personal", "Personal"),
  ]);

  it("resolves a full chain, outermost first", () => {
    expect(ids(resolveCategoryChain(tree, ["work", "meetings", "q3"]))).toEqual([
      "work",
      "meetings",
      "q3",
    ]);
  });

  it("stops at the first slug that names no child of the level above", () => {
    // A renamed or deleted category degrades to the deepest ancestor that still exists,
    // rather than showing nothing.
    expect(ids(resolveCategoryChain(tree, ["work", "gone", "q3"]))).toEqual(["work"]);
  });

  it("resolves nothing when the first slug is unknown", () => {
    expect(resolveCategoryChain(tree, ["gone"])).toEqual([]);
  });

  it("refuses to match a slug across levels", () => {
    // "meetings" is real, but not at the root — a chain names a PATH, not a set.
    expect(resolveCategoryChain(tree, ["meetings"])).toEqual([]);
  });

  it("follows the parent the URL actually names, for a category filed twice", () => {
    // Both chains end at the same category; which one the user is IN is the difference
    // between the two breadcrumbs, so the chain carries the parent that got them there.
    const dag = buildCategoryTree([
      row("work", "Work"),
      row("planning", "Planning"),
      row("q3", "Q3", "work", "planning"),
    ]);
    expect(ids(resolveCategoryChain(dag, ["planning", "q3"]))).toEqual(["planning", "q3"]);
    expect(categoryKey(resolveCategoryChain(dag, ["planning", "q3"])[1])).toBe("planning/q3");
  });

  it("resolves the empty chain to the whole notebook", () => {
    expect(resolveCategoryChain(tree, [])).toEqual([]);
  });
});

describe("flattenCategoryTree", () => {
  it("walks depth-first, carrying each node's depth", () => {
    // Parent immediately followed by its own subtree — what the manager dialog indents by.
    const tree = buildCategoryTree([
      row("a", "Work"),
      row("b", "Meetings", "a"),
      row("c", "Q3", "b"),
      row("d", "Personal"),
    ]);
    expect(flattenCategoryTree(tree).map(({ node, depth }) => [node.id, depth])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 0],
    ]);
  });

  it("lists a multi-parent category once per filing", () => {
    // Not a bug to dedupe: each row is a real link, and unfiling one leaves the other.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("planning", "Planning"),
      row("q3", "Q3", "work", "planning"),
    ]);
    expect(flattenCategoryTree(tree).map(({ node }) => categoryKey(node))).toEqual([
      "work",
      "work/q3",
      "planning",
      "planning/q3",
    ]);
  });

  it("shows a category whose parent is missing, as a root", () => {
    // Same rule the fold applies: a corrupt link costs the row its PLACEMENT, never its
    // existence — and the management view is exactly where that has to stay reachable.
    expect(flattenCategoryTree(buildCategoryTree([row("b", "Orphan", "gone")]))).toEqual([
      { node: expect.objectContaining({ id: "b" }), depth: 0 },
    ]);
  });

  it("is empty for an empty forest", () => {
    expect(flattenCategoryTree([])).toEqual([]);
  });
});

describe("categoryNames", () => {
  it("lists every name alphabetically, deduped", () => {
    expect(
      categoryNames([row("a", "Work"), row("b", "Meetings", "a"), row("c", "Work")]),
    ).toEqual(["Meetings", "Work"]);
  });
});
