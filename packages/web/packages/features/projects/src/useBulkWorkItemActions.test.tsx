// @vitest-environment jsdom
//
// What a multi-selection DOES — the Update… dialog and the confirmed Delete, driven through the
// List view because that is the real wiring: the hook's verbs, the shared SelectionActions strip
// and the dialog have to agree, and a test of the hook alone would assert none of that.
//
// The API client is the only boundary mocked. `bulkPatchOf` is tested directly as well, because
// "an untouched field is not sent" is otherwise only observable through N mocked requests.
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

import { ListView } from "./views/ListView";
import { bulkPatchOf } from "./BulkEditDialog";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";

const update = vi.mocked(projectWorkItemsApi.update);
const remove = vi.mocked(projectWorkItemsApi.remove);

const TODO: ProjectStatus = {
  id: "s1", projectId: "p1", key: "todo", label: "To do", category: "todo", position: 0,
  createdAt: "2026-07-03T00:00:00Z",
};
const DOING: ProjectStatus = {
  id: "s2", projectId: "p1", key: "doing", label: "In progress", category: "in_progress",
  position: 1, createdAt: "2026-07-03T00:00:00Z",
};

const PARTICIPANT: ProjectParticipant = {
  id: "pp1", projectId: "p1", participantKind: "customer", participantId: "cust-1",
  role: "member", addedBy: null, addedAt: "2026-07-03T00:00:00Z",
};

function item(id: string, title: string): WorkItem {
  return {
    id, projectId: "p1", itemKey: "", title, description: "", statusId: "s1",
    assigneeKind: null, assigneeId: null, priority: 0,
    startDate: null, dueDate: null, labels: [], parentId: null, rank: "V0",
    // Unplanned and unsized — the three fields the planning axes read. This file is about the
    // SELECTION, so every card sits outside every plan: nothing here should depend on them.
    iterationId: null, milestoneId: null, estimate: null,
    createdAt: "2026-07-03T00:00:00Z", updatedAt: "2026-07-03T00:00:00Z",
  };
}

const ONE = item("w1", "First item");
const TWO = item("w2", "Second item");

function renderList(): { onChanged: ReturnType<typeof vi.fn> } {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(
    <ListView
      projectId="p1"
      items={[ONE, TWO]}
      statuses={[TODO, DOING]}
      participants={[PARTICIPANT]}
      iterations={[]}
      milestones={[]}
      estimateScale="none"
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

/** The row a title editor sits in. Selection is the ROW's business, not the cell's: `data-table`
 *  routes a click whose target is a control inside a cell (this list's titles are inline editors)
 *  through `fromCellControl`, which deliberately ignores the modifier keys — a control click may
 *  move a single selection so the details pane follows, but must never rewrite a multiple one, or
 *  opening a row's inline menu with thirty rows ticked would silently reduce the next Delete to
 *  one row. So alt-clicking the INPUT can only ever select that one row, which is what these three
 *  tests were quietly asserting against before: the dialog opened over a selection of one. */
function row(title: string): HTMLElement {
  const el = screen.getByDisplayValue(title).closest('[role="row"]');
  if (!el) throw new Error(`no [role="row"] around the "${title}" editor`);
  return el as HTMLElement;
}

/** Select both rows: a plain click sets the anchor, an alt-click adds the second. */
function selectBoth(): void {
  fireEvent.click(row("First item"));
  fireEvent.click(row("Second item"), { altKey: true });
}

/** The confirm button INSIDE the open dialog, as distinct from the toolbar button that opened it. */
function dialogButton(label: string): HTMLButtonElement {
  const dialog = screen.getByRole("dialog");
  const found = Array.from(dialog.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no "${label}" button in the dialog`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation((id, patch) => Promise.resolve({ ...ONE, id, ...patch } as WorkItem));
  remove.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("bulkPatchOf", () => {
  it("sends nothing for a draft nobody touched", () => {
    expect(bulkPatchOf({ statusId: "", assignee: "", priority: "" })).toEqual({});
  });

  it("sends ONLY the fields the user set", () => {
    expect(bulkPatchOf({ statusId: "s2", assignee: "", priority: "" })).toEqual({ statusId: "s2" });
  });

  it("carries priority 0 (None), which is a real value and not 'unchanged'", () => {
    // "" is the sentinel, not a falsy priority — a bulk clear to None has to travel.
    expect(bulkPatchOf({ statusId: "", assignee: "", priority: "0" })).toEqual({ priority: 0 });
  });

  it("resolves an assignee option into the (kind, id) pair", () => {
    expect(bulkPatchOf({ statusId: "", assignee: "customer:cust-1", priority: "" })).toEqual({
      assigneeKind: "customer",
      assigneeId: "cust-1",
    });
  });

  it("clears the assignee on the explicit Unassigned option", () => {
    // Distinct from "leave unchanged": the pair travels as null rather than being omitted.
    expect(bulkPatchOf({ statusId: "", assignee: "unassigned", priority: "" })).toEqual({
      assigneeKind: null,
      assigneeId: null,
    });
  });
});

describe("bulk actions over a multi-selection", () => {
  it("arms Update… only once something is selected", () => {
    renderList();
    const btn = (): HTMLButtonElement =>
      screen.getByRole("button", { name: "Update…" }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    fireEvent.click(screen.getByDisplayValue("First item"));
    expect(btn().disabled).toBe(false);
  });

  it("patches every selected row with the fields the dialog set, then reloads", async () => {
    const { onChanged } = renderList();
    selectBoth();
    fireEvent.click(screen.getByRole("button", { name: "Update…" }));

    expect(screen.getByText("Update 2 work items")).not.toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Status for every selected row" }), {
      target: { value: "s2" },
    });
    fireEvent.click(dialogButton("Update"));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update).toHaveBeenCalledWith("w1", { statusId: "s2" });
    expect(update).toHaveBeenCalledWith("w2", { statusId: "s2" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    // The dialog closes on success, so the same change cannot be applied twice by accident.
    await waitFor(() => expect(screen.queryByText("Update 2 work items")).toBeNull());
  });

  it("refuses to send an empty patch — Update stays disabled until a field is set", () => {
    renderList();
    selectBoth();
    fireEvent.click(screen.getByRole("button", { name: "Update…" }));
    expect(dialogButton("Update").disabled).toBe(true);

    fireEvent.change(screen.getByRole("combobox", { name: "Priority for every selected row" }), {
      target: { value: "3" },
    });
    expect(dialogButton("Update").disabled).toBe(false);
  });

  it("deletes every selected row, but only after the confirmation", async () => {
    const { onChanged } = renderList();
    selectBoth();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();

    // The confirmation says what actually happens to the sub-items of a deleted row.
    expect(screen.getByText(/they move up to the top level/)).not.toBeNull();
    fireEvent.click(dialogButton("Delete"));

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
    expect(remove).toHaveBeenCalledWith("w1");
    expect(remove).toHaveBeenCalledWith("w2");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("reports a PARTIAL failure honestly — the survivors keep their change", async () => {
    const { onChanged } = renderList();
    remove.mockImplementation((id: string) =>
      id === "w2" ? Promise.reject(new Error("gone")) : Promise.resolve(undefined),
    );
    selectBoth();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(dialogButton("Delete"));

    expect(await screen.findByText("1 of 2 work items could not be deleted: gone")).not.toBeNull();
    // The one that DID land is stored, so the view must re-read either way.
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
