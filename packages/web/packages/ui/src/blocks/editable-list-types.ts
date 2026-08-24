import type { ReactNode } from "react";

/**
 * The column contract every admin list is built from.
 *
 * `value` is the column's SORT AND SEARCH key, and it is separate from `render` on purpose:
 * `render` returns JSX, and a table that sorted by its rendered output would be sorting React
 * elements — which is why the pages this replaces each carried a hand-written comparator listing
 * the four or five keys it happened to know, and why a column added later silently drew a sort
 * arrow that sorted by nothing. Give a column a `value` and it is sortable and searchable by
 * construction; omit it and the column is presentational.
 */
export interface EditableListColumn<T> {
  key: string;
  header: ReactNode;
  /** The cell. Omit for a plain text cell rendered from `value`. */
  render?: (row: T) => ReactNode;
  /** The sortable/searchable content of this cell. Omit for a presentational column. */
  value?: (row: T) => string | number | null | undefined;
  /** Force sorting on/off. Defaults to "sortable when `value` is given". */
  sortable?: boolean;
  /** Force free-text search on/off. Defaults to "searchable when `value` is given". */
  searchable?: boolean;
  /** A fixed CSS grid track. Omit to size the column to its content (and stay resizable). */
  width?: string;
  align?: "start" | "end";
  /** Opt out of user resizing — for a cell whose content is fixed-width controls. */
  resizable?: boolean;
}

/**
 * A facet filter: a popup menu of every value the list actually contains, any number of which may
 * be ticked. An empty selection means "not filtering", NOT "match nothing" — a menu that emptied
 * the table the moment it was opened would be a trap. The options are derived from the rows, so a
 * facet can never offer a value that nothing has.
 */
export interface EditableListFacet<T> {
  id: string;
  /** The trigger label, e.g. "Type". The tick count is appended by the menu. */
  label: string;
  /** Every facet value this row carries. A row matches when ANY of them is ticked. */
  valuesOf: (row: T) => string[];
  /** Display name for a raw facet value. Defaults to the value itself. */
  labelOf?: (value: string) => string;
}

/**
 * A dedicated substring box for one field, beside the list's own free-text search.
 *
 * Separate from the search box because the two answer different questions: search matches
 * anything in the row, and an operator narrowing by one field (an ecosystem, a host) wants a box
 * that cannot accidentally match a different column.
 */
export interface EditableListTextFilter<T> {
  id: string;
  placeholder: string;
  /** The values this filter matches against. A row matches when ANY contains the term. */
  valuesOf: (row: T) => string[];
  /** Box width, e.g. `"14rem"`. */
  width?: string;
}

export type ListSort = { key: string; dir: "asc" | "desc" };
