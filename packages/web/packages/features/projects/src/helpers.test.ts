// The two key helpers. Both exist because a rendered key (`WEB-42`) is a STRING that
// carries a number inside it, and treating it as either one alone gets something wrong:
// sorted as text it misorders, shown as text-only it disappears from the dense views.
import { describe, expect, it } from "vitest";

import { actionPhrase, itemKeyNumber, itemLabel, relationLabel } from "./helpers";

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
