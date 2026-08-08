// The two key helpers. Both exist because a rendered key (`WEB-42`) is a STRING that
// carries a number inside it, and treating it as either one alone gets something wrong:
// sorted as text it misorders, shown as text-only it disappears from the dense views.
import { describe, expect, it } from "vitest";

import { actionPhrase, dayDate, dayIndex, itemKeyNumber, itemLabel, relationLabel } from "./helpers";

describe("itemLabel", () => {
  it("names an item by key and title", () => {
    expect(itemLabel({ itemKey: "WEB-42", title: "Fix the login redirect" })).toBe(
      "WEB-42 — Fix the login redirect",
    );
  });

  it("falls back to the bare title when the project has no prefix yet", () => {
    // Not "— Fix…": a missing key is absence, and a dangling dash reads like a bug.
    expect(itemLabel({ itemKey: "", title: "Fix the login redirect" })).toBe(
      "Fix the login redirect",
    );
  });
});

// `dayDate` is the inverse `dayIndex` never had, and the drag surfaces depend on it being
// EXACTLY that: Calendar drops a chip on a day index and has to write the date string back,
// Timeline shifts an index by N days and does the same. A round trip that lands one day off
// is invisible in the UI — the chip appears where it was dropped — and wrong in the database.
describe("dayDate", () => {
  it("round-trips every date through its day index", () => {
    for (const date of ["2026-01-01", "2026-02-28", "2026-07-15", "2026-12-31", "2024-02-29"]) {
      expect(dayDate(dayIndex(date)!)).toBe(date);
    }
  });

  it("shifts across a month and a year boundary", () => {
    expect(dayDate(dayIndex("2026-07-31")! + 1)).toBe("2026-08-01");
    expect(dayDate(dayIndex("2026-12-31")! + 1)).toBe("2027-01-01");
    expect(dayDate(dayIndex("2026-03-01")! - 1)).toBe("2026-02-28");
  });

  it("reads the date back from UTC, not the local calendar", () => {
    // Day 0 is the UTC epoch. Read with LOCAL parts it is 1969-12-31 for everyone west of
    // Greenwich — which is what makes this assertion a timezone check and not a tautology,
    // whatever TZ the runner happens to be in.
    expect(dayDate(0)).toBe("1970-01-01");
  });
});

describe("itemKeyNumber", () => {
  it("reads the numeric half", () => {
    expect(itemKeyNumber("WEB-42")).toBe(42);
  });

  it("orders 7 before 42 — the ordering a text sort gets backwards", () => {
    expect(itemKeyNumber("WEB-7")).toBeLessThan(itemKeyNumber("WEB-42"));
  });

  it("takes the LAST dash, so a prefix cannot be confused for the number", () => {
    // Prefixes are `[A-Z][A-Z0-9]*` today and cannot contain a dash — this pins the
    // helper against the day that stops being true rather than assuming it forever.
    expect(itemKeyNumber("A-B-9")).toBe(9);
  });

  it("sorts an unassigned or unparseable key to 0 so the keyless cluster at one end", () => {
    expect(itemKeyNumber("")).toBe(0);
    expect(itemKeyNumber("WEB-")).toBe(0);
    expect(itemKeyNumber("WEB-x")).toBe(0);
  });
});

describe("relationLabel", () => {
  it("inverts the ordering kind across the two ends of one stored edge", () => {
    // The card the edge points FROM is the one that waits, so it reads "Blocked by"; the card
    // it points AT reads "Blocks". One row, two sentences — which is the whole reason the read
    // returns a direction rather than just the kind.
    expect(relationLabel("depends_on", "outgoing")).toBe("Blocked by");
    expect(relationLabel("depends_on", "incoming")).toBe("Blocks");
  });

  it("inverts duplicates too — the copy points at the original", () => {
    expect(relationLabel("duplicates", "outgoing")).toBe("Duplicates");
    expect(relationLabel("duplicates", "incoming")).toBe("Duplicated by");
  });

  it("reads a symmetric relation the same way from both ends", () => {
    // `relates_to` claims no order, so the stored direction is an implementation detail. A
    // second phrasing here would invent an asymmetry the relationship does not have.
    expect(relationLabel("relates_to", "outgoing")).toBe(
      relationLabel("relates_to", "incoming"),
    );
  });
});

