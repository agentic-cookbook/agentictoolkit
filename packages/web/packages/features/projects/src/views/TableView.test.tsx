// @vitest-environment jsdom
//
// Component test for TableView — the dense Table (spreadsheet) VIEW of the work-
// items surface. TableView is PRESENTATIONAL (no data load, no editor), so it takes
// items/statuses/participants as props and reports a row selection via `onOpenItem`.
// Covers: every column populated per row, client-side sort reorders the rows, a row
// click opens the item, and the empty state.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

import { TableView } from "./TableView";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";

const STATUS: ProjectStatus = {
  id: "s1",
  projectId: "p1",
  key: "todo",
  label: "To do",
  category: "todo",
  position: 0,
  createdAt: "2026-07-03T00:00:00Z",
};

const PARTICIPANT: ProjectParticipant = {
  id: "pp1",
  projectId: "p1",
  participantKind: "customer",
  participantId: "cust-1",
  role: "member",
  addedBy: null,
  addedAt: "2026-07-03T00:00:00Z",
};

function makeItem(over: Partial<WorkItem> & Pick<WorkItem, "id" | "title">): WorkItem {
  return {
    projectId: "p1",
    description: "",
    statusId: "s1",
    assigneeKind: null,
    assigneeId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    position: 0,
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

const FULL: WorkItem = makeItem({
  id: "w1",
  title: "Design the landing page",
  assigneeKind: "customer",
  assigneeId: "cust-1",
  priority: 3, // High
  startDate: "2026-07-15",
  dueDate: "2026-08-01",
  labels: ["ui", "urgent"],
});

/** Data-row titles in DOM order (row 0 is the header row — dropped). */
function titlesInOrder(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("gridcell")[0]?.textContent ?? "");
}

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

describe("TableView", () => {
  it("renders a row with every column populated", () => {
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        onOpenItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Design the landing page")).not.toBeNull(); // title
    expect(screen.getByText("To do")).not.toBeNull(); // status label (from statusId)
    expect(screen.getByText("customer · cust-1")).not.toBeNull(); // resolved assignee
    expect(screen.getByText("High")).not.toBeNull(); // priority label (priority 3)
    expect(screen.getByText("2026-07-15")).not.toBeNull(); // start date
    expect(screen.getByText("2026-08-01")).not.toBeNull(); // due date
    expect(screen.getByText("ui, urgent")).not.toBeNull(); // comma-joined labels
  });

  it("sorts the rows when a sortable column header is clicked", () => {
    // Passed in a non-sorted order so an asc title sort visibly reorders them.
    const items = [
      makeItem({ id: "c", title: "Charlie" }),
      makeItem({ id: "a", title: "Alpha" }),
      makeItem({ id: "b", title: "Bravo" }),
    ];
    render(
      <TableView
        items={items}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        onOpenItem={vi.fn()}
      />,
    );

    expect(titlesInOrder()).toEqual(["Charlie", "Alpha", "Bravo"]); // items order

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(titlesInOrder()).toEqual(["Alpha", "Bravo", "Charlie"]); // asc

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(titlesInOrder()).toEqual(["Charlie", "Bravo", "Alpha"]); // desc
  });

  it("calls onOpenItem with the row id when a row is selected", () => {
    const onOpenItem = vi.fn();
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        onOpenItem={onOpenItem}
      />,
    );

    fireEvent.click(screen.getByText("Design the landing page"));
    expect(onOpenItem).toHaveBeenCalledWith("w1");
  });

  it("renders the EmptyState when there are no items", () => {
    render(
      <TableView items={[]} statuses={[STATUS]} participants={[]} onOpenItem={vi.fn()} />,
    );
    expect(screen.getByText("No work items yet.")).not.toBeNull();
    // The empty branch is the EmptyState, not a DataTable grid.
    expect(screen.queryByRole("grid")).toBeNull();
  });
});
