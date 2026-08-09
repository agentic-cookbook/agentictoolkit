"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { ListHeader } from "@agentic-toolkit/ui/blocks/list-header";
import { SelectionActions } from "@agentic-toolkit/ui/blocks/selection-actions";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import {
  type EstimateScale,
  type Iteration,
  type Milestone,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { ItemKey } from "../ItemKey";
import { assigneeLabel, estimateLabel, itemKeyNumber, statusMeta } from "../helpers";
import { useBulkWorkItemActions } from "../useBulkWorkItemActions";

/**
 * The Table VIEW of the work-items surface: a DENSE spreadsheet — the List's
 * superset — laying every work item out across sortable columns (title, status,
 * assignee, priority, iteration, estimate, start / due dates, labels). PRESENTATIONAL,
 * like its List sibling: it loads no data and owns no editor; the WorkItemsSurface loads
 * the items ONCE and owns the shared editor.
 *
 * CLICK SELECTS, DOUBLE-CLICK OPENS (Enter is the keyboard twin). It used to be that a single
 * click opened the editor — which cost the table selection entirely, because a table has only one
 * click and that click was spent. So this table, alone among the dense lists on the platform,
 * could not select a range, and the multi-select `DataTable` already implements (shift-click,
 * alt-click, shift-arrow) was unreachable here. `onRowActivate` separates the two acts, which is
 * also the convention everywhere else a list opens something: selection is cheap and reversible,
 * opening is the deliberate second act.
 *
 * A selection arms the header's Update… and Delete, shared with the List view through
 * `useBulkWorkItemActions` so the two views offer the same verbs. That is the whole point of a
 * dense table: seeing forty rows at once is only half of it, acting on twenty of them is the rest.
 *
 * Status + priority render as Badge variants (never raw colors), resolved via the
 * shared `../helpers` source that the List view reads too, so a status/assignee
 * renders identically across views.
 *
 * Sorting is CLIENT-SIDE: DataTable reports the header click via `onSortChange` but
 * renders `rows` in the order given, so we hold the sort in state and feed it the
 * pre-sorted items. The whole table sits in an `overflow-x-auto` wrapper with a
 * `min-w`, so a wide dense table scrolls horizontally instead of breaking the page.
 *
 * The sort is UNCONTROLLED with a seed (`defaultSort`) and a report (`onSortChange`),
 * rather than owned by the surface the way the filter is. The difference is real: a filter
 * describes all five views and has to survive a switch between them, while a column sort
 * describes THIS table and no other view can express one. So the surface only needs to
 * OBSERVE it — to write it into a saved view — and to SEED it when a saved view is applied,
 * which it does by remounting on the applied view's key. That keeps the sort where the
 * control is instead of routing every header click through the surface and back.
 *
 * OUT OF SCOPE — custom-field columns: the backend exposes only a PER-ITEM field
 * values endpoint (`projectWorkItemsApi.getValues`), no batch/list variant, so a
 * field column would fan out into N fetches (one per row) — a perf anti-pattern.
 * Adding custom-field columns needs a batch field-values endpoint first (future).
 */

/** A column sort: which column, which way. Exported because a saved view stores one. */
export type SortState = { key: string; dir: "asc" | "desc" };

/** The comparable a column sorts on — a number for priority, a lowercased string
 *  for everything else (nullable dates collapse to "" so they cluster together). */
function sortValue(
  w: WorkItem,
  key: string,
  statuses: ProjectStatus[],
  participants: ProjectParticipant[],
  iterations: Iteration[],
  milestones: Milestone[],
): string | number {
  switch (key) {
    case "itemKey":
      // The NUMBER, not the text: sorting `ADH-42` as a string puts it before `ADH-7`, which
      // is the one thing a reader would never expect from a column of numbered keys.
      return itemKeyNumber(w.itemKey);
    case "priority":
      return w.priority;
    case "iteration":
      // By the cycle's START, not its name: "Sprint 10" sorts before "Sprint 2" as text, and
      // nobody ordering by iteration means anything other than chronologically. Backlog cards
      // collapse to "" and cluster together, the same way the nullable dates below do.
      return iterations.find((i) => i.id === w.iterationId)?.startDate ?? "";
    case "milestone":
      // By the TARGET date, for the same reason the iteration sorts by its start: a plan is read
      // in the order it comes due. A milestone with no date, and a card aimed at none, both
      // collapse to "" and cluster — which is the honest grouping, since neither is a deadline.
      return milestones.find((m) => m.id === w.milestoneId)?.targetDate ?? "";
    case "estimate":
      // Unestimated sorts below every real size (0 included — a card judged free HAS been
      // looked at), so ascending puts "nobody has sized these" first.
      return w.estimate ?? -1;
    case "status":
      return statusMeta(w.statusId, statuses).label.toLowerCase();
    case "assignee":
      return assigneeLabel(w, participants).toLowerCase();
    case "startDate":
      return w.startDate ?? "";
    case "dueDate":
      return w.dueDate ?? "";
    case "title":
    default:
      return w.title.toLowerCase();
  }
}

export function TableView({
  items,
  statuses,
  participants,
  iterations,
  milestones,
  estimateScale,
  onOpenItem,
  onChanged,
  defaultSort,
  onSortChange,
}: {
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** The workspace's time-boxes. An EMPTY list removes the Iteration column — a workspace that
   *  runs no cycles would otherwise get a column of dashes it can never fill. */
  iterations: Iteration[];
  /** This board's milestones. An EMPTY list removes the Milestone column, for the same reason. */
  milestones: Milestone[];
  /** The project's estimate scale; `none` removes the Estimate column for the same reason. */
  estimateScale: EstimateScale;
  onOpenItem: (id: string) => void;
  /** A bulk update or delete landed — the surface re-reads the shared items so every view
   *  repaints together. */
  onChanged: () => Promise<void>;
  /** The sort to open with — a saved view's. Read once, at mount. */
  defaultSort?: SortState | null;
  /** Reports each header click, so the surface can save the sort someone arrived at. */
  onSortChange?: (sort: SortState) => void;
}): ReactElement {
  const [sort, setSort] = useState<SortState | undefined>(defaultSort ?? undefined);
  const applySort = useCallback(
    (next: SortState) => {
      setSort(next);
      onSortChange?.(next);
    },
    [onSortChange],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const bulk = useBulkWorkItemActions({ statuses, participants, onChanged });

  // Ids of rows that have since left the table (deleted, or filtered out by a reload) are dropped
  // before they reach an action, so a bulk verb never fires at something that is not on screen.
  const selectedArr = useMemo(
    () => items.filter((w) => selectedIds.has(w.id)).map((w) => w.id),
    [items, selectedIds],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const columns: DataTableColumn<WorkItem>[] = useMemo(
    () => [
      {
        // First and narrow, like a row number — except it is a NAME, stable across every sort
        // and every view, which is what makes it the thing to quote elsewhere.
        key: "itemKey",
        header: "Key",
        width: "0.6fr",
        sortable: true,
        render: (w) => <ItemKey itemKey={w.itemKey} />,
      },
      {
        key: "title",
        header: "Title",
        width: "2fr",
        sortable: true,
        render: (w) => <span className="truncate text-apt-text">{w.title}</span>,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (w) => {
          const m = statusMeta(w.statusId, statuses);
          return <Badge variant={m.variant}>{m.label}</Badge>;
        },
      },
      {
        key: "assignee",
        header: "Assignee",
        width: "1.5fr",
        sortable: true,
        render: (w) => (
          <span className="truncate text-apt-text-muted">
            {assigneeLabel(w, participants)}
          </span>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        render: (w) => {
          const m = priorityMeta(w.priority);
          return <Badge variant={m.variant}>{m.label}</Badge>;
        },
      },
      // The three PLANNING columns sit between the card's own facts and its dates, and each is
      // present only where it has an answer: a workspace with no cycles has no iteration to show,
      // a board with no plan has no milestone to show, and a project that does not estimate has
      // no scale to show one in.
      ...(iterations.length > 0
        ? [
            {
              key: "iteration",
              header: "Iteration",
              width: "1.2fr",
              sortable: true,
              // The name alone — the dates are what the picker and the Iterations pane are for,
              // and a date range in a dense cell truncates to noise.
              render: (w: WorkItem) => (
                <span className="truncate text-apt-text-muted">
                  {iterations.find((i) => i.id === w.iterationId)?.name ?? "—"}
                </span>
              ),
            } satisfies DataTableColumn<WorkItem>,
          ]
        : []),
      ...(milestones.length > 0
        ? [
            {
              key: "milestone",
              header: "Milestone",
              width: "1.2fr",
              sortable: true,
              // The name alone, like the iteration beside it — the date and the progress belong
              // to the Milestones pane, which is the surface that can afford to show them.
              render: (w: WorkItem) => (
                <span className="truncate text-apt-text-muted">
                  {milestones.find((m) => m.id === w.milestoneId)?.name ?? "—"}
                </span>
              ),
            } satisfies DataTableColumn<WorkItem>,
          ]
        : []),
      ...(estimateScale !== "none"
        ? [
            {
              key: "estimate",
              header: "Estimate",
              width: "0.6fr",
              sortable: true,
              render: (w: WorkItem) => (
                <span className="text-apt-text-muted">
                  {estimateLabel(w.estimate, estimateScale) ?? "—"}
                </span>
              ),
            } satisfies DataTableColumn<WorkItem>,
          ]
        : []),
      {
        key: "startDate",
        header: "Start",
        sortable: true,
        render: (w) => <span className="text-apt-text-muted">{w.startDate ?? "—"}</span>,
      },
      {
        key: "dueDate",
        header: "Due",
        sortable: true,
        render: (w) => <span className="text-apt-text-muted">{w.dueDate ?? "—"}</span>,
      },
      {
        key: "labels",
        header: "Labels",
        width: "1.5fr",
        // Comma-joined so the cell truncates cleanly; a stale/empty list shows "—".
        render: (w) => (
          <span className="truncate text-apt-text-muted">
            {w.labels.length > 0 ? w.labels.join(", ") : "—"}
          </span>
        ),
      },
    ],
    [statuses, participants, iterations, milestones, estimateScale],
  );

  // DataTable renders `rows` in the order given — sort here (client-side) from the
  // header-reported `sort` so the table reorders on a column click.
  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = sortValue(a, key, statuses, participants, iterations, milestones);
      const bv = sortValue(b, key, statuses, participants, iterations, milestones);
      if (av < bv) return -factor;
      if (av > bv) return factor;
      return 0;
    });
  }, [items, sort, statuses, participants, iterations, milestones]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No work items yet."
        description="Create a work item to start tracking work in this project."
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <ErrorText error={bulk.error} />
      {/* The same recessed strip every list header uses — no filter field, because the Table's
          affordance is sorting and the List owns filtering. */}
      <ListHeader
        ariaLabel="Work items table actions"
        title={selectedArr.length > 0 ? `${selectedArr.length} selected` : undefined}
        actions={
          <SelectionActions
            selectedIds={selectedArr}
            actions={bulk.actions}
            onDelete={(ids) => {
              bulk.onDelete(ids);
              clearSelection();
            }}
            deleteConfirm={bulk.deleteConfirm}
          />
        }
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <DataTable<WorkItem>
          ariaLabel="Work items table"
          className="min-w-[64rem]"
          columns={columns}
          rows={sortedItems}
          getRowId={(w) => w.id}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowActivate={onOpenItem}
          sort={sort}
          onSortChange={applySort}
        />
      </div>
      {bulk.dialog}
    </div>
  );
}
