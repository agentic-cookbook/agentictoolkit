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
