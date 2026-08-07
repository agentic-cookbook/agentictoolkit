"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { ListHeader } from "@agentic-toolkit/ui/blocks/list-header";
import { SelectionActions } from "@agentic-toolkit/ui/blocks/selection-actions";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { ItemKey } from "../ItemKey";
import { assigneeLabel, itemKeyNumber, statusMeta } from "../helpers";
import { useBulkWorkItemActions } from "../useBulkWorkItemActions";

/**
 * The Table VIEW of the work-items surface: a DENSE spreadsheet — the List's
 * superset — laying every work item out across sortable columns (title, status,
 * assignee, priority, start / due dates, labels). PRESENTATIONAL, like its List
 * sibling: it loads no data and owns no editor; the WorkItemsSurface loads the
 * items ONCE and owns the shared editor.
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
 * OUT OF SCOPE — custom-field columns: the backend exposes only a PER-ITEM field
 * values endpoint (`projectWorkItemsApi.getValues`), no batch/list variant, so a
 * field column would fan out into N fetches (one per row) — a perf anti-pattern.
 * Adding custom-field columns needs a batch field-values endpoint first (future).
 */

type SortState = { key: string; dir: "asc" | "desc" };

/** The comparable a column sorts on — a number for priority, a lowercased string
 *  for everything else (nullable dates collapse to "" so they cluster together). */
function sortValue(
  w: WorkItem,
  key: string,
  statuses: ProjectStatus[],
  participants: ProjectParticipant[],
): string | number {
  switch (key) {
    case "itemKey":
      // The NUMBER, not the text: sorting `ADH-42` as a string puts it before `ADH-7`, which
      // is the one thing a reader would never expect from a column of numbered keys.
      return itemKeyNumber(w.itemKey);
    case "priority":
      return w.priority;
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
  onOpenItem,
  onChanged,
}: {
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  onOpenItem: (id: string) => void;
  /** A bulk update or delete landed — the surface re-reads the shared items so every view
   *  repaints together. */
  onChanged: () => Promise<void>;
}): ReactElement {
  const [sort, setSort] = useState<SortState | undefined>(undefined);
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
    [statuses, participants],
  );

  // DataTable renders `rows` in the order given — sort here (client-side) from the
  // header-reported `sort` so the table reorders on a column click.
  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = sortValue(a, key, statuses, participants);
      const bv = sortValue(b, key, statuses, participants);
      if (av < bv) return -factor;
      if (av > bv) return factor;
      return 0;
    });
  }, [items, sort, statuses, participants]);

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
          onSortChange={setSort}
        />
      </div>
      {bulk.dialog}
    </div>
  );
}
