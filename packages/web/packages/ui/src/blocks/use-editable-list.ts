"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EditableListColumn,
  EditableListFacet,
  EditableListTextFilter,
  ListSort,
} from "./editable-list-types";

/** Is this column sortable? `sortable` wins; otherwise a column is sortable iff it has a value. */
export const isSortable = <T,>(col: EditableListColumn<T>): boolean =>
  col.sortable ?? col.value != null;

/** Is this column searched by the free-text box? Same rule, its own opt-out. */
export const isSearchable = <T,>(col: EditableListColumn<T>): boolean =>
  col.searchable ?? col.value != null;

/** "This cell has nothing in it" — null, undefined or the empty string, all the same fact. */
const isMissing = (v: unknown): boolean => v == null || v === "";

/**
 * Compare two PRESENT cell values: numbers numerically, everything else as case-insensitive text.
 *
 * Missing values never reach here — they are settled by {@link compareRows}, outside the direction
 * sign, because "sorts last" and "sorts first when you flip it" are different claims.
 */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const as = String(a).toLowerCase();
  const bs = String(b).toLowerCase();
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * One comparison, direction included — and a missing value sorts LAST whichever way the arrow
 * points.
 *
 * That asymmetry is the point, and it has to live OUTSIDE the sign or it is not an asymmetry at
 * all: multiplying "missing is greater" by -1 makes missing smallest, so flipping a column that
 * mixes values with blanks brought every blank to the top and "most recent first" answered with a
 * screen of rows that have no date at all.
 */
function compareRows(a: unknown, b: unknown, dir: 1 | -1): number {
  const aMissing = isMissing(a);
  const bMissing = isMissing(b);
  if (aMissing || bMissing) return aMissing && bMissing ? 0 : aMissing ? 1 : -1;
  return dir * compareValues(a, b);
}

export interface UseEditableListOptions<T> {
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  columns: EditableListColumn<T>[];
  facets?: EditableListFacet<T>[];
  textFilters?: EditableListTextFilter<T>[];
  /** The column the list opens sorted by. Omit to show the rows in the order they arrived. */
  initialSort?: ListSort;
}

export interface EditableListController<T> {
  columns: EditableListColumn<T>[];
  getRowId: (row: T) => string;
  /** Everything that survived the search, the text filters and the facets, in sort order. */
  rows: T[];
  /** Every row the list was given, filtered by nothing. */
  allRows: T[];
  search: string;
  setSearch: (next: string) => void;
  sort: ListSort | null;
  setSort: (next: ListSort) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
  /** The selected rows, in list order — never a bare id an action would have to resolve again. */
  selectedRows: T[];
  facets: EditableListFacet<T>[];
  facetOptions: Record<string, string[]>;
  /**
   * What each facet is narrowing by RIGHT NOW — always a subset of {@link facetOptions}.
   *
   * Pruned rather than raw, because a facet value no row carries any more has no checkbox to
   * untick: the menu is built from the options, so a value that left the population would filter
   * the list to nothing from somewhere the operator cannot reach. Revoking the last admin with the
   * Role facet set to `admin` did exactly that — an empty table, a "(1)" badge, and no way to
   * explain either. The raw tick is KEPT behind this, so a value that comes back comes back
   * applied, with its checkbox.
   */
  facetSelection: Record<string, Set<string>>;
  setFacetSelection: (id: string, next: Set<string>) => void;
  textFilters: EditableListTextFilter<T>[];
  textFilterValues: Record<string, string>;
  setTextFilterValue: (id: string, next: string) => void;
  /** Any narrowing is in force — the empty-state copy needs to know which sentence to use. */
  filtered: boolean;
}

const EMPTY_ROWS: never[] = [];

/**
 * The state behind every {@link EditableList}: the search term, the filters, the sort and the
 * selection.
 *
 * All of it is derived HERE rather than per page, and all of it is applied BEFORE the rows reach
 * the table, which is the ordering that used to go wrong: the pages this replaces paginated on
 * the server and then sorted what came back, so "sort by email" arranged page one rather than the
 * list. Nothing here paginates — the whole list is on screen and scrolls — so a filter narrows
 * the list and a sort orders it, which is what both words already meant to the operator.
 */