describe("actionPhrase for link events", () => {
  it("distinguishes the three relationships behind one action name", () => {
    // The backend files every link under `dependency.added`, with the kind in the detail. A
    // phrase built from the action alone would report a duplicate mark as a dependency.
    expect(actionPhrase("dependency.added", { kind: "depends_on" })).toBe("added a dependency");
    expect(actionPhrase("dependency.added", { kind: "relates_to" })).toBe(
      "linked a related item",
    );
    expect(actionPhrase("dependency.added", { kind: "duplicates" })).toBe(
      "marked an item as a duplicate",
    );
  });

  it("reads a kindless row as a dependency — that is what every older row IS", () => {
    // Rows written before the kind column existed carry no kind, and all of them were
    // dependencies. Treating the absence as unknown would relabel real history.
    expect(actionPhrase("dependency.added")).toBe("added a dependency");
    expect(actionPhrase("dependency.removed", null)).toBe("removed a dependency");
  });

  it("still falls back to the raw action for anything it has never heard of", () => {
    // The action set is OPEN: a bundle older than the backend must show the raw string rather
    // than blank the row.
    expect(actionPhrase("sprint.started")).toBe("sprint.started");
  });
});

describe("actionPhrase for the rest of the trail", () => {
  // Every action string the backend appends to a project's trail today. The fallback makes an
  // unphrased action INVISIBLE — the feed renders `work_item.fields_updated` and looks like it
  // works — so the coverage has to be asserted rather than noticed. Kept as a literal list
  // because it is the backend's vocabulary, not this package's: when a new action lands, this
  // test is the thing that has to be told about it.
  const EMITTED = [
    "project.created",
    "project.updated",
    "project.archived",
    "project.deleted",
    "work_item.created",
    "work_item.updated",
    "work_item.status_changed",
    "work_item.assigned",
    "work_item.unassigned",
    "work_item.reparented",
    "work_item.iteration_changed",
    "work_item.moved",
    "work_item.fields_updated",
    "work_item.deleted",
    "comment.added",
    "comment.edited",
    "comment.deleted",
    "field.created",
    "field.updated",
    "field.deleted",
    "participant.added",
    "participant.removed",
    "dependency.added",
    "dependency.removed",
    "status.created",
    "status.updated",
    "status.deleted",
    "saved_view.created",
    "saved_view.updated",
    "saved_view.deleted",
  ];

  it("phrases every action the backend can write", () => {
    for (const action of EMITTED) expect(actionPhrase(action)).not.toBe(action);
  });

  it("names the two ends of a reorder, because they are the placements people mean", () => {
    // The server reads a side stated as `null` as a destination: nothing above it is the top,
    // nothing below it is the bottom. Landing between two named cards has no such name.
    expect(actionPhrase("work_item.moved", { after: null })).toBe("moved a work item to the top");
    expect(actionPhrase("work_item.moved", { before: null })).toBe(
      "moved a work item to the bottom",
    );
    expect(actionPhrase("work_item.moved", { after: "wi_1", before: "wi_2" })).toBe(
      "reordered a work item",
    );
  });

  it("counts a batch of field values", () => {
    expect(actionPhrase("work_item.fields_updated", { fieldIds: ["f1"] })).toBe(
      "updated a field value",
    );
    expect(actionPhrase("work_item.fields_updated", { fieldIds: ["f1", "f2"] })).toBe(
      "updated field values",
    );
    // No list at all is an older row, not a row that changed nothing.
    expect(actionPhrase("work_item.fields_updated")).toBe("updated field values");
  });

  it("separates a saved view's rename from a re-point", () => {
    // One action covers both, and `changed` is the only place the difference is written down.
    expect(actionPhrase("saved_view.updated", { changed: ["name"] })).toBe("renamed a saved view");
    expect(actionPhrase("saved_view.updated", { changed: ["config"] })).toBe(
      "updated a saved view",
    );
    expect(actionPhrase("saved_view.updated", { changed: ["name", "config"] })).toBe(
      "updated a saved view",
    );
    expect(actionPhrase("saved_view.updated")).toBe("updated a saved view");
  });
});
