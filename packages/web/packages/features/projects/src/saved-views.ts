import { EMPTY_FILTER, decodeFilter, encodeFilter, type WorkItemFilter } from "./filters";
import type { SortState } from "./views/TableView";

/**
 * What a SAVED VIEW saves.
 *
 * A saved view is not a new kind of thing — it is a name on a `WorkItemFilter`, plus the two
 * other choices that survive being written down: which of the five views to open in, and the
 * table's column sort. The backend stores this whole object as one opaque jsonb `config` and
 * never reads inside it, which is the point: the axes a filter carries are a UI vocabulary, so
 * a schema that knew them would need a migration every time one was added, and a migration is
 * the most expensive way to learn about a dropdown.
 *
 * What is deliberately NOT here is GROUPING. Linear's saved views carry one, and adh has
 * nothing to put in it: the Board groups by status and no view offers an alternative, so a
 * stored `groupBy` would be a field with exactly one legal value — a promise the UI cannot
 * keep. When grouping becomes a choice it is a key added to this record, and
 * {@link decodeViewConfig} already ignores keys it has never heard of, so every view saved
 * before that day still opens.
 *
 * The codec is tolerant in both directions for the same reason `decodeFilter` is: a stored
 * config was written by another build. A missing key falls back, a wrong-shaped one is
 * ignored, an unknown one is dropped — a saved view can go stale, but it can never fail to
 * open.
 */
export interface WorkItemViewConfig {
  /** Which of the five views to open in. Opaque here: the surface owns the id vocabulary and
   *  falls back on its own when it does not recognise one (a view removed in a later build). */
  view: string;
  filter: WorkItemFilter;
  /** The table's column sort, or null for its natural order. Ignored by the other four views. */
  sort: SortState | null;
}

export const EMPTY_VIEW_CONFIG: WorkItemViewConfig = {
  view: "list",
  filter: EMPTY_FILTER,
  sort: null,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A sort is only worth restoring if BOTH halves survived — a key with no direction would
 *  silently reorder the table one way when it was saved the other. */
function decodeSort(raw: unknown): SortState | null {
  if (!isRecord(raw)) return null;
  const { key, dir } = raw;
  if (typeof key !== "string" || key === "") return null;
  if (dir !== "asc" && dir !== "desc") return null;
  return { key, dir };
}

/** The stored form: sparse, so a view that narrows nothing stores `{view}` and not seven empty
 *  axes. Sparseness is not compression — it is what makes a stored config readable, and it is
 *  what lets `decodeViewConfig` tell "this build had no opinion" from "this build said empty". */
export function encodeViewConfig(config: WorkItemViewConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { view: config.view };
  const filter = encodeFilter(config.filter);
  if (Object.keys(filter).length > 0) out.filter = filter;
  if (config.sort) out.sort = config.sort;
  return out;
}

export function decodeViewConfig(raw: unknown): WorkItemViewConfig {
  if (!isRecord(raw)) return EMPTY_VIEW_CONFIG;
  const view = typeof raw.view === "string" && raw.view !== "" ? raw.view : EMPTY_VIEW_CONFIG.view;
  return { view, filter: decodeFilter(raw.filter), sort: decodeSort(raw.sort) };
}

/** Whether two configs describe the same view, used to tell an applied saved view from one the
 *  user has since edited. Compared through the ENCODED form so the answer cannot depend on key
 *  order or on an axis's empty-vs-absent spelling — the two things that would make a view read
 *  as "modified" the instant it was applied. */
export function sameViewConfig(a: WorkItemViewConfig, b: WorkItemViewConfig): boolean {
  return JSON.stringify(encodeViewConfig(a)) === JSON.stringify(encodeViewConfig(b));
}
