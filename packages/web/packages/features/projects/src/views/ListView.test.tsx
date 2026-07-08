// @vitest-environment jsdom
//
// Component test for ListView — the List VIEW of the work-items surface. ListView
// is PRESENTATIONAL (no data load, no editor), so it takes items/statuses/
// participants as props and reports a row selection via `onOpenItem`. These
// assertions are ported from the former ProjectWorkItemsPane test (the render +
// row-select behaviors); the create/edit editor flow now lives on the surface and
// is covered by WorkItemsSurface.test.tsx.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { ListView } from "./ListView";
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

const ITEM: WorkItem = {
  id: "w1",
  projectId: "p1",
  title: "Design the landing page",
  description: "",
  statusId: "s1",
  assigneeKind: "customer",
  assigneeId: "cust-1",
  priority: 3, // High
  startDate: null,
  dueDate: "2026-08-01",
  labels: [],
  parentId: null,
  position: 0,
  createdAt: "2026-07-03T00:00:00Z",
  updatedAt: "2026-07-03T00:00:00Z",
};

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

describe("ListView", () => {
  it("renders each work item with status + priority badges and the assignee label", () => {
    render(
      <ListView
        items={[ITEM]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        onOpenItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Design the landing page")).not.toBeNull();
    expect(screen.getByText("To do")).not.toBeNull(); // status Badge (from the item's statusId)
    expect(screen.getByText("High")).not.toBeNull(); // priority Badge (priority 3)
    expect(screen.getByText("customer · cust-1")).not.toBeNull(); // resolved assignee label
  });

  it("calls onOpenItem with the row id when a row is selected", () => {
    const onOpenItem = vi.fn();
    render(
      <ListView
        items={[ITEM]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        onOpenItem={onOpenItem}
      />,
    );

    fireEvent.click(screen.getByText("Design the landing page"));
    expect(onOpenItem).toHaveBeenCalledWith("w1");
  });

  it("renders the empty label when there are no items", () => {
    render(
      <ListView items={[]} statuses={[STATUS]} participants={[]} onOpenItem={vi.fn()} />,
    );
    expect(screen.getByText("No work items yet.")).not.toBeNull();
  });
});
