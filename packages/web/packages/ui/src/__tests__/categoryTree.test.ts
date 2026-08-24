import { describe, it, expect } from "vitest";
import {
  buildCategoryTree,
  categoryKey,
  categoryNames,
  chainAfterDelete,
  chainAfterMove,
  chainAfterRename,
  flattenCategoryTree,
  MAX_TREE_NODES,
  resolveCategoryChain,
  slugFor,
  type CategoryNode,
  type CategoryTreeNode,
} from "../blocks/category-tree";

function row(
  id: string,
  name: string,
  ...parentIds: string[]
): CategoryTreeNode {
  return { id, name, parentIds };
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
    expect(ids(tree[0]!.children)).toEqual(["meetings"]);
    expect(ids(tree[0]!.children[0]!.children)).toEqual(["q3"]);
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
    expect(ids(tree[0]!.children)).toEqual(["q3"]);
    expect(ids(tree[1]!.children)).toEqual(["q3"]);
  });

  it("gives the two drawings of one category distinct paths", () => {
    // Its id repeats, so `path` is what a React key and a selection have to be built on.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("planning", "Planning"),
      row("q3", "Q3", "work", "planning"),
    ]);
    expect(categoryKey(tree[0]!.children[0]!)).toBe("work/q3");
    expect(categoryKey(tree[1]!.children[0]!)).toBe("planning/q3");
    expect(tree[0]!.children[0]!.parentIds).toEqual(["work", "planning"]);
  });

  it("draws a diamond's floor under both of its sides", () => {
    const tree = buildCategoryTree([
      row("top", "Top"),
      row("left", "Left", "top"),
      row("right", "Right", "top"),
      row("floor", "Floor", "left", "right"),
    ]);
    expect(ids(tree)).toEqual(["top"]);
    expect(ids(tree[0]!.children)).toEqual(["left", "right"]);
    expect(ids(tree[0]!.children[0]!.children)).toEqual(["floor"]);
    expect(ids(tree[0]!.children[1]!.children)).toEqual(["floor"]);
    expect(categoryKey(tree[0]!.children[1]!.children[0]!)).toBe(
      "top/right/floor"
    );
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
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("q3", "Q3", "gone", "work"),
    ]);
    expect(ids(tree)).toEqual(["work"]);
    expect(ids(tree[0]!.children)).toEqual(["q3"]);
  });

  it("breaks a cycle where it closes, keeping both categories visible", () => {
    // The backend refuses the edge that would close a loop, but a graph written before that
    // guard is still served. Neither row can be a root by the parent rule, so the second
    // pass seeds the first of them in row order and the walk stops when it returns.
    const tree = buildCategoryTree([row("a", "A", "b"), row("b", "B", "a")]);
    expect(ids(tree)).toEqual(["a"]);
    expect(ids(tree[0]!.children)).toEqual(["b"]);
    expect(tree[0]!.children[0]!.children).toEqual([]);
  });

  it("promotes a self-parented category to a root", () => {
    const tree = buildCategoryTree([row("loop", "Loop", "loop")]);
    expect(ids(tree)).toEqual(["loop"]);
    expect(tree[0]!.children).toEqual([]);
  });

  it("keeps a category hanging off a cycle in its place rather than losing it", () => {
    const tree = buildCategoryTree([
      row("a", "A", "b"),
      row("b", "B", "a"),
      row("child", "Child", "a"),
    ]);
    expect(ids(tree)).toEqual(["a"]);
    expect(ids(tree[0]!.children)).toEqual(["b", "child"]);
  });

  it("terminates on a graph with exponentially many paths, and stays bounded", () => {
    // Each level filed under the two above it: the path count grows like Fibonacci, so
    // thirty levels is millions of drawings. The cap is what makes this render at all.
    const rows: CategoryTreeNode[] = [row("c0", "c0"), row("c1", "c1", "c0")];
    for (let i = 2; i < 30; i++)
      rows.push(row(`c${i}`, `c${i}`, `c${i - 1}`, `c${i - 2}`));
    const flat = flattenCategoryTree(buildCategoryTree(rows));
    expect(flat.length).toBeGreaterThan(100);
    // The budget charges REPEAT drawings only, so the bound is the cap plus the one free
    // drawing each row is owed — never the cap alone.
    expect(flat.length).toBeLessThanOrEqual(MAX_TREE_NODES + rows.length);
    // Bounded, but never at the cost of a row: every category is still somewhere on screen.
    expect(new Set(flat.map(({ node }) => node.id)).size).toBe(rows.length);
  });

  it("draws every root of a forest that is WIDE rather than deep, past the cap", () => {
    // The depth test above builds ONE root with a 30-level chain, so the root-seeding loop
    // iterates exactly once. Here every row is its own root: 5000 of them, well past
    // MAX_TREE_NODES, and no row has a parent at all.
    //
    // A wide forest is not the explosion the cap exists for — 5000 roots is 5000 drawings,
    // linear in the data. The cap used to charge for them anyway, so a notebook with more
    // root categories than the cap simply lost every root past it: not truncated depth,
    // whole categories gone from the rail with no way to reach them. The budget now charges
    // repeat drawings only, so a row's FIRST drawing can never be the one that is skipped.
    const rows: CategoryTreeNode[] = [];
    for (let i = 0; i < 5000; i++) rows.push(row(`r${i}`, `r${i}`));
    const flat = flattenCategoryTree(buildCategoryTree(rows));
    expect(flat.length).toBe(5000);
    // And they are real, distinct rows in order — drawing them all must not corrupt them.
    expect(new Set(flat.map(({ node }) => node.id)).size).toBe(flat.length);
    expect(flat[0]!.node.id).toBe("r0");
    expect(flat.at(-1)!.node.id).toBe("r4999");
  });

  it("keeps drawing later roots after an earlier root exhausts the budget", () => {
    // The M2 failure in miniature, and the one a 5000-root forest cannot show: the FIRST
    // root is a DAG dense enough to burn the whole repeat budget on its own, and a plain
    // second root follows it. Charging first drawings let the explosion above starve the
    // sibling below, which is the wrong row to lose — it costs one drawing.
    const rows: CategoryTreeNode[] = [row("c0", "c0"), row("c1", "c1", "c0")];
    for (let i = 2; i < 30; i++)
      rows.push(row(`c${i}`, `c${i}`, `c${i - 1}`, `c${i - 2}`));
    rows.push(row("later", "Later"));
    const tree = buildCategoryTree(rows);
    expect(ids(tree)).toEqual(["c0", "later"]);
  });

  it("disambiguates siblings whose names slugify to the same thing", () => {
    // A slug is what the URL carries, so two siblings that slugify alike are two rows
    // sharing one address: resolveCategoryChain hands both URLs to whichever came first,
    // and the second category is unreachable. The first claimant keeps the bare slug so
    // no address anyone already holds moves.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("a", "Q3 Plans", "work"),
      row("b", "q3-plans", "work"),
      row("c", "Q3 / Plans", "work"),
    ]);
    expect(tree[0]!.children.map((node) => node.slug)).toEqual([
      "q3-plans",
      "q3-plans-2",
      "q3-plans-3",
    ]);
  });

  it("scopes slug disambiguation to one parent, so a cousin keeps the bare slug", () => {
    // Uniqueness only has to hold among the rows a single chain segment chooses between.
    // Making it global would move addresses in a branch nobody touched.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("home", "Home"),
      row("a", "Notes", "work"),
      row("b", "Notes", "home"),
    ]);
    expect(tree[0]!.children[0]!.slug).toBe("notes");
    expect(tree[1]!.children[0]!.slug).toBe("notes");
  });

  it("disambiguates roots the same way it disambiguates siblings", () => {
    // The roots are one another's siblings, across BOTH seeding passes: the promoted
    // orphan in the second pass shares the first pass's slug scope.
    const tree = buildCategoryTree([
      row("a", "Archive"),
      row("b", "archive"),
      row("c", "Archive", "missing"),
    ]);
    expect(tree.map((node) => node.slug)).toEqual([
      "archive",
      "archive-2",
      "archive-3",
    ]);
  });

  it("routes each colliding sibling to its own category", () => {
    // The point of the suffix: both URLs resolve, and to different rows.
    const tree = buildCategoryTree([
      row("work", "Work"),
      row("a", "Q3 Plans", "work"),
      row("b", "q3-plans", "work"),
    ]);
    expect(
      resolveCategoryChain(tree, ["work", "q3-plans"]).at(-1)!.id
    ).toBe("a");
    expect(
      resolveCategoryChain(tree, ["work", "q3-plans-2"]).at(-1)!.id
    ).toBe("b");
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
    expect(ids(resolveCategoryChain(tree, ["work", "meetings", "q3"]))).toEqual(
      ["work", "meetings", "q3"]
    );
  });

  it("stops at the first slug that names no child of the level above", () => {
    // A renamed or deleted category degrades to the deepest ancestor that still exists,
    // rather than showing nothing.
    expect(ids(resolveCategoryChain(tree, ["work", "gone", "q3"]))).toEqual([
      "work",
    ]);
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
    expect(ids(resolveCategoryChain(dag, ["planning", "q3"]))).toEqual([
      "planning",
      "q3",
    ]);
    expect(categoryKey(resolveCategoryChain(dag, ["planning", "q3"])[1]!)).toBe(
      "planning/q3"
    );
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
    expect(
      flattenCategoryTree(tree).map(({ node, depth }) => [node.id, depth])
    ).toEqual([
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
    expect(
      flattenCategoryTree(tree).map(({ node }) => categoryKey(node))
    ).toEqual(["work", "work/q3", "planning", "planning/q3"]);
  });

  it("shows a category whose parent is missing, as a root", () => {
    // Same rule the fold applies: a corrupt link costs the row its PLACEMENT, never its
    // existence — and the management view is exactly where that has to stay reachable.
    expect(
      flattenCategoryTree(buildCategoryTree([row("b", "Orphan", "gone")]))
    ).toEqual([{ node: expect.objectContaining({ id: "b" }), depth: 0 }]);
  });

  it("is empty for an empty forest", () => {
    expect(flattenCategoryTree([])).toEqual([]);
  });
});

