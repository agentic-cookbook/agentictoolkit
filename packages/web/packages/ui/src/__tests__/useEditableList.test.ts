// @vitest-environment jsdom
//
// The narrowing and ordering every admin list inherits. These used to be per-page comparators and
// per-page filter state, tested (where they were tested at all) once per page; this is the one
// place the behaviour is asserted now.
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditableList } from "../blocks/use-editable-list";
import type { EditableListColumn } from "../blocks/editable-list-types";

interface Row {
  id: string;
  name: string;
  type: string;
  tags: string[];
  size: number | null;
}

const row = (o: Partial<Row> & { id: string }): Row => ({
  name: o.id,
  type: "storage",
  tags: [],
  size: 0,
  ...o,
});

const columns: EditableListColumn<Row>[] = [
  { key: "name", header: "Name", value: (r) => r.name },
  { key: "type", header: "Type", value: (r) => r.type },
  { key: "size", header: "Size", value: (r) => r.size },
  { key: "art", header: "Art", render: () => null }, // presentational: no value, no sort, no search
];

const listOf = (rows: Row[], extra: Partial<Parameters<typeof useEditableList<Row>>[0]> = {}) =>
  renderHook(() =>
    useEditableList<Row>({ rows, getRowId: (r) => r.id, columns, ...extra }),
  );

