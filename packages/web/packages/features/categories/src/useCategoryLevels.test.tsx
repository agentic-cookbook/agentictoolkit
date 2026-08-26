/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import * as React from "react";

import { useCategoryLevels } from "./useCategoryLevels";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_SLUG,
  resolveListCategory,
} from "./category-scope";
import {
  buildCategoryTree,
  type CategoryTreeNode,
} from "@agenticdevelopertoolkit/ui/blocks";

vi.mock("@agentic-toolkit/data/markdown", () => ({
  taxonomyApi: {
    renameCategory: vi.fn(),
    addCategoryParent: vi.fn(),
    removeCategoryParent: vi.fn(),
    deleteCategory: vi.fn(),
  },
  markdownApi: { createCategory: vi.fn() },
}));

import { taxonomyApi, markdownApi } from "@agentic-toolkit/data/markdown";

const ROWS: CategoryTreeNode[] = [
  { id: "work", name: "Work", parentIds: [] },
  { id: "plan", name: "Planning", parentIds: [] },
  { id: "q3", name: "Q3", parentIds: ["work"] },
];

function levelsFor(chainSlugs: string[], rows: CategoryTreeNode[] = ROWS) {
  // The spy comes back with the levels: `onSelect` and `onClear` are the two halves of the
  // rail's navigation contract and neither is observable from the returned levels alone.
  const onSelectChain = vi.fn();
  const { result } = renderHook(() =>
    useCategoryLevels({
      rows,
      chainSlugs,
      onSelectChain,
      onChanged: vi.fn(),
      itemNoun: "notes",
      idPrefix: "notebook",
    })
  );
  return { ...result.current, onSelectChain };
}

/** The hook rendered as a real component: every level's gear, plus the four dialogs. The
 *  gear/dialog wiring is only reachable through the DOM, so the tests that drive a WRITE go
 *  through this rather than through `renderHook`. */
function Harness({
  rows = ROWS,
  chainSlugs,
  onSelectChain = vi.fn(),
  onChanged = async () => {},
}: {
  rows?: CategoryTreeNode[];
  chainSlugs: string[];
  onSelectChain?: (slugs: string[]) => void;
  onChanged?: () => void | Promise<void>;
}): React.ReactElement {
  const { levels, dialogs } = useCategoryLevels({
    rows,
    chainSlugs,
    onSelectChain,
    onChanged,
    itemNoun: "notes",
    idPrefix: "notebook",
  });
  return (
    <div>
      {levels.map((level) => (
        <div key={level.id}>{level.titleActions}</div>
      ))}
      {dialogs}
    </div>
  );
}

/** Open the gear in level `depth`'s header and choose the item matching `verb`. */
async function chooseFromGear(depth: number, verb: RegExp): Promise<void> {
  const gears = screen.getAllByRole("button", { name: "Category actions" });
  fireEvent.click(gears[depth]!);
  await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("menuitem", { name: verb }));
}