describe("categoryNames", () => {
  it("lists every name alphabetically, deduped", () => {
    expect(
      categoryNames([
        row("a", "Work"),
        row("b", "Meetings", "a"),
        row("c", "Work"),
      ])
    ).toEqual(["Meetings", "Work"]);
  });
});

/**
 * A rename EXPIRES the route. Selection identity is the category's slug and the slug is
 * derived from its name, so the URL the user is standing on stops resolving the moment they
 * rename what they are standing in — and the rail, finding nothing, quietly falls back to
 * `All`. Following the rename is the fix; these pin both halves of it, including the half
 * that must NOT happen.
 */
describe("chainAfterRename", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "plan", name: "Planning", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work"] },
  ];
  const tree = buildCategoryTree(rows);
  const work = tree.find((n) => n.id === "work")!;
  const q3 = work.children[0]!;

  it("swaps the renamed segment and keeps the rest of the chain", () => {
    // Renaming an ANCESTOR: every descendant slug comes from its own name, which the rename
    // did not touch, so the tail rides along and the user stays where they were in the tree.
    expect(
      chainAfterRename(["work", "q3"], [work, q3], tree, work, "Strategy")
    ).toEqual(["strategy", "q3"]);
  });

  it("follows a rename of the deepest segment", () => {
    expect(chainAfterRename(["work", "q3"], [work, q3], tree, q3, "Q4")).toEqual([
      "work",
      "q4",
    ]);
  });

  it("leaves the route alone when the renamed category is not on the chain", () => {
    const planning = tree.find((n) => n.id === "plan")!;
    expect(
      chainAfterRename(["work", "q3"], [work, q3], tree, planning, "Roadmap")
    ).toBeNull();
  });

  it("leaves the route alone when the slug does not actually change", () => {
    // "Work" and "WORK!" slugify identically. Navigating to the URL already showing would
    // push a redundant history entry for a rename the address bar cannot even display.
    expect(chainAfterRename(["work"], [work], tree, work, "WORK!")).toBeNull();
  });

  it("falls back to the id for a name that slugifies to nothing", () => {
    // `slugFor`'s contract, followed rather than re-derived: a punctuation-only name has no
    // slug, and an unaddressable category is worse than an ugly URL. Needs a row whose id is
    // NOT already its slug, or the fallback is indistinguishable from no change at all.
    const forest = buildCategoryTree([
      { id: "c-17", name: "Work", parentIds: [] },
    ]);
    expect(chainAfterRename(["work"], forest, forest, forest[0]!, "***")).toEqual([
      "c-17",
    ]);
  });

  it("declines to predict a rename onto a sibling's slug", () => {
    // "My notes" and "my-notes" are two different names — the backend's uniqueness rule is on
    // the NAME — that slugify identically, so `siblingSlugs` will suffix one of them. WHICH
    // one depends on the level's order, and the rename itself can change that order (siblings
    // sort by `sortOrder`, then name). Predicting the bare slug here would have navigated
    // into the OTHER category; `null` leaves the route alone and the stale chain degrades to
    // the level above, which is the list holding what was just renamed.
    const forest = buildCategoryTree([
      { id: "work", name: "Work", parentIds: [] },
      { id: "notes", name: "my-notes", parentIds: [] },
    ]);
    const w = forest.find((n) => n.id === "work")!;
    expect(chainAfterRename(["work"], [w], forest, w, "My notes")).toBeNull();
  });

  it("de-collides within the level only, not across the forest", () => {
    // The same name one level down is not a collision: slugs are unique per LEVEL, and the
    // chain resolves one level at a time. Scoping this to the whole forest would refuse to
    // follow renames that are perfectly addressable.
    const forest = buildCategoryTree([
      { id: "work", name: "Work", parentIds: [] },
      { id: "notes", name: "my-notes", parentIds: [] },
      { id: "q3", name: "Q3", parentIds: ["work"] },
    ]);
    const w = forest.find((n) => n.id === "work")!;
    const child = w.children[0]!;
    expect(
      chainAfterRename(["work", "q3"], [w, child], forest, child, "My notes")
    ).toEqual(["work", "my-notes"]);
  });
});

