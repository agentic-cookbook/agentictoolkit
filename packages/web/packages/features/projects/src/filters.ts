// The work-item FILTER — one structured value, applied client-side, serialised for saved views.
//
// A filter is DATA, not a closure. That is the whole design: the surface holds a
// `WorkItemFilter` in state, `applyWorkItemFilter` turns it into a subset, and `encodeFilter` /
// `decodeFilter` move the same value through a URL or a saved-view record. A predicate function
// would do the first job and neither of the other two — and a saved view is exactly "this filter,
// under a name", so the moment views are saveable the filter has to be a value that survives a
// round trip through storage.
//
// Every axis is OPTIONAL and additive: axes are ANDed, and the multi-valued ones (labels) are
// ANDed within themselves too, because "labelled bug AND ui" is what someone narrowing a list
// means. An axis at its empty value passes everything, so `EMPTY_FILTER` is the identity and
// `isFilterActive` is a shallow read rather than a diff against a default the caller has to know.
//
// It filters items the surface ALREADY loaded rather than re-querying: a project's work items
// arrive in one read, so narrowing them is a local operation with no round trip, no pagination to
// keep in step, and no way for the counts under the views to disagree with what the views show.
// Search ACROSS projects is a different question with a different answer (a backend route) —
// see `workItemSearch`.

import type { WorkItem } from "@agentic-toolkit/data/projects";
import { dayIndex } from "./helpers";

/** The unassigned sentinel for the assignee axis — a real answer ("nobody owns this"), distinct
 *  from the empty string, which means "any assignee". A composite `kind:id` can never collide
 *  with it: the codec always emits a colon. */
export const UNASSIGNED = "unassigned";

/** The backlog sentinel for the iteration axis, for the same reason: "not committed to a cycle"
 *  is a state to filter FOR, and it is what `iterationId === null` means on a card. */
export const NO_ITERATION = "none";

export interface WorkItemFilter {
  /** Free text, matched case-insensitively against the item KEY, title and description. */
  text: string;
  /** A status id, `""` for any. Ids rather than status CATEGORIES: this filter narrows one
   *  board, and a board's own column names are what its users think in. (A cross-board filter
   *  would want the category instead — it is the axis that means the same thing everywhere —
   *  and the serialisation below is built so that axis can be added without invalidating a
   *  single saved view.) */
  statusId: string;
  /** A composite `kind:id` (see AssigneePicker's codec), {@link UNASSIGNED}, or `""` for any. */
  assignee: string;
  /** An iteration id, {@link NO_ITERATION} for the backlog, or `""` for any. */
  iterationId: string;
  /** A priority as its stored number, or `""` for any. A string because it comes off a
   *  `<select>` and goes into a URL — the one parse happens in {@link applyWorkItemFilter}. */
  priority: string;
  /** Labels the item must carry ALL of. Empty passes everything. */
  labels: string[];
  /** Inclusive due-date window (YYYY-MM-DD), either end open. An item with NO due date is
   *  outside any window — a window is a question about when something is due, and "never" is
   *  not a date in it. */
  dueFrom: string;
  dueTo: string;
}

export const EMPTY_FILTER: WorkItemFilter = {
  text: "",
  statusId: "",
  assignee: "",
  iterationId: "",
  priority: "",
  labels: [],
  dueFrom: "",
  dueTo: "",
};

/** Whether anything is narrowed at all — what tells a surface to show a "clear" affordance and a
 *  "showing N of M" count instead of a bare total. */
export function isFilterActive(f: WorkItemFilter): boolean {
  return (
    f.text.trim() !== "" ||
    f.statusId !== "" ||
    f.assignee !== "" ||
    f.iterationId !== "" ||
    f.priority !== "" ||
    f.labels.length > 0 ||
    f.dueFrom !== "" ||
    f.dueTo !== ""
  );
}

/** The item's assignee in the same composite spelling the axis carries, or {@link UNASSIGNED}.
 *  One codec, shared with AssigneePicker's `toOptionValue`, so a filter built from a picker's
 *  value always matches the cards that picker assigned. */