export function useEditableList<T>({
  rows,
  getRowId,
  columns,
  facets = [],
  textFilters = [],
  initialSort,
}: UseEditableListOptions<T>): EditableListController<T> {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ListSort | null>(initialSort ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [facetSelection, setFacetSelectionState] = useState<Record<string, Set<string>>>({});
  const [textFilterValues, setTextFilterValues] = useState<Record<string, string>>({});

  const allRows = rows ?? EMPTY_ROWS;

  const setFacetSelection = useCallback((id: string, next: Set<string>) => {
    setFacetSelectionState((prev) => ({ ...prev, [id]: next }));
  }, []);

  const setTextFilterValue = useCallback((id: string, next: string) => {
    setTextFilterValues((prev) => ({ ...prev, [id]: next }));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // A selected id whose row has left the list describes nothing, and an action driven by one is
  // the hazard the whole selection model exists to avoid — a Release or a Delete aimed at a row
  // the operator can no longer see. Pruned against `allRows`, NOT the visible rows: narrowing the
  // search must not silently drop a selection the operator made a keystroke ago and will get back
  // by pressing backspace.
  const idsSignature = allRows.map(getRowId).join("\u0000");
  const prunedFor = useRef<string | null>(null);
  useEffect(() => {
    if (prunedFor.current === idsSignature) return;
    prunedFor.current = idsSignature;
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(allRows.map(getRowId));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idsSignature, allRows, getRowId]);

  // Every facet value present in the WHOLE list, not the filtered view: options derived from the
  // visible rows would vanish the moment ticking one narrowed them away, leaving the operator
  // unable to untick what they just ticked.
  const facetOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const facet of facets) {
      const found = new Set<string>();
      for (const row of allRows) for (const v of facet.valuesOf(row)) found.add(v);
      out[facet.id] = [...found].sort();
    }
    return out;
  }, [facets, allRows]);

  // Only the ticks that still name a value some row carries — see `facetSelection` on the
  // controller for why the raw state is kept underneath rather than rewritten.
  const effectiveFacetSelection = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const facet of facets) {
      const chosen = facetSelection[facet.id];
      if (!chosen || chosen.size === 0) continue;
      const live = new Set(facetOptions[facet.id] ?? []);
      const kept = new Set([...chosen].filter((v) => live.has(v)));
      if (kept.size > 0) out[facet.id] = kept;
    }
    return out;
  }, [facets, facetSelection, facetOptions]);

  const searchableColumns = useMemo(() => columns.filter(isSearchable), [columns]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let out = allRows;

    if (needle) {
      out = out.filter((row) =>
        searchableColumns.some((col) => {
          const v = col.value?.(row);
          return v != null && String(v).toLowerCase().includes(needle);
        }),
      );
    }

    for (const filter of textFilters) {
      const term = (textFilterValues[filter.id] ?? "").trim().toLowerCase();
      if (!term) continue;
      out = out.filter((row) =>
        filter.valuesOf(row).some((v) => v.toLowerCase().includes(term)),
      );
    }

    for (const facet of facets) {
      const chosen = effectiveFacetSelection[facet.id];
      if (!chosen || chosen.size === 0) continue;
      out = out.filter((row) => facet.valuesOf(row).some((v) => chosen.has(v)));
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      // A sort key with no column, or a column with no `value`, orders by nothing — so it must not
      // reorder anything either. Silently returning the rows unsorted is the honest outcome; the
      // header only draws an arrow for a column the table itself declared sortable.
      if (col?.value) {
        const dir = sort.dir === "asc" ? 1 : -1;
        // COPY first: this is React Query's cached array, and sorting it in place rewrites the
        // cache for every other consumer — none of which re-render, because the identity never
        // changed.
        out = [...out].sort((a, b) => compareRows(col.value!(a), col.value!(b), dir));
      }
    }

    return out;
  }, [
    allRows,
    search,
    searchableColumns,
    textFilters,
    textFilterValues,
    facets,
    effectiveFacetSelection,
    sort,
    columns,
  ]);

  const selectedRows = useMemo(
    () => allRows.filter((row) => selectedIds.has(getRowId(row))),
    [allRows, selectedIds, getRowId],
  );

  const filtered =
    search.trim() !== "" ||
    Object.values(textFilterValues).some((v) => v.trim() !== "") ||
    Object.values(effectiveFacetSelection).some((s) => s.size > 0);

  return {
    columns,
    getRowId,
    rows: visible,
    allRows,
    search,
    setSearch,
    sort,
    setSort,
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectedRows,
    facets,
    facetOptions,
    facetSelection: effectiveFacetSelection,
    setFacetSelection,
    textFilters,
    textFilterValues,
    setTextFilterValue,
    filtered,
  };
}