describe("useCategoryLevels", () => {
  it("leads the root level with All and Uncategorized, then the roots by name", () => {
    const { levels } = levelsFor([]);
    expect(levels[0].items.map((i) => i.label)).toEqual([
      "All",
      "Uncategorized",
      "Planning",
      "Work",
    ]);
  });

  // must-show-only-the-category-name. The requirement is about the TRAIL the old flat picker
  // put on every row ("Work / Q3") and the subcategory count that competed with the name for
  // it — so this names the row it means and pins the string, rather than asserting that an
  // absent property is absent over a loop that could run zero times.
  it("renders a category row as its name alone — no trail, no count", () => {
    const { levels } = levelsFor(["work"]);
    const q3 = levels[1]!.items.find((item) => item.id === "q3");
    expect(q3).toBeDefined();
    expect(q3!.label).toBe("Q3");
    expect(q3!.label).not.toContain("Work");
    expect(q3!.sublabel).toBeUndefined();
  });

  it("publishes one level per depth walked, and no empty level for a leaf", () => {
    // Work has one child; Q3 has none.
    expect(levelsFor(["work"]).levels).toHaveLength(2);
    expect(levelsFor(["work", "q3"]).levels).toHaveLength(2);
  });

  it("puts a gear in every level's header", () => {
    // Truthiness only — `titleActions` is an unconditional element literal, so this can never
    // fail on its own. It is here to pin the COUNT (one gear per published level); what each
    // gear actually targets is the T5/T6 suites below, which drive it through the DOM.
    const { levels } = levelsFor(["work"]);
    expect(levels).toHaveLength(2);
    for (const level of levels) expect(level.titleActions).toBeTruthy();
  });

  // T9 — must-select-by-slug-not-id. Selection identity is the URL slug, and `slugFor` only
  // coincides with the id in fixtures where the id happens to be the slugified name; these
  // rows are built so the two are always distinguishable.
  it("selects by slug, never by id, and appends it to this level's ancestors", () => {
    const rows: CategoryTreeNode[] = [
      { id: "c-17", name: "Work", parentIds: [] },
      { id: "c-42", name: "Q3", parentIds: ["c-17"] },
    ];
    const root = levelsFor([], rows);
    expect(root.levels[0]!.items.map((item) => item.id)).toEqual([
      ALL_CATEGORIES_ID,
      UNCATEGORIZED_SLUG,
      "work",
    ]);
    root.levels[0]!.onSelect!("work");
    expect(root.onSelectChain).toHaveBeenCalledWith(["work"]);

    const inside = levelsFor(["work"], rows);
    expect(inside.levels[1]!.items.map((item) => item.id)).toEqual(["q3"]);
    inside.levels[1]!.onSelect!("q3");
    expect(inside.onSelectChain).toHaveBeenCalledWith(["work", "q3"]);
  });

  // T10 — must-clear-to-the-parent-level. One level up, not all the way home: clearing at
  // depth 2 keeps the depth-1 chain.
  it("clears one level up, not to the root", () => {
    const rows: CategoryTreeNode[] = [
      ...ROWS,
      { id: "budget", name: "Budget", parentIds: ["q3"] },
    ];
    const deep = levelsFor(["work", "q3", "budget"], rows);
    expect(deep.levels).toHaveLength(3);
    deep.levels[2]!.onClear!();
    expect(deep.onSelectChain).toHaveBeenCalledWith(["work", "q3"]);

    deep.levels[1]!.onClear!();
    expect(deep.onSelectChain).toHaveBeenCalledWith(["work"]);

    // And the root level clears to nothing, which is the same rule, not a special case.
    deep.levels[0]!.onClear!();
    expect(deep.onSelectChain).toHaveBeenCalledWith([]);
  });

  // M2 — the root is the ONE level that re-orders. Everything below it keeps the order the
  // backend sent (`sortOrder`, then name), which `buildCategoryTree` promises to preserve and
  // `CategoryPickerDialog` renders unsorted — a rail that re-sorted would silently discard an
  // owner's deliberate ordering and disagree with the picker about the same subtree.
  it("sorts the root level by name and leaves every deeper level in arrival order", () => {
    const rows: CategoryTreeNode[] = [
      // Roots out of alphabetical order, children out of alphabetical order.
      { id: "work", name: "Work", parentIds: [] },
      { id: "archive", name: "Archive", parentIds: [] },
      { id: "zeta", name: "Zeta", parentIds: ["work"] },
      { id: "alpha", name: "Alpha", parentIds: ["work"] },
    ];
    const { levels } = levelsFor(["work"], rows);
    expect(levels[0]!.items.map((item) => item.label)).toEqual([
      "All",
      "Uncategorized",
      "Archive",
      "Work",
    ]);
    expect(levels[1]!.items.map((item) => item.label)).toEqual([
      "Zeta",
      "Alpha",
    ]);
  });

  it("titles a child level with its parent's name", () => {
    const { levels } = levelsFor(["work"]);
    expect(levels[0].title).toBe("Categories");
    expect(levels[1].title).toBe("Work");
  });

  it("reports the scope the item list should filter by", () => {
    expect(levelsFor([]).scope).toMatchObject({ kind: "all" });
    expect(levelsFor([UNCATEGORIZED_SLUG]).scope).toMatchObject({
      kind: "uncategorized",
    });
    expect(levelsFor(["work", "q3"]).scope).toMatchObject({
      kind: "named",
      name: "Q3",
    });
  });

  // The two reserved rows are `-`-prefixed on purpose (see category-scope.ts): `slugify`
  // trims leading/trailing hyphens, so it can never produce a slug that starts with `-`,
  // which is what reserves the whole `-*` namespace for these two synthetic rows. The
  // exact strings are a URL contract (`UNCATEGORIZED_SLUG` appears in real notebook URLs),
  // so pin them literally rather than only through identity comparisons.
  it("pins the reserved slug values — a URL contract, not just an internal id", () => {
    expect(ALL_CATEGORIES_ID).toBe("-all");
    expect(UNCATEGORIZED_SLUG).toBe("-none");
  });

  it("tells a real category named Uncategorized apart from the synthetic row", () => {
    // slugify("Uncategorized") === "uncategorized", NOT "-none" — so selecting this real
    // category's slug must resolve to a named scope, never the synthetic uncategorized one.
    const rows: CategoryTreeNode[] = [
      ...ROWS,
      { id: "real-uncat", name: "Uncategorized", parentIds: [] },
    ];
    const { scope } = levelsFor(["uncategorized"], rows);
    expect(scope).toMatchObject({ kind: "named", name: "Uncategorized" });
  });

  it("tells a real category named All apart from the synthetic row", () => {
    // slugify("All") === "all", NOT "-all" — so selecting this real category's slug must
    // resolve to a named scope, never the synthetic "whole notebook" scope.
    const rows: CategoryTreeNode[] = [
      ...ROWS,
      { id: "real-all", name: "All", parentIds: [] },
    ];
    const { scope } = levelsFor(["all"], rows);
    expect(scope).toMatchObject({ kind: "named", name: "All" });
  });

  it("keeps chain and scope referentially stable across a fresh-but-equal chainSlugs array", () => {
    // A URL parse hands back a NEW array with the same values every render (never the same
    // reference twice), so this rerenders with a distinct-but-equal array rather than reusing
    // one — a test that reused the same reference would pass whether or not the hook keys its
    // memos on the joined string, and would not actually exercise the guard. `rows` stays the
    // SAME reference across both renders so `tree` is not itself a variable here: only
    // `chainSlugs`'s instability is under test.
    const { result, rerender } = renderHook(
      ({ chainSlugs }: { chainSlugs: string[] }) =>
        useCategoryLevels({
          rows: ROWS,
          chainSlugs,
          onSelectChain: vi.fn(),
          onChanged: vi.fn(),
          itemNoun: "notes",
          idPrefix: "notebook",
        }),
      { initialProps: { chainSlugs: ["work"] } }
    );
    const firstChain = result.current.chain;
    const firstScope = result.current.scope;

    rerender({ chainSlugs: ["work"] }); // a different array; the same one value

    expect(result.current.chain).toBe(firstChain);
    expect(result.current.scope).toBe(firstScope);
  });
});

