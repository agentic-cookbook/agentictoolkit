// The two key helpers. Both exist because a rendered key (`WEB-42`) is a STRING that
// carries a number inside it, and treating it as either one alone gets something wrong:
// sorted as text it misorders, shown as text-only it disappears from the dense views.
import { describe, expect, it } from "vitest";

import { itemKeyNumber, itemLabel } from "./helpers";

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