/** A move expires the route exactly as a rename does — the slugs all survive, but the chain
 *  above the moved segment stops naming its parent. */
describe("chainAfterMove", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "archive", name: "Archive", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work"] },
    { id: "budget", name: "Budget", parentIds: ["q3"] },
  ];
  const roots = buildCategoryTree(rows);
  const work = roots.find((n) => n.id === "work")!;
  const archive = roots.find((n) => n.id === "archive")!;
  const q3 = work.children[0]!;
  const budget = q3.children[0]!;

  it("splices the new parent's chain in front of the moved segment and its tail", () => {
    // Moving Work (the ROOT level's gear) under Archive, from three segments deep.
    expect(
      chainAfterMove(
        ["work", "q3", "budget"],
        [work, q3, budget],
        roots,
        work,
        "archive"
      )
    ).toEqual(["archive", "work", "q3", "budget"]);
  });

  it("keeps the tail when a middle segment moves", () => {
    expect(
      chainAfterMove(["work", "q3"], [work, q3], roots, q3, "archive")
    ).toEqual(["archive", "q3"]);
  });

  it("drops everything above the category when it becomes a root", () => {
    expect(
      chainAfterMove(
        ["work", "q3", "budget"],
        [work, q3, budget],
        roots,
        q3,
        null
      )
    ).toEqual(["q3", "budget"]);
  });

  it("leaves the route alone when the moved category is not on the chain", () => {
    // A move driven from off the current chain says nothing about where the user is standing.
    expect(
      chainAfterMove(["archive"], [archive], roots, q3, "archive")
    ).toBeNull();
  });

  it("leaves the route alone when the destination is not in the forest", () => {
    expect(
      chainAfterMove(["work", "q3"], [work, q3], roots, q3, "gone")
    ).toBeNull();
  });

  it("leaves the route alone when the chain would not change", () => {
    // Moving a root to the top level it is already at: a navigation that pushes a history
    // entry for a URL identical to the one showing.
    expect(
      chainAfterMove(["work", "q3"], [work, q3], roots, work, null)
    ).toBeNull();
  });

  it("re-derives the moved segment against its new siblings", () => {
    // "Q 3" and "Q-3" slugify the same, so under Work the second twin carries `q-3-2`. That
    // suffix is a fact about the level it is LEAVING: under Archive the bare slug is free, so
    // that is what the next fold will give it. Carrying `q-3-2` over would have navigated to a
    // segment naming no child of Archive at all.
    const forest = buildCategoryTree([
      { id: "work", name: "Work", parentIds: [] },
      { id: "archive", name: "Archive", parentIds: [] },
      { id: "q3", name: "Q 3", parentIds: ["work"] },
      { id: "q3b", name: "Q-3", parentIds: ["work"] },
    ]);
    const w = forest.find((n) => n.id === "work")!;
    const twin = w.children.find((n) => n.id === "q3b")!;
    expect(twin.slug).toBe("q-3-2");
    expect(
      chainAfterMove(["work", "q-3-2"], [w, twin], forest, twin, "archive")
    ).toEqual(["archive", "q-3"]);
  });

  it("does not call a category a root when it is still filed somewhere else", () => {
    // The `null` destination is the picker's "no parent" row, and it means REMOVE THIS FILING
    // — not "make this a root". Q3 is filed under Work AND Planning, so unfiling it from Work
    // leaves it under Planning; `["q3", "budget"]` would be a route to a root that does not
    // exist, resolving to nothing and dropping the user to All. Planning/Q3 is where it still
    // lives, but this move did not name Planning — so the honest answer is to leave the route
    // alone and let it degrade to Work, the level the user just took it out of.
    const forest = buildCategoryTree([
      { id: "work", name: "Work", parentIds: [] },
      { id: "plan", name: "Planning", parentIds: [] },
      { id: "q3", name: "Q3", parentIds: ["work", "plan"] },
      { id: "budget", name: "Budget", parentIds: ["q3"] },
    ]);
    const w = forest.find((n) => n.id === "work")!;
    const under = w.children[0]!;
    const kid = under.children[0]!;
    expect(
      chainAfterMove(["work", "q3", "budget"], [w, under, kid], forest, under, null)
    ).toBeNull();
    // The single-filing case is untouched: that one really does become a root.
    expect(
      chainAfterMove(["work", "q3", "budget"], [work, q3, budget], roots, q3, null)
    ).toEqual(["q3", "budget"]);
  });

  it("still roots a category unfiled from the only parent the chain names", () => {
    // Filed under Work twice over is not a thing, but filed under Work while the CHAIN walked
    // in through Work is: `parentIds` carries `work`, and the filing being removed is `work`,
    // so nothing remains and the root prediction is exact. This pins that the filter subtracts
    // the departing parent rather than merely counting `parentIds`.
    expect(
      chainAfterMove(["work", "q3"], [work, q3], roots, q3, null)
    ).toEqual(["q3"]);
  });

  it("declines to predict a move into a level where the slug is taken", () => {
    // Archive already holds a category whose name slugifies to `q-3`, so which twin keeps the
    // bare slug is decided by the destination's order once the write lands. Leaving the route
    // alone degrades to Work, which is where the user was; guessing could have opened the
    // stranger.
    const forest = buildCategoryTree([
      { id: "work", name: "Work", parentIds: [] },
      { id: "archive", name: "Archive", parentIds: [] },
      { id: "q3", name: "Q 3", parentIds: ["work"] },
      { id: "other", name: "Q-3", parentIds: ["archive"] },
    ]);
    const w = forest.find((n) => n.id === "work")!;
    const child = w.children[0]!;
    expect(
      chainAfterMove(["work", "q-3"], [w, child], forest, child, "archive")
    ).toBeNull();
  });
});

