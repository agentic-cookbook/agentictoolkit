"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { ListWithDetailsPane } from "@agentic-toolkit/ui/blocks/list-with-details-pane";
import type { DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { TreeRowLabel, flattenTree, type TreeRow } from "@agentic-toolkit/ui/components/tree-rows";
import {
  InlineCommitControl,
  InlineEditableText,
  inlineCommitDeletingClass,
} from "@agentic-toolkit/ui/components/inline-commit-control";
import { ReorderControl } from "@agentic-toolkit/ui/components/reorder-control";
import { UnsavedChangesGuard } from "@agentic-toolkit/ui/components/unsaved-changes-guard";
import { useInlineDrafts } from "@agentic-toolkit/ui/hooks/useInlineDrafts";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { errorMessage } from "@agentic-toolkit/ui/lib/errors";
import { cn } from "@agentic-toolkit/ui/lib/utils";
import { compareRank, projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";
import { PRIORITIES } from "../WorkItemEditor";
import { participantLabel, toOptionValue, fromOptionValue } from "../AssigneePicker";
import { WorkItemDetail } from "../WorkItemDetail";
import { ItemKey } from "../ItemKey";
import { useBulkWorkItemActions } from "../useBulkWorkItemActions";

/**
 * The List VIEW of the work-items surface: a LIST WITH DETAILS — the items as a table on top, the
 * selected item's full record below.
 *
 * Four things it owns that the sibling views don't:
 *
 *  - **In-place row editing.** Every column is a control over a per-row PATCH (`useInlineDrafts`),
 *    and the row's trailing `InlineCommitControl` commits (✓) or discards (✕) it; the same control
 *    arms a delete (trash → strikethrough → ✓ destroys). Patches mean a commit only ever sends the
 *    fields THIS user touched, so it cannot clobber one that changed underneath. Same grammar as the
 *    admin console's feature-flag editor.
 *  - **Content-sized, resizable columns.** Each column is as wide as its widest cell, and dragging a
 *    column's trailing border overrides that (double-click springs it back). Widths persist per
 *    project.
 *  - **The SUB-ITEM TREE.** `parentId` is a real field on every work item, and this is the one view
 *    that shows it: children sit under their parent, indented, behind a chevron. It lives here and
 *    not in Table because a tree is carried by ROW ORDER — and Table's whole affordance is
 *    re-ordering the rows by any column, which would scatter a hierarchy the first time anyone
 *    used it. Board, Calendar and Timeline place an item by a field, not by a position in a list,
 *    so there is nowhere for a child to be "under" its parent at all.
 *  - **REORDERING.** ↑/↓ on each row move a card among its SIBLINGS — the same reason as the
 *    tree: this is the only view whose order is the board order rather than a sort over some
 *    column, so it is the only one where moving a row means anything durable. A move names the
 *    neighbour it should land beside, so the server rewrites one card's `rank` and nobody else's.
 *

 * Selecting a row shows its whole record below — including the fields that are NOT columns
 * (description, labels, parent, timestamps). The row edits; the details pane reads.
 *
 * Selecting SEVERAL (shift-click a range, alt-click to add, shift-arrow from the keyboard) shows
 * no record — there is no one record to show — and instead arms the header's Update… and Delete,
 * shared with the Table view via `useBulkWorkItemActions`. The per-row control and the header are
 * not two ways to do one thing: the row acts on the item you are editing, the header on a set you
 * chose, and neither can express the other.
 */

/** A title cell never sizes below this many characters, so a short title still leaves a usable
 *  editing target and the header stays readable. */
const TITLE_MIN_CHARS = 18;

/** The editable projection of a work item — exactly what a row can commit. */
interface WorkItemDraft {
  title: string;
  statusId: string;
  /** The (kind, id) assignee pair as ONE composite select value ("" = Unassigned). */
  assignee: string;
  priority: number;
  dueDate: string;
}

function draftFrom(w: WorkItem): WorkItemDraft {
  return {
    title: w.title,
    statusId: w.statusId,
    assignee: toOptionValue(
      w.assigneeKind && w.assigneeId
        ? { assigneeKind: w.assigneeKind, assigneeId: w.assigneeId }
        : null,
    ),
    priority: w.priority,
    dueDate: w.dueDate ?? "",
  };
}

/** The committed draft fields as the API's patch. An emptied date/assignee is an explicit CLEAR
 *  (null) — the client preserves an explicit null, so the PATCH carries the clear rather than
 *  silently leaving the old value in place. */
function patchOf(changes: Partial<WorkItemDraft>) {
  const assignee =
    changes.assignee !== undefined ? fromOptionValue(changes.assignee) : undefined;
  return {
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.statusId !== undefined ? { statusId: changes.statusId } : {}),
    ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    ...(changes.dueDate !== undefined ? { dueDate: changes.dueDate || null } : {}),
    ...(changes.assignee !== undefined
      ? {
          assigneeKind: (assignee?.assigneeKind ?? null) as WorkItem["assigneeKind"],
          assigneeId: assignee?.assigneeId ?? null,
        }
      : {}),
  };
}

export function ListView({
  projectId,
  items,
  statuses,
  participants,
  onChanged,
}: {
  projectId: string;
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** A row committed an edit or a delete — the surface re-reads the shared items so every view
   *  repaints together. */
  onChanged: () => Promise<void>;
}): ReactElement {
  const rows = useInlineDrafts<string, WorkItemDraft>(errorMessage);
  const [filter, setFilter] = useState("");

  // What a multi-selection does. The row's own ✓/✕/trash still edits and deletes ONE item; these
  // are the verbs that only make sense over many, and they are the same two the Table offers.
  const bulk = useBulkWorkItemActions({ statuses, participants, onChanged });

  // COLLAPSED, not expanded: a project's items are mostly flat, so the useful default is that
  // everything a project contains is on screen — and a set of collapsed ids stays correct as
  // items arrive, whereas a set of expanded ids would have to be topped up on every load to keep
  // new parents open. Ids of items that have since vanished are harmless (nothing looks them up).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  // A FILTERED list is not the hierarchy: hiding a parent whose child matches would either drop
  // the match or indent it under nothing. So while the filter is on, the rows go flat — every
  // match on one line, at depth 0 — and the tree comes back when it is cleared.
  const filtering = filter.trim().length > 0;
  const tree = useMemo<TreeRow<WorkItem>[] | null>(
    () =>
      filtering
        ? null
        : flattenTree(items, {
            id: (w) => w.id,
            parentId: (w) => w.parentId,
            expanded: new Set(items.map((w) => w.id).filter((id) => !collapsed.has(id))),
            // Siblings in board order, so a child's place among its siblings reads the same here
            // as it does on the Board.
            compare: (a, b) => compareRank(a.rank, b.rank),
          }),
    [items, collapsed, filtering],
  );
  const visibleItems = useMemo(() => tree?.map((t) => t.row) ?? items, [tree, items]);
  const treeMeta = useMemo(
    () => new Map(tree?.map((t) => [t.row.id, t] as const) ?? []),
    [tree],
  );

  // Every item's immediate SIBLINGS in board order — the two cards a reorder is allowed to name.
  // Derived from `parentId` + `rank` and not from the flattened tree, for two reasons: the tree
  // is null while filtering, and a neighbour has to be a real sibling. A child's row on screen is
  // preceded by its parent, but "move up" past a parent is meaningless and the backend refuses it
  // — so the row above and the sibling above are different questions, and this answers the second.
  const neighbours = useMemo(() => {
    const byParent = new Map<string | null, WorkItem[]>();
    for (const w of items) {
      const siblings = byParent.get(w.parentId);
      if (siblings) siblings.push(w);
      else byParent.set(w.parentId, [w]);
    }
    const near = new Map<string, { prev?: string; next?: string }>();
    for (const siblings of byParent.values()) {
      // The server already returns rank order; re-sorting costs nothing and keeps this honest
      // if ListView is ever handed an unsorted array.
      const ordered = [...siblings].sort((a, b) => compareRank(a.rank, b.rank));
      ordered.forEach((w, i) => {
        near.set(w.id, { prev: ordered[i - 1]?.id, next: ordered[i + 1]?.id });
      });
    }
    return near;
  }, [items]);

  // A move names the card it should land BESIDE, never an index — "up" is "put me before whoever
  // is above me right now". That is the same request whether or not the list shifted under us
  // since it was read, and two people moving different cards can't renumber each other.
  function moveRow(w: WorkItem, direction: "up" | "down") {
    const beside = direction === "up" ? neighbours.get(w.id)?.prev : neighbours.get(w.id)?.next;
    if (beside === undefined) return; // already at that end; the button is disabled anyway
    void rows.runCommit(w.id, async () => {
      await projectWorkItemsApi.move(
        w.id,
        direction === "up" ? { beforeId: beside } : { afterId: beside },
      );
      await onChanged();
    });
  }

  function commitRow(w: WorkItem) {
    // The ✓ commits whichever pending state the row is in: an armed delete destroys it, otherwise
    // the touched fields are PATCHed.
    if (rows.isArmed(w.id)) {
      void rows.runCommit(w.id, async () => {
        await projectWorkItemsApi.remove(w.id);
        rows.clear(w.id);
        await onChanged();
      });
      return;
    }
    const changes = rows.changesOf(w.id, draftFrom(w));
    void rows.runCommit(w.id, async () => {
      if (changes.title !== undefined && changes.title.trim() === "") {
        throw new Error("A title is required."); // → this row's error; its draft is kept
      }
      await projectWorkItemsApi.update(w.id, patchOf(changes));
      // Drop the committed fields but keep any keystrokes made while the request was in flight.
      rows.settle(w.id, changes);
      await onChanged();
    });
  }

  const columns: DataTableColumn<WorkItem>[] = useMemo(() => {
    const draft = (w: WorkItem) => rows.draftOf(w.id, draftFrom(w));
    const armed = (w: WorkItem) => (rows.isArmed(w.id) ? inlineCommitDeletingClass : undefined);
    // Enter commits the row, Escape discards it — the keyboard twins of the control's ✓ / ✕.
    const editKeys = (w: WorkItem) => ({
      onCommitEdit: () => {
        if (rows.isDirty(w.id, draftFrom(w))) commitRow(w);
      },
      onCancelEdit: () => rows.clear(w.id),
    });

    return [
      {
        // Read-only, and FIRST: the key is the card's name, so it belongs where a name goes —
        // and there is nothing to edit here, since both halves are the backend's to assign.
        key: "itemKey",
        header: "Key",
        render: (w) => <ItemKey itemKey={w.itemKey} />,
      },
      {
        key: "title",
        header: "Title",
        render: (w) => {
          const field = (
            <InlineEditableText
              value={draft(w).title}
              onChange={(title) => rows.edit(w.id, { title })}
              {...editKeys(w)}
              aria-label={`Title — ${w.title}`}
              disabled={rows.isArmed(w.id)}
              // `size` comes from the SAVED title, not the draft: the column is then as wide as
              // the longest title in the DATA, and typing into one cell doesn't reflow the whole
              // table.
              size={Math.max(TITLE_MIN_CHARS, w.title.length)}
              className={cn("w-auto", armed(w))}
            />
          );
          // No entry ⇒ the filter is on and the list is flat: the bare field, with no indent to
          // suggest a parent that isn't on screen.
          const node = treeMeta.get(w.id);
          if (!node) return field;
          return (
            <TreeRowLabel
              depth={node.depth}
              hasChildren={node.hasChildren}
              expanded={!collapsed.has(w.id)}
              onToggle={() => toggleCollapsed(w.id)}
              label={w.title}
            >
              {field}
            </TreeRowLabel>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (w) => (
          <Select
            value={draft(w).statusId}
            onChange={(e) => rows.edit(w.id, { statusId: e.target.value })}
            aria-label={`Status — ${w.title}`}
            disabled={rows.isArmed(w.id)}
            className={cn("w-auto", armed(w))}
          >
            {statuses.length === 0 && <option value="">—</option>}
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        ),
      },
      {
        key: "assignee",
        header: "Assignee",
        render: (w) => (
          <Select
            value={draft(w).assignee}
            onChange={(e) => rows.edit(w.id, { assignee: e.target.value })}
            aria-label={`Assignee — ${w.title}`}
            disabled={rows.isArmed(w.id)}
            className={cn("w-auto", armed(w))}
          >
            <option value="">Unassigned</option>
            {participants.map((p) => (
              <option
                key={`${p.participantKind}:${p.participantId}`}
                value={`${p.participantKind}:${p.participantId}`}
              >
                {participantLabel(p)}
              </option>
            ))}
          </Select>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        render: (w) => (
          <Select
            value={String(draft(w).priority)}
            onChange={(e) => rows.edit(w.id, { priority: Number(e.target.value) })}
            aria-label={`Priority — ${w.title}`}
            disabled={rows.isArmed(w.id)}
            className={cn("w-auto", armed(w))}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        ),
      },
      {
        key: "dueDate",
        header: "Due",
        render: (w) => (
          <Input
            type="date"
            value={draft(w).dueDate}
            onChange={(e) => rows.edit(w.id, { dueDate: e.target.value })}
            aria-label={`Due date — ${w.title}`}
            disabled={rows.isArmed(w.id)}
            className={cn("w-auto", armed(w))}
          />
        ),
      },
      // Reorder — dropped entirely while FILTERING, because what is on screen is then a selection
      // rather than the list. "Up" would still move the card above its real sibling, but that
      // sibling may be filtered out, so the row would sit exactly where it was and read as a
      // button that does nothing.
      ...(filtering
        ? []
        : [
            {
              key: "order",
              header: "",
              align: "end",
              // Fixed like the commit cell beside it: two fixed-size icons, nothing to size to.
              width: "5rem",
              resizable: false,
              render: (w: WorkItem) => (
                <ReorderControl
                  canMoveUp={neighbours.get(w.id)?.prev !== undefined}
                  canMoveDown={neighbours.get(w.id)?.next !== undefined}
                  onMoveUp={() => moveRow(w, "up")}
                  onMoveDown={() => moveRow(w, "down")}
                  busy={rows.isBusy(w.id)}
                  subject={`work item ${w.title}`}
                />
              ),
            } satisfies DataTableColumn<WorkItem>,
          ]),
      {
        key: "commit",
        header: "",
        align: "end",
        // A fixed trailing cell: its contents are fixed-size icons, so there is nothing to widen —
        // and auto-sizing would measure it while every row is CLEAN (just the hover trash), leaving
        // the ✓/✕ pair no room the moment a row goes dirty.
        width: "6rem",
        resizable: false,
        render: (w) => (
          <InlineCommitControl
            dirty={rows.isDirty(w.id, draftFrom(w))}
            deleting={rows.isArmed(w.id)}
            deletable
            busy={rows.isBusy(w.id)}
            onCommit={() => commitRow(w)}
            onCancel={() => rows.clear(w.id)}
            onDelete={() => rows.toggleArmed(w.id)}
            subject={`work item ${w.title}`}
          />
        ),
      },
    ];
    // `commitRow` and `moveRow` close over `rows` + `onChanged`, both stable enough for the row
    // controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, statuses, participants, treeMeta, collapsed, toggleCollapsed, neighbours, filtering]);

  // Leaving with an uncommitted row edit (or an armed delete) would silently lose it.
  const pending = items.some((w) => rows.isDirty(w.id, draftFrom(w)) || rows.isArmed(w.id));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      {/* A row's commit error belongs where it can be READ — a cell is far too narrow, and its
          `truncate` would clip the message to nothing. */}
      {rows.errors.map((e) => (
        <ErrorText key={e.id} error={e.message} />
      ))}
      <ErrorText error={bulk.error} />
      <ListWithDetailsPane<WorkItem>
        ariaLabel="Work items"
        className="min-h-0 flex-1"
        columns={columns}
        rows={visibleItems}
        getRowId={(w) => w.id}
        emptyLabel="No work items yet."
        detailsLabel="Work item"
        actions={bulk.actions}
        onDelete={bulk.onDelete}
        deleteConfirm={bulk.deleteConfirm}
        filterText={filter}
        onFilterTextChange={setFilter}
        filterPlaceholder="Filter work items…"
        // The key filters as readily as the title: pasting `ADH-42` out of a branch name is the
        // most direct way anyone will look for one card, and it is case-insensitive like the title.
        filterRow={(w, q) => {
          const needle = q.toLowerCase();
          return (
            w.title.toLowerCase().includes(needle) || w.itemKey.toLowerCase().includes(needle)
          );
        }}
        // Content-sized columns the user can drag; remembered per project.
        autoSizeColumns
        columnWidthsKey={`work-items:${projectId}`}
        storageKey={`work-items-split:${projectId}`}
        renderDetail={(w) => (
          <WorkItemDetail
            item={w}
            statuses={statuses}
            participants={participants}
            workItems={items}
          />
        )}
        emptyDetail={
          <p className="text-sm text-apt-text-muted">
            Select a work item to see its full record.
          </p>
        }
      />
      {bulk.dialog}
      <UnsavedChangesGuard when={pending} />
    </div>
  );
}
