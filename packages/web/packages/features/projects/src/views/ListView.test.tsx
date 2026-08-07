// @vitest-environment jsdom
//
// Component test for ListView — the LIST WITH DETAILS view of the work-items surface: the items as
// an inline-editable table on top, the selected item's full record below. It owns its own writes
// (the row commit control PATCHes / DELETEs and then calls `onChanged`), so the API client is the
// only boundary mocked here.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@agentic-toolkit/data/projects", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    projectWorkItemsApi: {
      update: vi.fn(),
      remove: vi.fn(),
    },
  };
});

import { ListView } from "./ListView";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";

const update = vi.mocked(projectWorkItemsApi.update);
const remove = vi.mocked(projectWorkItemsApi.remove);

const TODO: ProjectStatus = {
  id: "s1", projectId: "p1", key: "todo", label: "To do", category: "todo", position: 0,
  createdAt: "2026-07-03T00:00:00Z",
};
const DOING: ProjectStatus = {
  id: "s2", projectId: "p1", key: "doing", label: "In progress", category: "in_progress", position: 1,
  createdAt: "2026-07-03T00:00:00Z",
};

const PARTICIPANT: ProjectParticipant = {
  id: "pp1", projectId: "p1", participantKind: "customer", participantId: "cust-1",
  role: "member", addedBy: null, addedAt: "2026-07-03T00:00:00Z",
};