// Moved verbatim from features/notebook/src/note-model.test.ts:132-185 — Task 6 relocates
// `resolveListCategory` (and its assertions) into this package so the research pane (Task 8)
// folds the same rail-scope × filter-box question the notebook already answers, rather than
// writing a second copy.
describe("resolveListCategory", () => {
  const all = { kind: "all" } as const;
  const none = { kind: "uncategorized" } as const;
  const work = { kind: "named", name: "Work" } as const;

  it("asks for nothing when the whole notebook is showing", () => {
    expect(resolveListCategory(all, "")).toEqual({
      query: "",
      uncategorizedOnly: false,
      empty: false,
    });
  });

  it("lets the bar narrow an unscoped list", () => {
    expect(resolveListCategory(all, "Work").query).toBe("Work");
  });

  it("asks for the rail's category when the bar is not narrowing", () => {
    expect(resolveListCategory(work, "").query).toBe("Work");
  });

  it("keeps ONE query when both axes name the same category", () => {
    // Case-insensitively the same place. Sending it once is not a shortcut — `?category=` takes
    // one value, so the alternative is choosing which spelling to send.
    expect(resolveListCategory(work, "work")).toEqual({
      query: "Work",
      uncategorizedOnly: false,
      empty: false,
    });
  });

  it("reports the contradiction instead of letting one axis win", () => {
    // A note has exactly one category, so "in Work" ∩ "in Personal" is empty. The honest answer
    // is no notes; silently showing one of the two would look like a filter that half works.
    expect(resolveListCategory(work, "Personal").empty).toBe(true);
  });

  it("filters uncategorized on the client, because the backend has no parameter for it", () => {
    expect(resolveListCategory(none, "")).toEqual({
      query: "",
      uncategorizedOnly: true,
      empty: false,
    });
  });

  it("treats uncategorized narrowed to a category as empty", () => {
    expect(resolveListCategory(none, "Work").empty).toBe(true);
  });

  it("ignores surrounding whitespace in the filter", () => {
    expect(resolveListCategory(all, "  ").query).toBe("");
    expect(resolveListCategory(none, "   ").uncategorizedOnly).toBe(true);
  });
});

/** The hook, its gear, its rename dialog and its route, driven end to end — because the
 *  defect lived in the wiring between them, not in any one of them. */
