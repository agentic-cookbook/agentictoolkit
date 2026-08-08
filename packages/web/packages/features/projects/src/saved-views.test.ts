// Unit tests for what a SAVED VIEW stores.
//
// The codec's whole job is to survive time: a stored config was written by a build that is not
// this one, and the product promise is that a saved view always opens. So the cases worth
// having are the ones where it could refuse — a key this build never heard of, a half-written
// sort, a config that is not an object at all — plus the one comparison the UI hangs a label
// on ("modified"), which must not fire on a view nobody has touched.
import { describe, it, expect } from "vitest";
import { EMPTY_FILTER, type WorkItemFilter } from "./filters";
import {
  EMPTY_VIEW_CONFIG,
  decodeViewConfig,
  encodeViewConfig,
  sameViewConfig,
  type WorkItemViewConfig,
} from "./saved-views";

const filter = (over: Partial<WorkItemFilter>): WorkItemFilter => ({ ...EMPTY_FILTER, ...over });
const config = (over: Partial<WorkItemViewConfig>): WorkItemViewConfig => ({
  ...EMPTY_VIEW_CONFIG,
  ...over,
});

describe("encodeViewConfig", () => {
  it("stores only what was chosen", () => {
    expect(encodeViewConfig(config({ view: "board" }))).toEqual({ view: "board" });
    expect(
      encodeViewConfig(
        config({ view: "table", filter: filter({ statusId: "st-1" }), sort: { key: "dueDate", dir: "desc" } }),
      ),
    ).toEqual({
      view: "table",
      filter: { statusId: "st-1" },
      sort: { key: "dueDate", dir: "desc" },
    });
  });

  it("round-trips", () => {
    const original = config({
      view: "calendar",
      filter: filter({ text: "login", labels: ["bug"], dueTo: "2026-09-01" }),
      sort: { key: "priority", dir: "asc" },
    });
    expect(decodeViewConfig(encodeViewConfig(original))).toEqual(original);
  });
});

describe("decodeViewConfig", () => {
  it("opens a config written by another build", () => {
    // The property the whole feature rests on: an unknown key is dropped, a missing one falls
    // back, and neither makes the view unopenable.
    expect(decodeViewConfig({ view: "board", groupBy: "assignee" })).toEqual(
      config({ view: "board" }),
    );
    expect(decodeViewConfig({ filter: { statusId: "st-1" } })).toEqual(
      config({ filter: filter({ statusId: "st-1" }) }),
    );
  });

  it("falls back to a real view for anything that is not one", () => {
    expect(decodeViewConfig(null).view).toBe("list");
    expect(decodeViewConfig("nonsense").view).toBe("list");
    expect(decodeViewConfig({ view: "" }).view).toBe("list");
    expect(decodeViewConfig({ view: 7 }).view).toBe("list");
    // A view id this build does not know is carried through, NOT rewritten: the surface is
    // where the id vocabulary lives, and it decides what an unrecognised one falls back to.
    expect(decodeViewConfig({ view: "gantt" }).view).toBe("gantt");
  });

  it("drops a half-written sort rather than guessing the missing half", () => {
    // A key with no direction would reorder the table one way when it was saved the other —
    // silently wrong is worse than unsorted.
    expect(decodeViewConfig({ sort: { key: "dueDate" } }).sort).toBeNull();
    expect(decodeViewConfig({ sort: { key: "dueDate", dir: "sideways" } }).sort).toBeNull();
    expect(decodeViewConfig({ sort: { dir: "asc" } }).sort).toBeNull();
    expect(decodeViewConfig({ sort: "dueDate" }).sort).toBeNull();
    expect(decodeViewConfig({ sort: { key: "dueDate", dir: "desc" } }).sort).toEqual({
      key: "dueDate",
      dir: "desc",
    });
  });
});

describe("sameViewConfig", () => {
  it("says a freshly applied view is unmodified, whatever spelling it was stored in", () => {
    // The trap: a stored view holds a sparse filter and the live one holds a full record with
    // seven empty axes. Compared as objects those differ, and the UI would call every applied
    // view "modified" the instant it opened.
    const applied = decodeViewConfig({ view: "board", filter: { statusId: "st-1" } });
    expect(sameViewConfig(applied, config({ view: "board", filter: filter({ statusId: "st-1" }) }))).toBe(
      true,
    );
  });

  it("notices a real edit on any axis", () => {
    const base = config({ view: "board", filter: filter({ statusId: "st-1" }) });
    expect(sameViewConfig(base, { ...base, view: "list" })).toBe(false);
    expect(sameViewConfig(base, { ...base, filter: filter({ statusId: "st-2" }) })).toBe(false);
    expect(sameViewConfig(base, { ...base, sort: { key: "title", dir: "asc" } })).toBe(false);
  });
});
