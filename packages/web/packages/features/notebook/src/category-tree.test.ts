import { describe, it, expect } from "vitest";
import type { NoteCategory } from "@agentic-toolkit/data/notes";
import {
  buildCategoryTree,
  categoryNames,
  resolveCategoryChain,
  slugFor,
  type CategoryNode,
} from "./category-tree";

function row(id: string, name: string, parentId: string | null = null): NoteCategory {
  return { id, name, parentId, sortOrder: 0 };
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

  it("preserves the backend's sibling order", () => {
    const tree = buildCategoryTree([row("b", "Beta"), row("a", "Alpha")]);
    expect(ids(tree)).toEqual(["b", "a"]);
  });

  it("promotes a category whose parent isn't in the rows to a root", () => {
    // A pointer to another owner's row, or one that has been deleted. The category keeps
    // its notes, so it must keep a place in the rail.
    const tree = buildCategoryTree([row("orphan", "Orphan", "missing")]);
    expect(ids(tree)).toEqual(["orphan"]);
  });

  it("promotes a category in a cycle to a root instead of losing it", () => {
    // The generic /content/categories CRUD can write these; the notebook's own POST can't.
    const tree = buildCategoryTree([row("a", "A", "b"), row("b", "B", "a")]);
    expect(ids(tree).sort()).toEqual(["a", "b"]);
    // Neither may claim the other as a child, or the rail would recurse forever.
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
  });

  it("promotes a self-parented category to a root", () => {
    const tree = buildCategoryTree([row("loop", "Loop", "loop")]);
    expect(ids(tree)).toEqual(["loop"]);
    expect(tree[0].children).toEqual([]);
  });

  it("promotes a category hanging off a cycle rather than burying it", () => {
    // "child" itself is sound, but every ancestor walk from it loops — so it can't be
    // placed. Root is the only position from which the user can still reach its notes.
    const tree = buildCategoryTree([
      row("a", "A", "b"),
      row("b", "B", "a"),
      row("child", "Child", "a"),
    ]);
    expect(ids(tree).sort()).toEqual(["a", "b", "child"]);
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
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

  it("resolves the empty chain to the whole notebook", () => {
    expect(resolveCategoryChain(tree, [])).toEqual([]);
  });
});

describe("categoryNames", () => {
  it("lists every name alphabetically, deduped", () => {
    expect(
      categoryNames([row("a", "Work"), row("b", "Meetings", "a"), row("c", "Work")]),
    ).toEqual(["Meetings", "Work"]);
  });
});