describe("useCategoryLevels — renaming the selected category follows it to the new slug", () => {
  /** Open level `depth`'s gear and choose Rename, then commit `nextName`. */
  async function rename(depth: number, nextName: string): Promise<void> {
    await chooseFromGear(depth, /^Rename/);
    const field = await screen.findByLabelText("New category name");
    fireEvent.change(field, { target: { value: nextName } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    });
  }

  beforeEach(() => {
    vi.mocked(taxonomyApi.renameCategory).mockReset();
    vi.mocked(taxonomyApi.renameCategory).mockResolvedValue(undefined as never);
  });

  it("navigates to the renamed category's new slug", async () => {
    const onSelectChain = vi.fn();
    render(<Harness chainSlugs={["work"]} onSelectChain={onSelectChain} />);
    await rename(0, "Zebra");
    expect(taxonomyApi.renameCategory).toHaveBeenCalledWith("work", "Zebra");
    expect(onSelectChain).toHaveBeenCalledWith(["zebra"]);
  });

  it("keeps the deeper selection when an ancestor is renamed", async () => {
    const onSelectChain = vi.fn();
    render(
      <Harness chainSlugs={["work", "q3"]} onSelectChain={onSelectChain} />
    );
    await rename(0, "Zebra");
    expect(onSelectChain).toHaveBeenCalledWith(["zebra", "q3"]);
  });

  it("does not touch the route when the rename fails", async () => {
    // The old behaviour dropped the user to `All` on success; dropping them on FAILURE would
    // be the same defect wearing the opposite outcome. The write is what earns the navigation.
    vi.mocked(taxonomyApi.renameCategory).mockRejectedValue(new Error("nope"));
    const onSelectChain = vi.fn();
    render(<Harness chainSlugs={["work"]} onSelectChain={onSelectChain} />);
    await rename(0, "Zebra");
    expect(onSelectChain).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows why when the rename fails", async () => {
    // The hook's `run` CATCHES, so routing this dialog through it made every failure resolve.
    // `CategoryRenameDialog` awaits its `onRename` and reads a resolution as success: it fired
    // `onRenamed`, called `onClose`, and a rename the server refused closed exactly like one
    // it accepted, with the reason recorded in `writeError` — which this dialog never renders.
    // A silent success on a failed write is the worst outcome available, so both halves are
    // pinned: the dialog is still there, and the server's own words are in it.
    vi.mocked(taxonomyApi.renameCategory).mockRejectedValue(
      new Error("Name already taken.")
    );
    render(<Harness chainSlugs={["work"]} onSelectChain={vi.fn()} />);
    await rename(0, "Zebra");
    expect(screen.getByLabelText("New category name")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Name already taken.");
  });
});

/**
 * T5 and T6 — what the gear at depth *d* is actually pointed at.
 *
 * Two different targets, and the recipe says so: Rename/Move/Delete act on `chain[d]` (the
 * level's SELECTED row), while Add acts on the level's OWN category — `chain[d-1]`, the
 * parent whose children the level lists, `null` at the root. Neither is the frontier, which
 * is the mistake available here: with `work/q3` walked, the deepest selection is Q3, and a
 * gear that reached for it would file the root level's new category under Q3.
 */
describe("useCategoryLevels — the gear targets its own level", () => {
  beforeEach(() => {
    vi.mocked(markdownApi.createCategory).mockReset();
    vi.mocked(markdownApi.createCategory).mockResolvedValue(undefined as never);
    vi.mocked(taxonomyApi.renameCategory).mockReset();
    vi.mocked(taxonomyApi.renameCategory).mockResolvedValue(undefined as never);
  });

  /** Open level `depth`'s gear, choose Add, and create `name`. */
  async function add(depth: number, name: string): Promise<void> {
    await chooseFromGear(depth, /^Add/);
    const field = await screen.findByLabelText("Category name");
    fireEvent.change(field, { target: { value: name } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
  }

  it("adds a ROOT from the root level's gear, whatever is selected below it", async () => {
    render(<Harness chainSlugs={["work", "q3"]} />);
    await add(0, "Archive");
    expect(markdownApi.createCategory).toHaveBeenCalledWith(
      { name: "Archive", parentIds: [] },
      { workspace: undefined }
    );
  });

  it("adds into the level's OWN category, not the deepest selection", async () => {
    // Level 1 lists Work's children, so its Add makes another child of Work — even though
    // the selected row on that level (and the frontier) is Q3.
    render(<Harness chainSlugs={["work", "q3"]} />);
    await add(1, "Q4");
    expect(markdownApi.createCategory).toHaveBeenCalledWith(
      { name: "Q4", parentIds: ["work"] },
      { workspace: undefined }
    );
  });

  it("names the level's own category in the Add dialog's title", async () => {
    render(<Harness chainSlugs={["work", "q3"]} />);
    await chooseFromGear(1, /^Add/);
    expect(
      await screen.findByText("New category in “Work”")
    ).toBeInTheDocument();
  });

  /** Open level `depth`'s gear, choose Rename, and commit `nextName`. */
  async function rename(depth: number, nextName: string): Promise<void> {
    await chooseFromGear(depth, /^Rename/);
    const field = await screen.findByLabelText("New category name");
    fireEvent.change(field, { target: { value: nextName } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    });
  }

  it("points Rename/Move/Delete at chain[d] — the level's selected row", async () => {
    // Standing at work/q3, so the FRONTIER is Q3 at both levels. Depth 0's target is Work
    // regardless: a gear that reached for the deepest selection instead of its own level's
    // would rename Q3 from the root level's header.
    const { unmount } = render(<Harness chainSlugs={["work", "q3"]} />);
    await rename(0, "Zebra");
    expect(taxonomyApi.renameCategory).toHaveBeenCalledWith("work", "Zebra");
    unmount();

    vi.mocked(taxonomyApi.renameCategory).mockClear();
    render(<Harness chainSlugs={["work", "q3"]} />);
    await rename(1, "Q4");
    expect(taxonomyApi.renameCategory).toHaveBeenCalledWith("q3", "Q4");
  });

  it("names the level's own selected row in the target verbs", async () => {
    // The label is how the user knows which category the verb is about — the header is not
    // the selection, so a depth-0 menu reading “Rename “Q3”…” would be a lie about the write.
    render(<Harness chainSlugs={["work", "q3"]} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Category actions" })[0]!
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    expect(
      screen.getByRole("menuitem", { name: /^Rename “Work”/ })
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^Rename “Q3”/ })).toBeNull();
  });

  // T6 — the two synthetic rows name no category, so the three target verbs have nothing to
  // act on. The hook is what decides that (`canEditTarget={selectedNode !== null}`); the gear
  // block only renders the flag it is handed.
  it("disables the target verbs when All is selected", async () => {
    render(<Harness chainSlugs={[]} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Category actions" })[0]!
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    for (const label of ["Rename…", "Move…", "Delete…"]) {
      expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    }
    expect(
      screen.getByRole("menuitem", { name: "Add category…" })
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("disables the target verbs when Uncategorized is selected", async () => {
    render(<Harness chainSlugs={[UNCATEGORIZED_SLUG]} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Category actions" })[0]!
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    for (const label of ["Rename…", "Move…", "Delete…"]) {
      expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    }
  });

  it("enables them for a real category", async () => {
    render(<Harness chainSlugs={["work"]} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Category actions" })[0]!
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    for (const label of [/^Rename “Work”/, /^Move “Work”/, /^Delete “Work”/]) {
      expect(screen.getByRole("menuitem", { name: label })).not.toHaveAttribute(
        "aria-disabled",
        "true"
      );
    }
  });
});

/**
 * T7 — must-say-what-a-delete-keeps, through the hook that computes it.
 *
 * `orphanedUnder` is the only thing standing between the user and a confirmation that names
 * categories the delete will NOT take. `CategoryDeleteDialog`'s own test hands `orphanedNames`
 * in as a literal, so it passes with the computation replaced by `() => []`; this drives the
 * real one, with the multi-parent case that is the whole reason it is a BFS.
 */
describe("useCategoryLevels — the delete confirmation names only what is really orphaned", () => {
  // Budget is filed under BOTH Q3 (doomed with Work) and Plan (which survives), so deleting
  // Work takes Q3 and leaves Budget.
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work"] },
    { id: "budget", name: "Budget", parentIds: ["q3", "plan"] },
    { id: "plan", name: "Planning", parentIds: [] },
  ];

  it("names a subcategory filed nowhere else, and not one filed elsewhere too", async () => {
    render(<Harness rows={rows} chainSlugs={["work"]} />);
    await chooseFromGear(0, /^Delete/);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete “Work”?");
    expect(dialog).toHaveTextContent("Q3");
    expect(dialog).not.toHaveTextContent("Budget");
  });

  it("says nothing about subcategories when the delete orphans none", async () => {
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await chooseFromGear(1, /^Delete/); // delete Q3: Budget survives under Planning
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete “Q3”?");
    expect(dialog).not.toHaveTextContent("filed nowhere else");
  });
});

/**
 * T8 — must-leave-other-filings-alone-on-move, and the route that has to follow the move.
 *
 * Nothing drove `addCategoryParent`/`removeCategoryParent` through this hook before, so a
 * move body rewritten to unfile the category from EVERY parent kept the suite green.
 */
describe("useCategoryLevels — moving a category filed under two parents", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "plan", name: "Planning", parentIds: [] },
    { id: "archive", name: "Archive", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work", "plan"] },
  ];

  beforeEach(() => {
    vi.mocked(taxonomyApi.addCategoryParent).mockReset();
    vi.mocked(taxonomyApi.addCategoryParent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(taxonomyApi.removeCategoryParent).mockReset();
    vi.mocked(taxonomyApi.removeCategoryParent).mockResolvedValue(
      undefined as never
    );
  });

  /** Open level `depth`'s gear, choose Move, pick the row named `into`, confirm. */
  async function move(depth: number, into: RegExp | string): Promise<void> {
    await chooseFromGear(depth, /^Move/);
    const row = await screen.findByRole("treeitem", { name: into });
    fireEvent.click(row);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move" }));
    });
  }

  it("rewrites the filing walked in through and leaves the other one alone", async () => {
    // Walked in via Work. Q3's OTHER filing, under Planning, is not this move's business.
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await move(1, /Archive/);
    expect(taxonomyApi.addCategoryParent).toHaveBeenCalledWith("q3", "archive");
    expect(taxonomyApi.removeCategoryParent).toHaveBeenCalledTimes(1);
    expect(taxonomyApi.removeCategoryParent).toHaveBeenCalledWith("q3", "work");
  });

  it("follows the move to where the category now sits", async () => {
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await move(1, /Archive/);
    expect(onSelectChain).toHaveBeenCalledWith(["archive", "q3"]);
  });

  it("keeps the tail below the moved category", async () => {
    // The gear at depth 0 targets Work — far above the frontier — so a move that cut the LAST
    // chain segment would land on `work`, a route that stops resolving the moment Work is no
    // longer a root.
    const deep: CategoryTreeNode[] = [
      ...rows,
      { id: "budget", name: "Budget", parentIds: ["q3"] },
    ];
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={deep}
        chainSlugs={["work", "q3", "budget"]}
        onSelectChain={onSelectChain}
      />
    );
    await move(0, /Archive/);
    expect(taxonomyApi.addCategoryParent).toHaveBeenCalledWith(
      "work",
      "archive"
    );
    expect(onSelectChain).toHaveBeenCalledWith([
      "archive",
      "work",
      "q3",
      "budget",
    ]);
  });

  it("calls the no-parent row an unfiling while another filing stands", async () => {
    // Q3 is filed under Work AND Planning. Picking the picker's no-parent row from the Work
    // level does not make Q3 a root — it stops being HERE, and Planning is untouched. The row
    // says so, and the route does not move: where Q3 still sits is not something this gesture
    // named, and guessing Planning would take the user somewhere they did not ask to go.
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await move(1, /^Remove from/);
    expect(taxonomyApi.addCategoryParent).not.toHaveBeenCalled();
    expect(taxonomyApi.removeCategoryParent).toHaveBeenCalledWith("q3", "work");
    expect(onSelectChain).not.toHaveBeenCalled();
  });

  it("lands the category at the top level when the cut filing is its last", async () => {
    // Same gesture, one parent. Now the no-parent row is honest as "Top level" — the removal
    // really does root Q3 — so the route follows it there.
    const only: CategoryTreeNode[] = [
      { id: "work", name: "Work", parentIds: [] },
      { id: "archive", name: "Archive", parentIds: [] },
      { id: "q3", name: "Q3", parentIds: ["work"] },
    ];
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={only}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await move(1, "Top level");
    expect(taxonomyApi.addCategoryParent).not.toHaveBeenCalled();
    expect(taxonomyApi.removeCategoryParent).toHaveBeenCalledWith("q3", "work");
    expect(onSelectChain).toHaveBeenCalledWith(["q3"]);
  });

  it("leaves the route alone when the move fails", async () => {
    // Same rule the rename follows: the write is what earns the navigation.
    vi.mocked(taxonomyApi.addCategoryParent).mockRejectedValue(
      new Error("nope")
    );
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await move(1, /Archive/);
    expect(onSelectChain).not.toHaveBeenCalled();
  });

  it("refreshes the tree when the add lands but the remove does not", async () => {
    // Two writes, no transaction. If the remove fails the category is filed in BOTH places,
    // and `perform` skips its refresh on a rejection — so without this the user is told the
    // move failed while looking at a rail that still draws the pre-move forest and shows
    // neither filing. The refresh is what makes the message and the tree describe one world.
    vi.mocked(taxonomyApi.removeCategoryParent).mockRejectedValue(
      new Error("nope")
    );
    const onChanged = vi.fn(async () => {});
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onChanged={onChanged}
        onSelectChain={onSelectChain}
      />
    );
    await move(1, /Archive/);
    expect(taxonomyApi.addCategoryParent).toHaveBeenCalledWith("q3", "archive");
    expect(onChanged).toHaveBeenCalledTimes(1);
    // Still a failure: no navigation, and the dialog stays open with the reason.
    expect(onSelectChain).not.toHaveBeenCalled();
    expect(await screen.findByText("nope")).toBeInTheDocument();
  });

  it("does not re-issue an add that already landed", async () => {
    // The retry after the half-applied move above: the refreshed forest now files Q3 under
    // Archive as well, so re-adding the edge would fail forever on an edge that exists. The
    // move is finished by the remove alone.
    const filed: CategoryTreeNode[] = [
      { id: "work", name: "Work", parentIds: [] },
      { id: "plan", name: "Planning", parentIds: [] },
      { id: "archive", name: "Archive", parentIds: [] },
      { id: "q3", name: "Q3", parentIds: ["work", "plan", "archive"] },
    ];
    render(<Harness rows={filed} chainSlugs={["work", "q3"]} />);
    await move(1, /Archive/);
    expect(taxonomyApi.addCategoryParent).not.toHaveBeenCalled();
    expect(taxonomyApi.removeCategoryParent).toHaveBeenCalledWith("q3", "work");
  });
});

/**
 * L7 — filing a category in a SECOND place. The hierarchy has been a DAG since the edge table
 * arrived, but from the rail the only verb that touched a filing was Move, which removes one
 * and adds another. So a rail user could not express "this also belongs there" at all, and the
 * DAG read as a tree. File is the missing verb: it adds a place and touches nothing else.
 */
describe("useCategoryLevels — filing a category somewhere else as well", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "plan", name: "Planning", parentIds: [] },
    { id: "archive", name: "Archive", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work", "plan"] },
    { id: "budget", name: "Budget", parentIds: ["q3"] },
  ];

  beforeEach(() => {
    vi.mocked(taxonomyApi.addCategoryParent).mockReset();
    vi.mocked(taxonomyApi.addCategoryParent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(taxonomyApi.removeCategoryParent).mockReset();
    vi.mocked(taxonomyApi.removeCategoryParent).mockResolvedValue(
      undefined as never
    );
  });

  /** Open level `depth`'s gear, choose Also file, pick the row named `into`, confirm. */
  async function file(depth: number, into: RegExp | string): Promise<void> {
    await chooseFromGear(depth, /^Also file/);
    const row = await screen.findByRole("treeitem", { name: into });
    fireEvent.click(row);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "File" }));
    });
  }

  it("adds the one edge and removes nothing", async () => {
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await file(1, /Archive/);
    expect(taxonomyApi.addCategoryParent).toHaveBeenCalledTimes(1);
    expect(taxonomyApi.addCategoryParent).toHaveBeenCalledWith("q3", "archive");
    expect(taxonomyApi.removeCategoryParent).not.toHaveBeenCalled();
  });

  it("stays where it is — filing is not a navigation", async () => {
    // Move follows the category because the place the user walked in through stopped holding
    // it. Filing leaves that place holding it, so the route the user is standing on is still
    // true, and moving them off it would be the surprise.
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await file(1, /Archive/);
    expect(onSelectChain).not.toHaveBeenCalled();
  });

  it("refuses itself, its descendants, and the places it is already filed", async () => {
    // Filing Q3 under Q3 or under Budget would close a cycle — the backend refuses both, and
    // the rail should not offer a row whose only outcome is a 409. Work and Planning are
    // refused for a duller reason: the edge is already there.
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await chooseFromGear(1, /^Also file/);
    await screen.findByRole("dialog");
    const item = (name: RegExp): HTMLElement =>
      screen.getByRole("treeitem", { name });
    expect(item(/^Work/)).toHaveAttribute("aria-disabled", "true");
    expect(item(/^Planning/)).toHaveAttribute("aria-disabled", "true");
    expect(item(/^Archive/)).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTitle("Expand Work"));
    expect(item(/^Q3/)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTitle("Expand Q3"));
    expect(item(/^Budget/)).toHaveAttribute("aria-disabled", "true");
  });

  it("cannot be confirmed until a place is picked", async () => {
    // There is no "file at the top level": a root is a category with NO parents, so the
    // no-parent row would name nothing to add. The dialog opens with nothing selected and
    // Confirm dead rather than with a row that does nothing.
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await chooseFromGear(1, /^Also file/);
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "File" })).toBeDisabled();
    fireEvent.click(screen.getByRole("treeitem", { name: /^Archive/ }));
    expect(screen.getByRole("button", { name: "File" })).toBeEnabled();
  });

  it("keeps the dialog open with the reason when the edge is refused", async () => {
    vi.mocked(taxonomyApi.addCategoryParent).mockRejectedValue(
      new Error("would create a cycle")
    );
    render(<Harness rows={rows} chainSlugs={["work", "q3"]} />);
    await file(1, /Archive/);
    expect(await screen.findByText("would create a cycle")).toBeInTheDocument();
  });
});

