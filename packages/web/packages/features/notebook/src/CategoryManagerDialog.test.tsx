// @vitest-environment jsdom
//
// Component test for CategoryManagerDialog — the one surface that can put a category in a
// SECOND place. `category-tree.test.ts` pins the fold that draws a DAG; this pins the controls
// that write one, which is the half a user can actually reach.
//
// What is worth asserting here is the seam between "a row is a filing" and "a write addresses a
// category": the list has one row per placement, but the name input, the delete button and the
// backend row behind them are shared — so the tests below are mostly about which of the two a
// given control is bound to. Only the data boundary is mocked; the dialog's own state, the
// cycle filter and the option lists are exercised for real.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@agentic-toolkit/auth", () => ({
  reportUnexpectedAuthError: vi.fn(),
}));

vi.mock("@agentic-toolkit/data/notes", () => ({
  notesApi: { createCategory: vi.fn() },
  taxonomyApi: {
    renameCategory: vi.fn(),
    addCategoryParent: vi.fn(),
    removeCategoryParent: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

import { notesApi, taxonomyApi, type NoteCategory } from "@agentic-toolkit/data/notes";
import { CategoryManagerDialog } from "./CategoryManagerDialog";

const createCategory = vi.mocked(notesApi.createCategory);
const renameCategory = vi.mocked(taxonomyApi.renameCategory);
const addCategoryParent = vi.mocked(taxonomyApi.addCategoryParent);
const removeCategoryParent = vi.mocked(taxonomyApi.removeCategoryParent);
const deleteCategory = vi.mocked(taxonomyApi.deleteCategory);

function row(id: string, name: string, ...parentIds: string[]): NoteCategory {
  return { id, name, parentIds, sortOrder: 0 };
}

/** Work → Q3 ← Planning: the smallest graph where a category is genuinely in two places. */
const TWO_PLACES: NoteCategory[] = [
  row("work", "Work"),
  row("planning", "Planning"),
  row("q3", "Q3", "work", "planning"),
];

function open(rows: NoteCategory[] = TWO_PLACES) {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    <CategoryManagerDialog
      rows={rows}
      onClose={onClose}
      onChanged={onChanged}
      workspaceSlug="acme"
    />,
  );
  return { onChanged, onClose };
}

/** The option VALUES of a select, which is what a filing write actually sends. */
function optionValues(select: HTMLElement): string[] {
  return within(select)
    .queryAllByRole("option")
    .map((o) => (o as HTMLOptionElement).value);
}

beforeEach(() => {
  vi.clearAllMocks();
  renameCategory.mockResolvedValue({} as never);
  addCategoryParent.mockResolvedValue({} as never);
  removeCategoryParent.mockResolvedValue(undefined);
  deleteCategory.mockResolvedValue(undefined);
  createCategory.mockResolvedValue({} as never);
});

afterEach(cleanup);

describe("one row per filing", () => {
  it("lists a two-parent category twice, and every category exactly once per place", () => {
    open();
    // Two rows carry Q3's name field — the category is in two places and both are reachable.
    expect(screen.getAllByLabelText("Name of category Q3")).toHaveLength(2);
    expect(screen.getAllByLabelText("Name of category Work")).toHaveLength(1);
  });

  it("gives each listing an unfile button naming the parent THAT listing hangs from", () => {
    open();
    // The distinguishing control: same category, two different links to cut.
    expect(screen.getByLabelText("Unfile category Q3 from Work")).toBeTruthy();
    expect(screen.getByLabelText("Unfile category Q3 from Planning")).toBeTruthy();
  });

  it("shows no unfile button on a root listing — there is no link to cut", () => {
    open();
    expect(screen.queryByLabelText(/^Unfile category Work/)).toBeNull();
  });

  it("cuts only the link the clicked button names", async () => {
    open();
    fireEvent.click(screen.getByLabelText("Unfile category Q3 from Planning"));
    await waitFor(() => expect(removeCategoryParent).toHaveBeenCalledTimes(1));
    // Not "unfile Q3" — unfile Q3 FROM PLANNING. The Work filing survives.
    expect(removeCategoryParent).toHaveBeenCalledWith("q3", "planning");
  });
});

describe("the File under… menu", () => {
  it("offers neither the category itself nor anything below it", () => {
    // A category filed under its own descendant closes a loop; the backend answers 409 and this
    // filter is what keeps the menu from offering the refusal.
    open([row("work", "Work"), row("q3", "Q3", "work"), row("july", "July", "q3")]);
    const select = screen.getByLabelText("File category Work under another");
    expect(optionValues(select)).toEqual([""]);
  });

  it("offers a category it is not yet filed under, and hides the ones it is", () => {
    open([row("work", "Work"), row("planning", "Planning"), row("q3", "Q3", "work")]);
    const select = screen.getByLabelText("File category Q3 under another");
    expect(optionValues(select)).toEqual(["", "planning"]);
  });

  it("names each choice once even when it is drawn in several places", () => {
    // The rows are filings; the OPTIONS are categories. Q3 is listed twice above and must not
    // be offered twice here.
    open([...TWO_PLACES, row("loose", "Loose")]);
    const select = screen.getByLabelText("File category Loose under another");
    expect(optionValues(select)).toEqual(["", "work", "q3", "planning"]);
  });

  it("adds a place rather than replacing one", async () => {
    open([row("work", "Work"), row("planning", "Planning"), row("q3", "Q3", "work")]);
    fireEvent.change(screen.getByLabelText("File category Q3 under another"), {
      target: { value: "planning" },
    });
    await waitFor(() => expect(addCategoryParent).toHaveBeenCalledWith("q3", "planning"));
    // Nothing is unfiled on the way: the existing Work link is untouched.
    expect(removeCategoryParent).not.toHaveBeenCalled();
  });

  it("surfaces the backend's cycle refusal rather than swallowing it", async () => {
    // The menu filtered against a SNAPSHOT; someone else may have moved a branch since.
    addCategoryParent.mockRejectedValueOnce(new Error("that would close a cycle"));
    open([row("work", "Work"), row("planning", "Planning"), row("q3", "Q3", "work")]);
    fireEvent.change(screen.getByLabelText("File category Q3 under another"), {
      target: { value: "planning" },
    });
    expect(await screen.findByText("that would close a cycle")).toBeTruthy();
  });
});

describe("renaming", () => {
  it("renames the category behind BOTH listings, from either of them", async () => {
    open();
    const [first] = screen.getAllByLabelText("Name of category Q3");
    fireEvent.change(first, { target: { value: "Q4" } });
    fireEvent.blur(first);
    await waitFor(() => expect(renameCategory).toHaveBeenCalledWith("q3", "Q4"));
    // One write, not one per listing — a rename addresses the row, not the placement.
    expect(renameCategory).toHaveBeenCalledTimes(1);
  });

  it("refuses a name another category already holds, without asking the backend", async () => {
    // The generic PUT takes no uniqueness lock, so a duplicate would break every read keyed on
    // the name. The check has to happen here, where the user can still see what they typed.
    open();
    const input = screen.getByLabelText("Name of category Work");
    fireEvent.change(input, { target: { value: "planning" } });
    fireEvent.blur(input);
    expect(await screen.findByText(/already a category called/)).toBeTruthy();
    expect(renameCategory).not.toHaveBeenCalled();
  });

  it("writes nothing when the name comes back unchanged", async () => {
    open();
    const input = screen.getByLabelText("Name of category Work");
    fireEvent.change(input, { target: { value: "Warp" } });
    fireEvent.change(input, { target: { value: "Work" } });
    fireEvent.blur(input);
    await waitFor(() => expect(renameCategory).not.toHaveBeenCalled());
  });
});

describe("adding", () => {
  it("mints a root when no parent is chosen", async () => {
    open();
    fireEvent.change(screen.getByLabelText("New category name"), {
      target: { value: "Reading" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith(
        { name: "Reading", parentIds: [] },
        { workspace: "acme" },
      ),
    );
  });

  it("mints under the chosen parent, and carries the workspace so an org owns it", async () => {
    open();
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "July" } });
    fireEvent.change(screen.getByLabelText("Parent of the new category"), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith(
        { name: "July", parentIds: ["work"] },
        { workspace: "acme" },
      ),
    );
  });

  it("refuses a name that already exists", async () => {
    open();
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "  Work " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/already a category called/)).toBeTruthy();
    expect(createCategory).not.toHaveBeenCalled();
  });
});

describe("retiring", () => {
  it("confirms first, and says what happens to the categories underneath", async () => {
    open();
    fireEvent.click(screen.getAllByLabelText("Delete category Q3")[0]);
    expect(await screen.findByText(/notes filed under it become uncategorized/)).toBeTruthy();
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("retires the category once, from whichever listing was clicked", async () => {
    open();
    fireEvent.click(screen.getAllByLabelText("Delete category Q3")[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
    await waitFor(() => expect(deleteCategory).toHaveBeenCalledWith("q3"));
    expect(deleteCategory).toHaveBeenCalledTimes(1);
  });
});

describe("an empty vocabulary", () => {
  it("says so, and still offers the add row", () => {
    open([]);
    expect(screen.getByText("No categories yet.")).toBeTruthy();
    expect(screen.getByLabelText("New category name")).toBeTruthy();
  });
});
