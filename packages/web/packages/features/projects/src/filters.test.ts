// Unit tests for the work-item FILTER — the value five views narrow themselves by.
//
// What is worth testing here is not "a predicate returns fewer rows". It is the handful of
// decisions the model makes that a caller could plausibly have made the other way, and that
// nothing else in the system would catch if they silently changed:
//
//   - which axes AND (all of them, including within `labels`);
//   - that "unassigned" and "backlog" are ANSWERS, distinct from "any";
//   - that an item with no due date is outside every window rather than inside all of them;
//   - that an inactive filter returns the SAME array, which is what a memoised view rides on;
//   - that a filter survives a round trip through storage, and that an OLD stored filter still
//     decodes — the property saved views are built on.
import { describe, it, expect } from "vitest";
import type { WorkItem } from "@agentic-toolkit/data/projects";
import {
  EMPTY_FILTER,
  NO_ITERATION,
  UNASSIGNED,
  applyWorkItemFilter,
  decodeFilter,
  encodeFilter,
  isFilterActive,
  type WorkItemFilter,
} from "./filters";

function item(over: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    projectId: "p1",
    itemKey: "ADH-1",
    title: "A card",
    description: "",
    statusId: "st-todo",
    assigneeKind: null,
    assigneeId: null,
    priority: 0,
    startDate: null,
    dueDate: null,
    labels: [],
    parentId: null,
    iterationId: null,
    estimate: null,
    rank: "a0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const filter = (over: Partial<WorkItemFilter>): WorkItemFilter => ({ ...EMPTY_FILTER, ...over });
const ids = (rows: WorkItem[]): string[] => rows.map((r) => r.id);

describe("isFilterActive", () => {
  it("is false for the empty filter and for whitespace-only text", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive(filter({ text: "   " }))).toBe(false);
  });

  it("is true for any single axis, including an empty-string sentinel that means something", () => {
    expect(isFilterActive(filter({ iterationId: NO_ITERATION }))).toBe(true);
    expect(isFilterActive(filter({ assignee: UNASSIGNED }))).toBe(true);
    expect(isFilterActive(filter({ priority: "0" }))).toBe(true);
    expect(isFilterActive(filter({ labels: ["bug"] }))).toBe(true);
    expect(isFilterActive(filter({ dueTo: "2026-02-01" }))).toBe(true);
  });
});

