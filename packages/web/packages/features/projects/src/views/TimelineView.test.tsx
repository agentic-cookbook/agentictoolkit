// @vitest-environment jsdom
//
// Component test for TimelineView — the Gantt-lite Timeline VIEW of the work-
// items surface. TimelineView is PRESENTATIONAL (no data load, no editor), so it
// takes items as props and reports a row click via `onOpenItem`. Covers: one bar
// per DATED item positioned within the range (a known range gets a non-zero
// width), a no-date item lands in the "No dates" section (not on the axis, not
// crashing), a single-date item still renders (as a point marker), a row click
// opens the item, and the empty state. All dates are FIXED strings — nothing
// reads "today".
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { TimelineView } from "./TimelineView";
import { type WorkItem } from "@agentic-toolkit/data/projects";

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
    rank: "V0",
    createdAt: "2026-07-03T00:00:00Z",
    updatedAt: "2026-07-03T00:00:00Z",
    ...over,
  };
}

// A spread of dated + undated items so the axis and the "No dates" section both
// render: a full range, a due-only (point), and a fully undated item.
const RANGED = makeItem({
  id: "w1",
  title: "Design the landing page",
  priority: 3,
  startDate: "2026-07-01",
  dueDate: "2026-07-31",
});
const POINT = makeItem({
  id: "w2",
  title: "Ship the beta",
  dueDate: "2026-07-15", // only a due date → a point marker
});
const UNDATED = makeItem({
  id: "w3",
  title: "Backlog grooming", // no start, no due → "No dates"
});
// A present but IMPOSSIBLE date string (month 13, day 40) → dayIndex returns null, so
// the item must fall to "No dates" instead of drawing a NaN-geometry bar.
const MALFORMED = makeItem({
  id: "w4",
  title: "Typo date",
  startDate: "2026-13-40",
  dueDate: null,
});

// The hub vitest config has no global afterEach — tear down each render explicitly.
afterEach(cleanup);

describe("TimelineView", () => {
  it("renders one bar per dated item with its title label", () => {
    render(<TimelineView items={[RANGED, POINT, UNDATED]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);

    // Titles render for every item (dated rows + the "No dates" row).
    expect(screen.getByText("Design the landing page")).not.toBeNull();
    expect(screen.getByText("Ship the beta")).not.toBeNull();
    expect(screen.getByText("Backlog grooming")).not.toBeNull();

    // A bar (or point) per DATED item — the two dated items, NOT the undated one.
    expect(screen.getAllByTestId("timeline-bar")).toHaveLength(2);
  });

  it("gives an item with a known range a bar with a non-zero width", () => {
    // Two dated items so the range spans 2026-07-01 … 2026-07-31 (30 days) and the
    // ranged bar occupies a real, non-zero fraction of it.
    render(<TimelineView items={[RANGED, POINT]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);

    const bars = screen.getAllByTestId("timeline-bar");
    const ranged = bars.find((b) => b.getAttribute("data-item") === "w1");
    expect(ranged).toBeDefined();
    const width = parseFloat(ranged!.style.width);
    expect(width).toBeGreaterThan(0);
  });

  it("puts an item with no dates in the 'No dates' section, off the axis", () => {
    render(<TimelineView items={[RANGED, UNDATED]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);

    // The section header renders and the undated item is NOT drawn as a bar.
    expect(screen.getByText("No dates")).not.toBeNull();
    const barItemIds = screen
      .getAllByTestId("timeline-bar")
      .map((b) => b.getAttribute("data-item"));
    expect(barItemIds).not.toContain("w3");
  });

  it("renders only the 'No dates' section when no item is dated (no axis crash)", () => {
    render(<TimelineView items={[UNDATED]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);

    expect(screen.getByText("No dates")).not.toBeNull();
    expect(screen.getByText("Backlog grooming")).not.toBeNull();
    // No dated items → no axis, so no bars at all.
    expect(screen.queryAllByTestId("timeline-bar")).toHaveLength(0);
  });

  it("calls onOpenItem with the item id when a row is clicked", () => {
    const onOpenItem = vi.fn();
    render(<TimelineView items={[RANGED, UNDATED]} onOpenItem={onOpenItem} onSetSpan={vi.fn()} />);

    fireEvent.click(screen.getByText("Design the landing page"));
    expect(onOpenItem).toHaveBeenCalledWith("w1");

    // The undated row is clickable too.
    fireEvent.click(screen.getByText("Backlog grooming"));
    expect(onOpenItem).toHaveBeenCalledWith("w3");
  });

  it("renders the EmptyState when there are no items", () => {
    render(<TimelineView items={[]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);
    expect(screen.getByText("No work items yet.")).not.toBeNull();
    // The empty branch is the EmptyState, not the axis.
    expect(screen.queryAllByTestId("timeline-bar")).toHaveLength(0);
  });

  it("routes an item with a malformed date to 'No dates' without poisoning other bars", () => {
    render(<TimelineView items={[RANGED, POINT, MALFORMED]} onOpenItem={vi.fn()} onSetSpan={vi.fn()} />);

    // The bad-date item is listed under "No dates", never drawn as a bar…
    expect(screen.getByText("No dates")).not.toBeNull();
    expect(screen.getByText("Typo date")).not.toBeNull();
    const bars = screen.getAllByTestId("timeline-bar");
    const barIds = bars.map((b) => b.getAttribute("data-item")).sort();
    expect(barIds).toEqual(["w1", "w2"]); // exactly the two well-dated items
    expect(barIds).not.toContain("w4");

    // …and the ranged bar's geometry stays a real, finite, positive width (never NaN
    // from the bad date leaking into the shared axis range).
    const ranged = bars.find((b) => b.getAttribute("data-item") === "w1");
    const width = parseFloat(ranged!.style.width);
    expect(Number.isNaN(width)).toBe(false);
    expect(width).toBeGreaterThan(0);
  });
});
