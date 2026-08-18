import { describe, expect, it } from "vitest";
import { sortByGroup } from "../group";

interface Row {
  kind: string;
  name: string;
}

const rows: Row[] = [
  { kind: "spell", name: "Zap" },
  { kind: "room", name: "Hall" },
  { kind: "spell", name: "Alpha" },
  { kind: "item", name: "Key" },
  { kind: "room", name: "Attic" },
];

describe("sortByGroup", () => {
  it("puts same-group rows together, groups alphabetical, rows alphabetical inside", () => {
    expect(sortByGroup(rows, (r) => r.kind, (r) => r.name)).toEqual([
      { kind: "item", name: "Key" },
      { kind: "room", name: "Attic" },
      { kind: "room", name: "Hall" },
      { kind: "spell", name: "Alpha" },
      { kind: "spell", name: "Zap" },
    ]);
  });

  it("does not mutate its input", () => {
    const input = [...rows];
    sortByGroup(input, (r) => r.kind, (r) => r.name);
    expect(input).toEqual(rows);
  });

  // A row whose group is empty is still a row; it sorts first rather than vanishing.
  it("keeps ungrouped rows, first", () => {
    const out = sortByGroup([{ kind: "room", name: "Hall" }, { kind: "", name: "Loose" }], (r) => r.kind, (r) => r.name);
    expect(out.map((r) => r.name)).toEqual(["Loose", "Hall"]);
  });

  it("compares case-insensitively, so `Zap` and `alpha` do not sort by byte value", () => {
    const out = sortByGroup(
      [{ kind: "k", name: "Zap" }, { kind: "k", name: "alpha" }],
      (r) => r.kind,
      (r) => r.name,
    );
    expect(out.map((r) => r.name)).toEqual(["alpha", "Zap"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortByGroup([], (r: Row) => r.kind, (r: Row) => r.name)).toEqual([]);
  });
});

interface Ordered {
  kind: string;
  name: string;
  sortOrder: number;
}

// `sort_order` is the explicit ordering the three child tables carry, and for effects it is
// load-bearing: `add` then `multiply` is not `multiply` then `add`. A list sorted by name would
// show an order the engine does not run.
describe("sortByGroup with getSort", () => {
  const rows: Ordered[] = [
    { kind: "on_use", name: "Zap", sortOrder: 1 },
    { kind: "on_use", name: "Alpha", sortOrder: 2 },
    { kind: "on_enter", name: "Chill", sortOrder: 5 },
  ];

  it("orders a group by sortOrder AHEAD of the label", () => {
    expect(
      sortByGroup(rows, (r) => r.kind, (r) => r.name, (r) => r.sortOrder).map((r) => r.name),
    ).toEqual(["Chill", "Zap", "Alpha"]);
  });

  it("still breaks ties by label, because sort_order defaults to 0 for a whole group", () => {
    const tied: Ordered[] = [
      { kind: "k", name: "Zap", sortOrder: 0 },
      { kind: "k", name: "Alpha", sortOrder: 0 },
    ];
    expect(
      sortByGroup(tied, (r) => r.kind, (r) => r.name, (r) => r.sortOrder).map((r) => r.name),
    ).toEqual(["Alpha", "Zap"]);
  });

  it("never lets sortOrder reach across groups", () => {
    const across: Ordered[] = [
      { kind: "b", name: "Low", sortOrder: 0 },
      { kind: "a", name: "High", sortOrder: 99 },
    ];
    expect(
      sortByGroup(across, (r) => r.kind, (r) => r.name, (r) => r.sortOrder).map((r) => r.name),
    ).toEqual(["High", "Low"]);
  });

  it("orders by label alone when no getSort is given, so existing callers are unchanged", () => {
    expect(sortByGroup(rows, (r) => r.kind, (r) => r.name).map((r) => r.name)).toEqual([
      "Chill",
      "Alpha",
      "Zap",
    ]);
  });
});
