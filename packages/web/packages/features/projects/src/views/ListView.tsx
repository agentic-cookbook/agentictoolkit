"use client";

import { useMemo, type ReactElement } from "react";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { assigneeLabel, statusMeta } from "../helpers";

/**
 * The List VIEW of the work-items surface: a DataTable of the project's work
 * items (title / status Badge / assignee / priority Badge / due). PRESENTATIONAL —
 * it loads no data and owns no editor; the WorkItemsSurface loads the items once
 * and owns the shared editor. Selecting a row calls `onOpenItem(id)`, which the
 * surface turns into an open editor for that item (so a click opens the shared
 * editor from ANY view). Extracted from the former ProjectWorkItemsPane so List
 * and Board are interchangeable views over one shared query.
 *
 * Status + priority render as Badge variants (never raw colors); the assignee
 * column resolves the (kind, id) pair back to a participant label ("Unassigned"
 * when unset), all via the shared `../helpers` source.
 */

// A row click never leaves the list selected (the surface swaps in the editor),
// so a stable empty set keeps DataTable's selection controlled without churn.
const NO_SELECTION: Set<string> = new Set();

export function ListView({
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
  const columns: DataTableColumn<WorkItem>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        width: "2fr",
        render: (w) => <span className="truncate text-apt-text">{w.title}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (w) => {
          const m = statusMeta(w.statusId, statuses);
          return <Badge variant={m.variant}>{m.label}</Badge>;
        },
      },
      {
        key: "assignee",
        header: "Assignee",
        render: (w) => (
          <span className="truncate text-apt-text-muted">
            {assigneeLabel(w, participants)}
          </span>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        render: (w) => {
          const m = priorityMeta(w.priority);
          return <Badge variant={m.variant}>{m.label}</Badge>;
        },
      },
      {
        key: "dueDate",
        header: "Due",
        render: (w) => <span className="text-apt-text-muted">{w.dueDate ?? "—"}</span>,
      },
    ],
    [statuses, participants],
  );

  return (
    <DataTable<WorkItem>
      ariaLabel="Work items"
      className="min-h-0 flex-1"
      columns={columns}
      rows={items}
      getRowId={(w) => w.id}
      selectedIds={NO_SELECTION}
      onSelectionChange={(ids) => {
        const id = [...ids][0];
        if (id) onOpenItem(id);
      }}
      emptyLabel="No work items yet."
    />
  );
}