describe("search", () => {
  const rows = [
    row({ id: "a", name: "storage.fishlamp.notes" }),
    row({ id: "b", name: "app.acme.web" }),
  ];

  it("matches a SUBSTRING of any searchable column, not a prefix", () => {
    // The brief's case: looking for fishlamp by typing part of the middle of the address.
    const { result } = listOf(rows);
    act(() => result.current.setSearch("fishlamp"));
    expect(result.current.rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("matches case-insensitively", () => {
    const { result } = listOf(rows);
    act(() => result.current.setSearch("ACME"));
    expect(result.current.rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores columns with no value", () => {
    // "Art" renders something but declares no value, so it is presentational — searching for what
    // it draws must not match, or a column's markup becomes accidental search text.
    const { result } = listOf(rows);
    act(() => result.current.setSearch("Art"));
    expect(result.current.rows).toEqual([]);
  });

  it("treats whitespace as no search at all", () => {
    const { result } = listOf(rows);
    act(() => result.current.setSearch("   "));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.filtered).toBe(false);
  });
});

describe("facets", () => {
  const rows = [
    row({ id: "a", type: "storage" }),
    row({ id: "b", type: "app" }),
    row({ id: "c", type: "storage" }),
  ];
  const facets = [{ id: "type", label: "Type", valuesOf: (r: Row) => [r.type] }];

  it("offers every value the WHOLE list contains, sorted", () => {
    const { result } = listOf(rows, { facets });
    expect(result.current.facetOptions.type).toEqual(["app", "storage"]);
  });

  it("keeps offering an option after ticking it narrows the others away", () => {
    // Options derived from the visible rows would vanish the moment one was ticked, leaving the
    // operator unable to untick what they had just ticked.
    const { result } = listOf(rows, { facets });
    act(() => result.current.setFacetSelection("type", new Set(["app"])));
    expect(result.current.facetOptions.type).toEqual(["app", "storage"]);
  });

  it("an empty selection filters nothing", () => {
    const { result } = listOf(rows, { facets });
    act(() => result.current.setFacetSelection("type", new Set()));
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.filtered).toBe(false);
  });

  it("keeps a row matching ANY ticked value", () => {
    const many = [
      row({ id: "a", tags: ["x"] }),
      row({ id: "b", tags: ["y", "z"] }),
      row({ id: "c", tags: [] }),
    ];
    const { result } = listOf(many, {
      facets: [{ id: "tag", label: "Tag", valuesOf: (r: Row) => r.tags }],
    });
    act(() => result.current.setFacetSelection("tag", new Set(["x", "z"])));
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("text filters", () => {
  const rows = [
    row({ id: "a", tags: ["com.acme"] }),
    row({ id: "b", tags: ["com.other", "com.acme.eu"] }),
    row({ id: "c", tags: [] }),
  ];
  const textFilters = [
    { id: "eco", placeholder: "Ecosystem", valuesOf: (r: Row) => r.tags },
  ];

  it("matches a substring of any of the row's values", () => {
    const { result } = listOf(rows, { textFilters });
    act(() => result.current.setTextFilterValue("eco", "acme"));
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("narrows independently of the free-text search", () => {
    // The two boxes AND together — that is the whole reason a dedicated box exists rather than
    // more terms in the search.
    const { result } = listOf(rows, { textFilters });
    act(() => {
      result.current.setTextFilterValue("eco", "acme");
      result.current.setSearch("b");
    });
    expect(result.current.rows.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("sort", () => {
  const rows = [row({ id: "b", name: "Beta" }), row({ id: "a", name: "alpha" })];

  it("shows the rows as given when nothing is sorted", () => {
    expect(listOf(rows).result.current.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("sorts case-insensitively, and flips direction", () => {
    const { result } = listOf(rows);
    act(() => result.current.setSort({ key: "name", dir: "asc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
    act(() => result.current.setSort({ key: "name", dir: "desc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("compares numbers numerically, not as text", () => {
    const nums = [row({ id: "big", size: 10 }), row({ id: "small", size: 9 })];
    const { result } = listOf(nums);
    act(() => result.current.setSort({ key: "size", dir: "asc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["small", "big"]);
  });

  it("sinks missing values to the bottom in BOTH directions", () => {
    // Flipping a column that mixes values with blanks used to bring every blank to the top, so
    // "most recent first" answered with a screen of rows that have no date at all.
    const mixed = [row({ id: "none", size: null }), row({ id: "has", size: 3 })];
    const { result } = listOf(mixed);
    act(() => result.current.setSort({ key: "size", dir: "asc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["has", "none"]);
    act(() => result.current.setSort({ key: "size", dir: "desc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["has", "none"]);
  });

  it("leaves the order alone for a key no column can compare", () => {
    const { result } = listOf(rows);
    act(() => result.current.setSort({ key: "art", dir: "asc" }));
    expect(result.current.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("does not reorder the array it was handed", () => {
    // It is React Query's cached array; sorting it in place rewrites the cache for every other
    // consumer, and React re-renders for none of them because the identity never changed.
    const given = [row({ id: "b" }), row({ id: "a" })];
    const { result } = listOf(given);
    act(() => result.current.setSort({ key: "name", dir: "asc" }));
    expect(given.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("selection", () => {
  it("resolves selected ids to rows, in list order", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const { result } = listOf(rows);
    act(() => result.current.setSelectedIds(new Set(["c", "a"])));
    expect(result.current.selectedRows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("SURVIVES a filter that hides the selected row", () => {
    // Narrowing the search must not silently drop a selection made a keystroke ago and got back
    // by pressing backspace.
    const rows = [row({ id: "a", name: "alpha" }), row({ id: "b", name: "beta" })];
    const { result } = listOf(rows);
    act(() => result.current.setSelectedIds(new Set(["a"])));
    act(() => result.current.setSearch("beta"));
    expect(result.current.rows.map((r) => r.id)).toEqual(["b"]);
    expect(result.current.selectedRows.map((r) => r.id)).toEqual(["a"]);
  });

  it("prunes a selected id whose row has left the list entirely", () => {
    // The hazard the selection model exists to avoid: a Delete aimed at a row that is gone.
    const { result, rerender } = renderHook(
      ({ rows }: { rows: Row[] }) =>
        useEditableList<Row>({ rows, getRowId: (r) => r.id, columns }),
      { initialProps: { rows: [row({ id: "a" }), row({ id: "b" })] } },
    );
    act(() => result.current.setSelectedIds(new Set(["a", "b"])));
    rerender({ rows: [row({ id: "b" })] });
    expect([...result.current.selectedIds]).toEqual(["b"]);
  });

  it("clears on demand", () => {
    const { result } = listOf([row({ id: "a" })]);
    act(() => result.current.setSelectedIds(new Set(["a"])));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });
});

describe("undefined rows", () => {
  it("behaves like an empty list while the fetch is in flight", () => {
    const { result } = renderHook(() =>
      useEditableList<Row>({ rows: undefined, getRowId: (r) => r.id, columns }),
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.allRows).toEqual([]);
    expect(result.current.filtered).toBe(false);
  });
});