/**
 * M1 — the route after a delete. The old body cut the LAST chain segment unconditionally,
 * which is only the right answer when the gear was used on the deepest level.
 */
describe("useCategoryLevels — deleting a category leaves only the level that is gone", () => {
  const rows: CategoryTreeNode[] = [
    { id: "work", name: "Work", parentIds: [] },
    { id: "plan", name: "Planning", parentIds: [] },
    { id: "q3", name: "Q3", parentIds: ["work"] },
    { id: "budget", name: "Budget", parentIds: ["q3"] },
  ];

  beforeEach(() => {
    vi.mocked(taxonomyApi.deleteCategory).mockReset();
    vi.mocked(taxonomyApi.deleteCategory).mockResolvedValue(undefined as never);
  });

  /** Open level `depth`'s gear, choose Delete, confirm. */
  async function remove(depth: number): Promise<void> {
    await chooseFromGear(depth, /^Delete/);
    await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });
  }

  it("steps up one level when the deepest level's own category is deleted", async () => {
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await remove(1);
    expect(taxonomyApi.deleteCategory).toHaveBeenCalledWith("q3");
    expect(onSelectChain).toHaveBeenCalledWith(["work"]);
  });

  it("truncates at the deleted category, not at the end of the route", async () => {
    // Standing in Work → Q3 → Budget and deleting WORK. Cutting the last segment would land
    // on `work/q3` — a route through a category that no longer exists.
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3", "budget"]}
        onSelectChain={onSelectChain}
      />
    );
    await remove(0);
    expect(taxonomyApi.deleteCategory).toHaveBeenCalledWith("work");
    expect(onSelectChain).toHaveBeenCalledWith([]);
  });

  it("leaves the route alone when the delete fails", async () => {
    vi.mocked(taxonomyApi.deleteCategory).mockRejectedValue(new Error("nope"));
    const onSelectChain = vi.fn();
    render(
      <Harness
        rows={rows}
        chainSlugs={["work", "q3"]}
        onSelectChain={onSelectChain}
      />
    );
    await remove(1);
    expect(onSelectChain).not.toHaveBeenCalled();
  });
});

