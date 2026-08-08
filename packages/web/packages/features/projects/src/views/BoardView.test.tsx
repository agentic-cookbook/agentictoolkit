// @vitest-environment jsdom
//
// Component test for BoardView — the Board VIEW of the work-items surface. BoardView
// is PRESENTATIONAL (no data load, no move state): it groups the given items into
// status columns and reports a per-card move via `onMove(itemId, statusId)`. These
// group-by-status + call-through assertions are ported from the former
// ProjectBoardPane test; the optimistic-with-revert move now lives on the surface
// and is covered by WorkItemsSurface.test.tsx.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

import { BoardView } from "./BoardView";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus } from "@agentic-toolkit/data/projects";

function status(over: Partial<ProjectStatus>): ProjectStatus {
  return {
    id: "s",
    projectId: "p1",
    key: "k",
    label: "L",
    category: "todo",
    position: 0,
    createdAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

function item(over: Partial<WorkItem>): WorkItem {
  return {
    id: "w",
    projectId: "p1",
    itemKey: "",
    title: "T",
    description: "",
    statusId: "s1",
    assigneeKind: null,
    assigneeId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    iterationId: null,
    estimate: null,
    rank: "V0",
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

// Three statuses; passed OUT of position order to prove the view sorts them.
const TODO = status({ id: "s1", key: "todo", label: "To do", category: "todo", position: 0 });
const DOING = status({ id: "s2", key: "doing", label: "In progress", category: "in_progress", position: 1 });
const DONE = status({ id: "s3", key: "done", label: "Done", category: "done", position: 2 });

// w1 in To do (High priority), w2 in In progress; Done stays empty.
const W1 = item({ id: "w1", title: "Design the landing page", statusId: "s1", priority: 3 });
const W2 = item({ id: "w2", title: "Write the copy", statusId: "s2", priority: 1 });

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

describe("BoardView", () => {
  it("renders one column per status in position order, items grouped under each", () => {
    render(
      <BoardView items={[W1, W2]} statuses={[DONE, TODO, DOING]} participants={[]} estimateScale="none" onMove={vi.fn()} />,
    );

    const cols = screen.getAllByRole("listitem");
    expect(cols.map((c) => c.getAttribute("aria-label"))).toEqual([
      "To do",
      "In progress",
      "Done",
    ]);

    within(screen.getByRole("listitem", { name: "To do" })).getByText("Design the landing page");
    within(screen.getByRole("listitem", { name: "In progress" })).getByText("Write the copy");
  });

  it("shows a card's title and priority Badge", () => {
    render(
      <BoardView items={[W1, W2]} statuses={[DONE, TODO, DOING]} participants={[]} estimateScale="none" onMove={vi.fn()} />,
    );

    const todo = screen.getByRole("listitem", { name: "To do" });
    within(todo).getByText("Design the landing page"); // title
    within(todo).getByText("High"); // priority Badge (priority 3)
  });

  it("renders an empty state for a column with no items", () => {
    render(
      <BoardView items={[W1, W2]} statuses={[DONE, TODO, DOING]} participants={[]} estimateScale="none" onMove={vi.fn()} />,
    );

    const done = screen.getByRole("listitem", { name: "Done" });
    within(done).getByText("No items");
  });

  it("calls onMove(itemId, statusId) when a card's Move select changes", () => {
    const onMove = vi.fn();
    render(
      <BoardView items={[W1, W2]} statuses={[DONE, TODO, DOING]} participants={[]} estimateScale="none" onMove={onMove} />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Move Design the landing page" }), {
      target: { value: "s2" },
    });

    expect(onMove).toHaveBeenCalledWith("w1", "s2");
  });

  it("shows a trailing No status column for cards whose status is stale", () => {
    const orphan = item({ id: "w3", title: "Orphaned card", statusId: "gone" });
    render(
      <BoardView items={[orphan]} statuses={[TODO, DOING, DONE]} participants={[]} estimateScale="none" onMove={vi.fn()} />,
    );

    within(screen.getByRole("listitem", { name: "No status" })).getByText("Orphaned card");
  });

  it("shows a card's key above its title", () => {
    render(
      <BoardView
        items={[item({ id: "w1", title: "Design the landing page", itemKey: "WEB-42" })]}
        statuses={[TODO]}
        participants={[]}
        estimateScale="none"
        onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("WEB-42")).not.toBeNull();
  });

  it("omits the key line entirely for a project with no prefix", () => {
    render(
      <BoardView
        items={[item({ id: "w1", title: "Design the landing page", itemKey: "" })]}
        statuses={[TODO]}
        participants={[]}
        estimateScale="none" onMove={vi.fn()}
      />,
    );
    // The card still renders — it just has no key line above the title.
    expect(screen.getByText("Design the landing page")).not.toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("renders an empty state when the project has no statuses (no columns)", () => {
    render(<BoardView items={[]} statuses={[]} participants={[]} estimateScale="none" onMove={vi.fn()} />);
    expect(screen.getByText("No board columns yet.")).not.toBeNull();
  });
});
