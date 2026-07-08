// @vitest-environment jsdom
//
// Component test for CalendarView — the month-grid Calendar VIEW of the work-items
// surface. CalendarView is PRESENTATIONAL (no data load, no editor): it places each
// item on its `dueDate` cell and reports a chip click via `onOpenItem`. The clock is
// PINNED to 2026-07-15T12:00:00Z so "today" and the default visible month (July 2026)
// are deterministic regardless of the runner's timezone. Covers: a due item lands on
// its UTC day cell (2026-07-01 → July 1, NOT June 30), a chip click opens the item,
// prev/next changes the visible month (the July item leaves, an August item arrives),
// a no-due-date item stays off the grid, and today's cell is marked.
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

import { CalendarView } from "./CalendarView";
import { type WorkItem } from "@agentic-toolkit/data/projects";

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

// A July-due item, an August-due item, a first-of-month item (the UTC-edge case),
// and a fully undated one.
const JULY = makeItem({ id: "w1", title: "Design the landing page", priority: 3, dueDate: "2026-07-20" });
const AUGUST = makeItem({ id: "w2", title: "Ship the beta", priority: 2, dueDate: "2026-08-10" });
const FIRST = makeItem({ id: "w3", title: "Kickoff meeting", dueDate: "2026-07-01" });
const UNDATED = makeItem({ id: "w4", title: "Backlog grooming" });

// Force a fixed, non-UTC timezone (America/Los_Angeles = UTC-7 in July) so the
// "today is derived from the LOCAL calendar day" assertion below is deterministic on
// any runner (a UTC runner could never construct a UTC instant that is a different
// LOCAL day). Restored after the suite so it can't leak into sibling files.
const ORIG_TZ = process.env.TZ;
beforeEach(() => {
  process.env.TZ = "America/Los_Angeles";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
afterAll(() => {
  if (ORIG_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIG_TZ;
});

/** The month grid region (the July item's cells live here, the "No due date"
 *  strip does not). */
function grid(): HTMLElement {
  return screen.getByRole("grid");
}

describe("CalendarView", () => {
  it("defaults to the month of 'today' and places a due item in that month's cell", () => {
    render(<CalendarView items={[JULY, AUGUST, FIRST, UNDATED]} onOpenItem={vi.fn()} />);

    // The pinned clock → July 2026 is the default visible month.
    expect(screen.getByRole("grid").getAttribute("aria-label")).toContain("July 2026");
    // The July item's chip is on the grid; the August item is not (different month).
    expect(within(grid()).getByText("Design the landing page")).not.toBeNull();
    expect(within(grid()).queryByText("Ship the beta")).toBeNull();
  });

  it("places a 2026-07-01 due item on July 1 (UTC), not the trailing June 30 cell", () => {
    render(<CalendarView items={[FIRST]} onOpenItem={vi.fn()} />);

    // The July-1 chip sits inside the gridcell aria-labelled for July 1, 2026 —
    // proving the UTC parse didn't shift it back into the greyed June 30 spill cell.
    const july1 = screen.getByRole("gridcell", { name: /July 1, 2026$/ });
    expect(within(july1).getByText("Kickoff meeting")).not.toBeNull();
  });

  it("calls onOpenItem with the item id when a chip is clicked", () => {
    const onOpenItem = vi.fn();
    render(<CalendarView items={[JULY, UNDATED]} onOpenItem={onOpenItem} />);

    fireEvent.click(within(grid()).getByText("Design the landing page"));
    expect(onOpenItem).toHaveBeenCalledWith("w1");
  });

  it("changes the visible month with next: the July item leaves, the August item arrives", () => {
    render(<CalendarView items={[JULY, AUGUST]} onOpenItem={vi.fn()} />);

    // July by default: July item present, August absent.
    expect(within(grid()).getByText("Design the landing page")).not.toBeNull();
    expect(within(grid()).queryByText("Ship the beta")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    // Now August 2026: the August item shows, the July item is gone.
    expect(screen.getByRole("grid").getAttribute("aria-label")).toContain("August 2026");
    expect(within(grid()).getByText("Ship the beta")).not.toBeNull();
    expect(within(grid()).queryByText("Design the landing page")).toBeNull();
  });

  it("keeps an item with no due date off the grid", () => {
    render(<CalendarView items={[JULY, UNDATED]} onOpenItem={vi.fn()} />);

    // The undated item never lands on a day cell…
    expect(within(grid()).queryByText("Backlog grooming")).toBeNull();
    // …it's surfaced in the separate "No due date" strip instead (not dropped).
    const strip = screen.getByTestId("calendar-undated");
    expect(within(strip).getByText("Backlog grooming")).not.toBeNull();
  });

  it("marks today's cell (2026-07-15) when viewing the current month", () => {
    render(<CalendarView items={[JULY]} onOpenItem={vi.fn()} />);

    const todayCell = screen.getByTestId("calendar-today");
    expect(todayCell.getAttribute("aria-label")).toContain("July 15, 2026");
    expect(todayCell.getAttribute("aria-current")).toBe("date");

    // Navigating away drops the today marker (today isn't in August).
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.queryByTestId("calendar-today")).toBeNull();
  });

  it("renders the EmptyState when there are no items", () => {
    render(<CalendarView items={[]} onOpenItem={vi.fn()} />);
    expect(screen.getByText("No work items yet.")).not.toBeNull();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("derives 'today' and the default month from the viewer's LOCAL day, not the UTC instant", () => {
    // 2026-08-01T04:00:00Z is still 2026-07-31 (21:00) in America/Los_Angeles (UTC-7):
    // the viewer's wall clock reads July 31 while UTC has already crossed into August.
    // The old code (UTC day of the instant) would open August and ring Aug 1.
    vi.setSystemTime(new Date("2026-08-01T04:00:00Z"));
    render(<CalendarView items={[JULY]} onOpenItem={vi.fn()} />);

    // The initially-selected month follows the LOCAL day → July 2026, not August.
    expect(screen.getByRole("grid").getAttribute("aria-label")).toContain("July 2026");
    // …and the Today ring lands on July 31 (local), never the UTC-rolled Aug 1.
    const todayCell = screen.getByTestId("calendar-today");
    expect(todayCell.getAttribute("aria-label")).toContain("July 31, 2026");
    expect(todayCell.getAttribute("aria-current")).toBe("date");
  });
});