/**
 * M5 — a write failure belongs to the dialog that caused it. One shared `string | null`
 * outlived its dialog and reappeared under the next one.
 */
describe("useCategoryLevels — a failed write's message stays with its own dialog", () => {
  beforeEach(() => {
    vi.mocked(taxonomyApi.deleteCategory).mockReset();
    vi.mocked(taxonomyApi.deleteCategory).mockRejectedValue(
      new Error("Category is in use")
    );
    vi.mocked(markdownApi.createCategory).mockReset();
    vi.mocked(markdownApi.createCategory).mockResolvedValue(undefined as never);
  });

  async function failADelete(): Promise<void> {
    await chooseFromGear(0, /^Delete/);
    await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });
  }

  it("shows the reason on the dialog that asked", async () => {
    render(<Harness chainSlugs={["work"]} />);
    await failADelete();
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Category is in use"
    );
  });

  it("does not carry it onto the next dialog the user opens", async () => {
    render(<Harness chainSlugs={["work"]} />);
    await failADelete();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await chooseFromGear(0, /^Add/);
    const add = await screen.findByRole("dialog");
    expect(add).not.toHaveTextContent("Category is in use");
  });

  it("does not carry it onto a second attempt at the same verb", async () => {
    // Same action, different opening: `pending` is a fresh object, so the message from the
    // previous attempt is not this dialog's.
    render(<Harness chainSlugs={["work"]} />);
    await failADelete();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await chooseFromGear(0, /^Delete/);
    expect(await screen.findByRole("dialog")).not.toHaveTextContent(
      "Category is in use"
    );
  });
});