describe("applyWorkItemFilter", () => {
  it("returns the very same array when nothing is narrowed", () => {
    // Identity, not equality: a view memoised on its items must not repaint for a no-op filter.
    const items = [item({ id: "a" })];
    expect(applyWorkItemFilter(items, EMPTY_FILTER)).toBe(items);
  });

  it("matches text against the key, the title and the description, case-insensitively", () => {
    const items = [
      item({ id: "key", itemKey: "ADH-42", title: "Nothing", description: "" }),
      item({ id: "title", itemKey: "ADH-1", title: "The Login screen" }),
      item({ id: "body", itemKey: "ADH-2", title: "Other", description: "fails on LOGIN" }),
      item({ id: "miss", itemKey: "ADH-3", title: "Other", description: "unrelated" }),
    ];
    expect(ids(applyWorkItemFilter(items, filter({ text: "adh-42" })))).toEqual(["key"]);
    expect(ids(applyWorkItemFilter(items, filter({ text: "login" })))).toEqual(["title", "body"]);
  });

  it("ANDs the axes", () => {
    const items = [
      item({ id: "both", statusId: "st-doing", priority: 3 }),
      item({ id: "status-only", statusId: "st-doing", priority: 1 }),
      item({ id: "priority-only", statusId: "st-todo", priority: 3 }),
    ];
    const narrowed = applyWorkItemFilter(items, filter({ statusId: "st-doing", priority: "3" }));
    expect(ids(narrowed)).toEqual(["both"]);
  });

  it("treats priority 0 as a real value, not as 'any'", () => {
    // The trap: `Number("0")` is falsy, so a truthiness check here would silently make the
    // "None" priority unfilterable — the one priority most cards actually have.
    const items = [item({ id: "none", priority: 0 }), item({ id: "urgent", priority: 4 })];
    expect(ids(applyWorkItemFilter(items, filter({ priority: "0" })))).toEqual(["none"]);
  });

  it("filters by assignee through the composite codec, and 'unassigned' is its own answer", () => {
    const items = [
      item({ id: "mine", assigneeKind: "customer", assigneeId: "cust-1" }),
      item({ id: "theirs", assigneeKind: "persona", assigneeId: "p-9" }),
      item({ id: "nobody" }),
    ];
    expect(ids(applyWorkItemFilter(items, filter({ assignee: "customer:cust-1" })))).toEqual([
      "mine",
    ]);
    expect(ids(applyWorkItemFilter(items, filter({ assignee: UNASSIGNED })))).toEqual(["nobody"]);
    // …and "any assignee" is the absence of the axis, so it keeps all three.
    expect(applyWorkItemFilter(items, filter({ assignee: "" })).length).toBe(3);
  });

  it("filters by iteration, with the backlog sentinel selecting the uncommitted cards", () => {
    const items = [
      item({ id: "committed", iterationId: "it-1" }),
      item({ id: "elsewhere", iterationId: "it-2" }),
      item({ id: "backlog" }),
    ];
    expect(ids(applyWorkItemFilter(items, filter({ iterationId: "it-1" })))).toEqual(["committed"]);
    expect(ids(applyWorkItemFilter(items, filter({ iterationId: NO_ITERATION })))).toEqual([
      "backlog",
    ]);
  });

  it("requires EVERY listed label, not any of them", () => {
    const items = [
      item({ id: "both", labels: ["bug", "ui", "p2"] }),
      item({ id: "one", labels: ["bug"] }),
      item({ id: "none", labels: [] }),
    ];
    expect(ids(applyWorkItemFilter(items, filter({ labels: ["bug", "ui"] })))).toEqual(["both"]);
  });

  it("bounds the due date inclusively at both ends, either end alone", () => {
    const items = [
      item({ id: "early", dueDate: "2026-02-01" }),
      item({ id: "mid", dueDate: "2026-02-10" }),
      item({ id: "late", dueDate: "2026-02-20" }),
    ];
    expect(
      ids(applyWorkItemFilter(items, filter({ dueFrom: "2026-02-01", dueTo: "2026-02-10" }))),
    ).toEqual(["early", "mid"]);
    expect(ids(applyWorkItemFilter(items, filter({ dueFrom: "2026-02-20" })))).toEqual(["late"]);
    expect(ids(applyWorkItemFilter(items, filter({ dueTo: "2026-02-01" })))).toEqual(["early"]);
  });

  it("puts an item with no due date OUTSIDE every window", () => {
    // A window asks when something is due. "Never" is not a date in it — and the alternative
    // (undated cards passing every window) would make an open-ended range useless.
    const items = [item({ id: "dated", dueDate: "2026-02-10" }), item({ id: "undated" })];
    expect(ids(applyWorkItemFilter(items, filter({ dueFrom: "2026-01-01" })))).toEqual(["dated"]);
    expect(ids(applyWorkItemFilter(items, filter({ dueTo: "2099-01-01" })))).toEqual(["dated"]);
  });
});

describe("encodeFilter / decodeFilter", () => {
  it("writes only the axes that narrow anything", () => {
    expect(encodeFilter(EMPTY_FILTER)).toEqual({});
    expect(encodeFilter(filter({ text: "  login  ", statusId: "st-1" }))).toEqual({
      text: "login",
      statusId: "st-1",
    });
  });

  it("round-trips a filter through its serialised form", () => {
    const original = filter({
      text: "login",
      statusId: "st-1",
      assignee: "customer:cust-1",
      iterationId: NO_ITERATION,
      priority: "3",
      labels: ["bug", "ui"],
      dueFrom: "2026-02-01",
      dueTo: "2026-02-28",
    });
    expect(decodeFilter(encodeFilter(original))).toEqual(original);
  });

  it("decodes an OLD or malformed record to something harmless", () => {
    // The property saved views rest on: a stored filter is data written by another build, so a
    // missing axis means "any" and a wrong-shaped one is ignored — never an unopenable view.
    expect(decodeFilter({ statusId: "st-1" })).toEqual(filter({ statusId: "st-1" }));
    expect(decodeFilter(null)).toEqual(EMPTY_FILTER);
    expect(decodeFilter("nonsense")).toEqual(EMPTY_FILTER);
    expect(decodeFilter({ priority: 3, labels: "bug" })).toEqual(EMPTY_FILTER);
    expect(decodeFilter({ labels: ["bug", 7, null] })).toEqual(filter({ labels: ["bug"] }));
    // An axis this build has never heard of is dropped, not carried into the filter.
    expect(decodeFilter({ text: "x", milestoneId: "m-1" })).toEqual(filter({ text: "x" }));
  });
});