function assigneeKey(item: WorkItem): string {
  return item.assigneeKind && item.assigneeId
    ? `${item.assigneeKind}:${item.assigneeId}`
    : UNASSIGNED;
}

/** Case-insensitive substring, over the three fields a person means by "find". The key is
 *  included so typing `WEB-42` finds that card — the key is how people refer to work aloud, and
 *  a search that only reads titles cannot answer the most common question asked of it. */
function matchesText(item: WorkItem, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (q === "") return true;
  return (
    item.itemKey.toLowerCase().includes(q) ||
    item.title.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q)
  );
}

/**
 * The filter, applied — every axis read off the card itself, so the only inputs are the items
 * and the filter. An inactive filter returns the SAME array rather than a copy, which is what
 * lets a view memoised on its items skip a repaint when nothing is narrowed.
 */
export function applyWorkItemFilter(items: WorkItem[], filter: WorkItemFilter): WorkItem[] {
  if (!isFilterActive(filter)) return items;
  const priority = filter.priority === "" ? null : Number(filter.priority);
  const from = filter.dueFrom === "" ? null : dayIndex(filter.dueFrom);
  const to = filter.dueTo === "" ? null : dayIndex(filter.dueTo);

  return items.filter((item) => {
    if (!matchesText(item, filter.text)) return false;
    if (filter.statusId !== "" && item.statusId !== filter.statusId) return false;
    if (filter.assignee !== "" && assigneeKey(item) !== filter.assignee) return false;
    if (filter.iterationId !== "") {
      const want = filter.iterationId === NO_ITERATION ? null : filter.iterationId;
      if (item.iterationId !== want) return false;
    }
    if (priority !== null && item.priority !== priority) return false;
    if (filter.labels.length > 0 && !filter.labels.every((l) => item.labels.includes(l))) {
      return false;
    }
    if (from !== null || to !== null) {
      const due = item.dueDate ? dayIndex(item.dueDate) : null;
      if (due === null) return false;
      if (from !== null && due < from) return false;
      if (to !== null && due > to) return false;
    }
    return true;
  });
}

/* ── Serialisation ────────────────────────────────────────────────────────────
 * A filter travels two ways — as a URL query (a link to a narrowed list) and as a saved view's
 * stored record. Both are the same JSON-ish object, so there is ONE encoder and one decoder:
 * `encodeFilter` drops every axis at its empty value (a link carries only what was narrowed),
 * and `decodeFilter` fills the rest from EMPTY_FILTER. That asymmetry is what makes a saved view
 * survive a new axis being added later — an old record simply has nothing to say about it, and
 * decodes to "any", which is what it meant. */

/** The filter as a sparse plain object — only the axes that narrow anything. */
export function encodeFilter(f: WorkItemFilter): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (f.text.trim() !== "") out.text = f.text.trim();
  if (f.statusId !== "") out.statusId = f.statusId;
  if (f.assignee !== "") out.assignee = f.assignee;
  if (f.iterationId !== "") out.iterationId = f.iterationId;
  if (f.priority !== "") out.priority = f.priority;
  if (f.labels.length > 0) out.labels = [...f.labels];
  if (f.dueFrom !== "") out.dueFrom = f.dueFrom;
  if (f.dueTo !== "") out.dueTo = f.dueTo;
  return out;
}

/** The inverse, TOLERANT of anything: a stored view is data written by an older (or newer)
 *  build, so a missing axis is "any" and a value of the wrong shape is ignored rather than
 *  thrown over. A filter that decodes to something harmless is always better than a saved view
 *  that cannot be opened. */
export function decodeFilter(raw: unknown): WorkItemFilter {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof src[k] === "string" ? (src[k] as string) : "");
  const labels = Array.isArray(src.labels)
    ? (src.labels as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return {
    text: str("text"),
    statusId: str("statusId"),
    assignee: str("assignee"),
    iterationId: str("iterationId"),
    priority: str("priority"),
    labels,
    dueFrom: str("dueFrom"),
    dueTo: str("dueTo"),
  };
}