const ITEM: WorkItem = {
  id: "w1",
  projectId: "p1",
  itemKey: "",
  title: "Design the landing page",
  description: "Hero, pricing, footer.",
  statusId: "s1",
  assigneeKind: "customer",
  assigneeId: "cust-1",
  priority: 3, // High
  startDate: null,
  dueDate: "2026-08-01",
  labels: ["design"],
  parentId: null,
  position: 0,
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

function renderList(items: WorkItem[] = [ITEM], onChanged = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ListView
      projectId="p1"
      items={items}
      statuses={[TODO, DOING]}
      participants={[PARTICIPANT]}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation((id, patch) => Promise.resolve({ ...ITEM, id, ...patch } as WorkItem));
  remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("ListView (list with details)", () => {
  it("renders every column as an in-place editor seeded from the row", () => {
    renderList();
    // The title is an inline EDITOR (an input), not static text — that is the point of the view.
    expect(screen.getByDisplayValue("Design the landing page")).not.toBeNull();
    expect(
      (screen.getByRole("combobox", { name: /^Status —/ }) as HTMLSelectElement).value,
    ).toBe("s1");
    expect(
      (screen.getByRole("combobox", { name: /^Assignee —/ }) as HTMLSelectElement).value,
    ).toBe("customer:cust-1");
    expect(
      (screen.getByRole("combobox", { name: /^Priority —/ }) as HTMLSelectElement).value,
    ).toBe("3");
  });

  it("commits an edited row as a PATCH of ONLY the touched fields", async () => {
    const { onChanged } = renderList();

    fireEvent.change(screen.getByRole("combobox", { name: /^Status —/ }), {
      target: { value: "s2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes work item Design the landing page" }),
    );

    // Only `statusId` travelled — a patch can never clobber a field this user didn't touch.
    await waitFor(() => expect(update).toHaveBeenCalledWith("w1", { statusId: "s2" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("discards an edited row with ✕, writing nothing", async () => {
    renderList();

    const title = screen.getByDisplayValue("Design the landing page");
    fireEvent.change(title, { target: { value: "Renamed" } });
    expect(screen.getByDisplayValue("Renamed")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Discard changes work item Design the landing page" }),
    );

    expect(screen.getByDisplayValue("Design the landing page")).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to commit an emptied title, keeping the draft and showing the row's error", async () => {
    renderList();

    fireEvent.change(screen.getByDisplayValue("Design the landing page"), {
      target: { value: "   " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes work item Design the landing page" }),
    );

    expect(await screen.findByText("A title is required.")).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
    // The draft survives the refusal — read the raw value (getByDisplayValue normalises whitespace).
    const title = screen.getByRole("textbox", { name: /^Title —/ }) as HTMLInputElement;
    expect(title.value).toBe("   ");
  });

  it("arms a delete with the trash and destroys the row on ✓", async () => {
    const { onChanged } = renderList();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete work item Design the landing page" }),
    );
    // Armed: the same ✓ now confirms the delete rather than saving edits.
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm delete work item Design the landing page" }),
    );

    await waitFor(() => expect(remove).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
  });

  it("shows the selected item's WHOLE record in the details pane — including non-column fields", async () => {
    renderList();

    // Nothing selected yet.
    expect(screen.getByText("Select a work item to see its full record.")).not.toBeNull();

    fireEvent.click(screen.getByDisplayValue("Design the landing page"));

    // Fields that are NOT columns, so the list alone could never show them.
    expect(await screen.findByText("Hero, pricing, footer.")).not.toBeNull(); // description
    expect(screen.getByText("design")).not.toBeNull(); // labels
    expect(screen.getByText("Created")).not.toBeNull(); // timestamps
  });

  it("renders the empty label when there are no items", () => {
    renderList([]);
    expect(screen.getByText("No work items yet.")).not.toBeNull();
  });
});

/* ── The sub-item tree ────────────────────────────────────────────────────── */

// `parentId` is a real field on every work item and this is the ONLY view that shows it, so these
// pin the two things the flattener can't: that the hierarchy reaches the screen, and that it
// stands down when the list is filtered.
describe("ListView sub-item tree", () => {
  const CHILD: WorkItem = {
    ...ITEM,
    id: "w2",
    title: "Write the hero copy",
    description: "",
    parentId: "w1",
    position: 0,
  };
  const SIBLING: WorkItem = {
    ...ITEM,
    id: "w3",
    title: "Pick the pricing table",
    description: "",
    parentId: "w1",
    position: 1,
  };
  /** A root that sorts AFTER the parent, so "the child follows its parent" is a claim about the
   *  tree rather than a coincidence of the input order. */
  const OTHER_ROOT: WorkItem = {
    ...ITEM,
    id: "w4",
    title: "Ship it",
    description: "",
    parentId: null,
    position: 1,
  };

  /** The titles in the order the table renders them. Reads the inputs, since every title cell in
   *  this view is an editor rather than text. */
  function titleOrder(): string[] {
    return screen
      .getAllByRole("textbox", { name: /^Title —/ })
      .map((el) => (el as HTMLInputElement).value);
  }

  it("puts a child under its parent, before the next root", () => {
    // Deliberately shuffled: the order on screen must come from parentId + position, not from
    // the order the API happened to return.
    renderList([OTHER_ROOT, SIBLING, ITEM, CHILD]);

    expect(titleOrder()).toEqual([
      "Design the landing page",
      "Write the hero copy",
      "Pick the pricing table",
      "Ship it",
    ]);
  });

  it("hides a subtree when its parent is collapsed, and brings it back", () => {
    renderList([ITEM, CHILD]);

    // Expanded by default — nothing a project contains is hidden until someone hides it.
    expect(titleOrder()).toContain("Write the hero copy");

    fireEvent.click(screen.getByRole("button", { name: "Collapse Design the landing page" }));
    expect(titleOrder()).toEqual(["Design the landing page"]);

    fireEvent.click(screen.getByRole("button", { name: "Expand Design the landing page" }));
    expect(titleOrder()).toContain("Write the hero copy");
  });

  it("gives a leaf no toggle at all", () => {
    renderList([ITEM, CHILD]);

    // The parent has one; the childless row does not — a leaf gets the width, not a dead control.
    expect(screen.getByRole("button", { name: "Collapse Design the landing page" })).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Expand|Collapse) Write the hero copy$/ }),
    ).toBeNull();
  });

  it("shows each row's key in its own read-only first column", () => {
    renderList([{ ...ITEM, itemKey: "WEB-42" }]);
    expect(screen.getByText("WEB-42")).not.toBeNull();
    // Read-only: every other column in this view is an in-place editor, the key is not —
    // renaming a card must never be a side effect of clicking its name.
    expect(screen.queryByRole("textbox", { name: /WEB-42/ })).toBeNull();
  });

  it("filters on the KEY as well as the title", () => {
    // Someone reading `WEB-42` in a commit message pastes it here; matching only titles
    // would answer "no results" for a key that plainly exists.
    renderList([
      { ...ITEM, id: "w1", title: "Design the landing page", itemKey: "WEB-42" },
      { ...ITEM, id: "w2", title: "Write the hero copy", itemKey: "WEB-7" },
    ]);

    fireEvent.change(screen.getByPlaceholderText("Filter work items…"), {
      target: { value: "web-7" }, // lower case: a key is quoted however it is typed
    });

    expect(titleOrder()).toEqual(["Write the hero copy"]);
  });

  it("goes flat while a filter is on, so a match is never indented under a hidden parent", () => {
    renderList([ITEM, CHILD]);

    fireEvent.change(screen.getByPlaceholderText("Filter work items…"), {
      target: { value: "hero" },
    });

    expect(titleOrder()).toEqual(["Write the hero copy"]);
    // No toggles anywhere: a filtered list is a list of matches, not a hierarchy.
    expect(screen.queryByRole("button", { name: /^(Expand|Collapse) / })).toBeNull();
  });
});
