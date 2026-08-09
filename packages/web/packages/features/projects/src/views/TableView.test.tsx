// @vitest-environment jsdom
//
// Component test for TableView — the dense Table (spreadsheet) VIEW of the work-
// items surface. TableView is PRESENTATIONAL (no data load, no editor), so it takes
// items/statuses/participants as props and reports an OPENED row via `onOpenItem`.
// Covers: every column populated per row, client-side sort reorders the rows, the
// select/open grammar (click selects, double-click and Enter open), the bulk strip
// arming on a selection, and the empty state.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

import { TableView } from "./TableView";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import {
  type Iteration,
  type Milestone,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";

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
    itemKey: "",
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
    milestoneId: null,
    estimate: null,
    rank: "V0",
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

/** One workspace cycle; `state` is derived by the backend, so a fixture just states it. */
const CYCLE: Iteration = {
  id: "it1",
  name: "Sprint 7",
  description: "",
  startDate: "2026-07-01",
  endDate: "2026-07-14",
  state: "active",
  ownerKind: "customer",
  ownerId: "cust-1",
  ecosystemId: "eco-1",
  createdAt: "2026-06-30T00:00:00Z",
  updatedAt: "2026-06-30T00:00:00Z",
};

/** Two points in ONE board's plan; `counts` are derived by the backend, so a fixture states them.
 *  Passed to the view in the WRONG order on purpose — the column sorts by target date, not by the
 *  order the list happened to arrive in. */
const BETA: Milestone = {
  id: "ms1",
  projectId: "p1",
  name: "Beta",
  description: "",
  targetDate: "2026-08-15",
  counts: { backlog: 0, todo: 1, in_progress: 0, done: 1, canceled: 0 },
  ecosystemId: "eco-1",
  createdAt: "2026-06-30T00:00:00Z",
  updatedAt: "2026-06-30T00:00:00Z",
};
const GA: Milestone = { ...BETA, id: "ms2", name: "GA", targetDate: "2026-11-01" };

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

/** Data-row titles in DOM order (row 0 is the header row — dropped). Cell 0 is the
 *  Key column, so the title is cell 1. */
function titlesInOrder(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("gridcell")[1]?.textContent ?? "");
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
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
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
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(titlesInOrder()).toEqual(["Charlie", "Alpha", "Bravo"]); // items order

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(titlesInOrder()).toEqual(["Alpha", "Bravo", "Charlie"]); // asc

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(titlesInOrder()).toEqual(["Charlie", "Bravo", "Alpha"]); // desc
  });

  // The select/open grammar. A single click used to open the editor, which spent the table's only
  // click and left it unable to select anything — these three tests pin the split.
  it("selects the row on a single click, and does NOT open it", () => {
    const onOpenItem = vi.fn();
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={onOpenItem}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Design the landing page"));

    expect(onOpenItem).not.toHaveBeenCalled();
    expect(screen.getAllByRole("row")[1]?.getAttribute("aria-selected")).toBe("true");
    // The header counts what the actions will land on.
    expect(screen.getByText("1 selected")).not.toBeNull();
  });

  it("opens the row on a double-click", () => {
    const onOpenItem = vi.fn();
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={onOpenItem}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Design the landing page"));
    expect(onOpenItem).toHaveBeenCalledWith("w1");
  });

  it("opens the focused row on Enter", () => {
    const onOpenItem = vi.fn();
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={onOpenItem}
        onChanged={vi.fn()}
      />,
    );

    // Focusing the grid focuses its first row; Enter is the double-click's keyboard twin, so the
    // editor is reachable without a mouse.
    const grid = screen.getByRole("grid");
    fireEvent.focus(grid);
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onOpenItem).toHaveBeenCalledWith("w1");
  });

  it("arms the bulk actions only once a row is selected", () => {
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const update = (): HTMLButtonElement =>
      screen.getByRole("button", { name: "Update…" }) as HTMLButtonElement;
    const del = (): HTMLButtonElement =>
      screen.getByRole("button", { name: /Delete/ }) as HTMLButtonElement;

    expect(update().disabled).toBe(true);
    expect(del().disabled).toBe(true);

    fireEvent.click(screen.getByText("Design the landing page"));

    expect(update().disabled).toBe(false);
    expect(del().disabled).toBe(false);
  });

  // The Key column. It is the one column whose comparable is NOT its own text — see
  // `itemKeyNumber` — so its ordering is worth pinning at the view level too.
  it("shows each item's key in the first column", () => {
    render(
      <TableView
        items={[makeItem({ id: "w1", title: "Design the landing page", itemKey: "WEB-42" })]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("WEB-42")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Key" })).not.toBeNull();
  });

  it("renders nothing in the key cell for a project with no prefix", () => {
    render(
      <TableView
        items={[makeItem({ id: "w1", title: "Design the landing page", itemKey: "" })]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    // Empty, not a dash: a dash reads like a key whose value is "—".
    const [keyCell] = screen.getAllByRole("gridcell");
    expect(keyCell?.textContent).toBe("");
  });

  it("sorts the key column by NUMBER, so 7 lands before 42", () => {
    render(
      <TableView
        items={[
          makeItem({ id: "w1", title: "Forty-two", itemKey: "WEB-42" }),
          makeItem({ id: "w2", title: "Seven", itemKey: "WEB-7" }),
          makeItem({ id: "w3", title: "Nine", itemKey: "WEB-9" }),
        ]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Key" }));
    // A text sort would give 42, 7, 9 — the one order a reader would never expect.
    expect(titlesInOrder()).toEqual(["Seven", "Nine", "Forty-two"]);

    fireEvent.click(screen.getByRole("button", { name: "Key" }));
    expect(titlesInOrder()).toEqual(["Forty-two", "Nine", "Seven"]);
  });

  // The three PLANNING columns. Each is conditional on there being an answer to show — a workspace
  // that runs no cycles, a board with no plan, or a project that does not estimate, gets a column
  // of dashes otherwise.
  it("has no Iteration, Milestone or Estimate column when there is nothing to put in one", () => {
    render(
      <TableView
        items={[FULL]}
        statuses={[STATUS]}
        participants={[PARTICIPANT]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Iteration" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Milestone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Estimate" })).toBeNull();
  });

  it("names each card's milestone, and sorts the column by the milestone's TARGET DATE", () => {
    // Named so a TEXT sort would order them "Beta, GA" — the opposite of the plan's order, which
    // is what the column's comparable exists to avoid. Same shape as the cycle column above, and
    // deliberately a SEPARATE column: a card's cycle says which fortnight, its milestone says
    // which delivery, and a reader scanning the board wants both at once.
    render(
      <TableView
        items={[
          makeItem({ id: "w1", title: "Later", milestoneId: "ms2" }),
          makeItem({ id: "w2", title: "Sooner", milestoneId: "ms1" }),
          makeItem({ id: "w3", title: "Unaimed" }),
        ]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[GA, BETA]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("Beta")).not.toBeNull();
    expect(screen.getByText("GA")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Milestone" }));
    // Unaimed first (no target at all), then August, then November.
    expect(titlesInOrder()).toEqual(["Unaimed", "Sooner", "Later"]);
  });

  it("keeps the Milestone column independent of the Iteration column", () => {
    // The two are separate answers about the same card, so a board with a plan but no cycles gets
    // the one column it has answers for — folding either into the other would show both or
    // neither.
    render(
      <TableView
        items={[makeItem({ id: "w1", title: "Design the landing page", milestoneId: "ms1" })]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[BETA]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Milestone" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Iteration" })).toBeNull();
  });

  it("dashes a card whose milestone is not in the list, rather than printing its id", () => {
    // A detached or foreign id is a reference the reader cannot act on; showing the raw uuid in a
    // dense grid reads as data. (The DETAIL pane does show it — there the id is the only handle
    // on a value the reader may need to clear.)
    render(
      <TableView
        items={[makeItem({ id: "w1", title: "Orphan", milestoneId: "gone" })]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[BETA]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByText("gone")).toBeNull();
    // Cell 5 is the Milestone column here: Key, Title, Status, Assignee, Priority, Milestone —
    // with no cycles and no scale, the two columns either side of it are absent.
    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("gridcell")[5]?.textContent).toBe("—");
  });

  it("names each card's cycle, and sorts the column by the cycle's START", () => {
    // Named so a TEXT sort would order them "Sprint 10, Sprint 2" — the trap this column's
    // comparable exists to avoid.
    const late: Iteration = { ...CYCLE, id: "it2", name: "Sprint 10", startDate: "2026-09-01", endDate: "2026-09-14" };
    render(
      <TableView
        items={[
          makeItem({ id: "w1", title: "Later", iterationId: "it2" }),
          makeItem({ id: "w2", title: "Sooner", iterationId: "it1" }),
          makeItem({ id: "w3", title: "Backlog" }),
        ]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[CYCLE, late]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("Sprint 7")).not.toBeNull();
    expect(screen.getByText("Sprint 10")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Iteration" }));
    // Backlog first (no start at all), then July, then September.
    expect(titlesInOrder()).toEqual(["Backlog", "Sooner", "Later"]);
  });

  it("shows an estimate in the project's own scale, and sorts unestimated below every size", () => {
    render(
      <TableView
        items={[
          makeItem({ id: "w1", title: "Large", estimate: 3 }),
          makeItem({ id: "w2", title: "Unsized" }),
          makeItem({ id: "w3", title: "Free", estimate: 0 }),
        ]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[]}
        estimateScale="tshirt"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    // 3 on the t-shirt scale is "L" — the digits are an index into the scale, never the size.
    expect(screen.getByText("L")).not.toBeNull();
    expect(screen.getByText("XS")).not.toBeNull(); // the 0-sized card

    fireEvent.click(screen.getByRole("button", { name: "Estimate" }));
    expect(titlesInOrder()).toEqual(["Unsized", "Free", "Large"]);
  });

  it("renders the EmptyState when there are no items", () => {
    render(
      <TableView
        items={[]}
        statuses={[STATUS]}
        participants={[]}
        iterations={[]}
        milestones={[]}
        estimateScale="none"
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("No work items yet.")).not.toBeNull();
    // The empty branch is the EmptyState, not a DataTable grid.
    expect(screen.queryByRole("grid")).toBeNull();
  });
});