describe("chainAfterDelete", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "archive", name: "Archive", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work", "archive"] },
    { id: "budget", name: "Budget", parentIds: ["q3"] },
  ];
  const roots = buildCategoryTree(rows);
  const work = roots.find((n) => n.id === "work")!;
  const archive = roots.find((n) => n.id === "archive")!;
  const q3 = work.children[0]!;
  const budget = q3.children[0]!;

  it("truncates at the deleted segment's own depth, not by one level", () => {
    // Deleting the MIDDLE of three: everything under Q3 goes with it, and Work stays.
    // Dropping one level would have left "work/q3", whose last segment is gone.
    expect(
      chainAfterDelete(["work", "q3", "budget"], [work, q3, budget], q3)
    ).toEqual(["work"]);
  });

  it("returns to the root list when a root is deleted", () => {
    expect(
      chainAfterDelete(["work", "q3", "budget"], [work, q3, budget], work)
    ).toEqual([]);
  });

  it("drops only the last segment when the deepest segment is deleted", () => {
    expect(
      chainAfterDelete(["work", "q3", "budget"], [work, q3, budget], budget)
    ).toEqual(["work", "q3"]);
  });

  it("leaves the route alone when the deleted category is not on the chain", () => {
    // The old slice(0, -1) threw the user up a level for a category they were not in.
    expect(
      chainAfterDelete(["work", "q3"], [work, q3], archive)
    ).toBeNull();
  });

  it("leaves the route alone when another filing of the category is deleted", () => {
    // Q3 is filed under both Work and Archive, so it is two nodes sharing one id. The
    // chain runs through the Work one; deleting the Archive drawing is a different node
    // and must not move the user. Matching on id would have truncated the wrong chain.
    expect(
      chainAfterDelete(
        ["work", "q3", "budget"],
        [work, q3, budget],
        archive.children[0]!
      )
    ).toBeNull();
  });

  it("leaves the route alone when the chain is shorter than its resolved nodes", () => {
    // A defensive twin of its siblings' guard: a chain resolved deeper than the slugs
    // that produced it cannot be truncated coherently.
    expect(chainAfterDelete([], [work], work)).toBeNull();
  });
});
