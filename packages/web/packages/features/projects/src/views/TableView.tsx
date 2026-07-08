"use client";

import { useMemo, useState, type ReactElement } from "react";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { assigneeLabel, statusMeta } from "../helpers";

/**
 * The Table VIEW of the work-items surface: a DENSE spreadsheet — the List's
 * superset — laying every work item out across sortable columns (title, status,
 * assignee, priority, start / due dates, labels). PRESENTATIONAL, like its List
 * sibling: it loads no data and owns no editor; the WorkItemsSurface loads the
 * items ONCE and owns the shared editor. Selecting a row calls `onOpenItem(id)`,
 * which the surface turns into an open editor for that item (so a click opens the
 * shared editor from ANY view).
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

// A row click never leaves the table selected (the surface swaps in the editor),
// so a stable empty set keeps DataTable's selection controlled without churn.
const NO_SELECTION: Set<string> = new Set();

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
}: {
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  onOpenItem: (id: string) => void;
}): ReactElement {
  const [sort, setSort] = useState<SortState | undefined>(undefined);

  const columns: DataTableColumn<WorkItem>[] = useMemo(
    () => [
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
    <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
      <DataTable<WorkItem>
        ariaLabel="Work items table"
        className="min-w-[64rem]"
        columns={columns}
        rows={sortedItems}
        getRowId={(w) => w.id}
        selectedIds={NO_SELECTION}
        onSelectionChange={(ids) => {
          const id = [...ids][0];
          if (id) onOpenItem(id);
        }}
        sort={sort}
        onSortChange={setSort}
      />
    </div>
  );
}
