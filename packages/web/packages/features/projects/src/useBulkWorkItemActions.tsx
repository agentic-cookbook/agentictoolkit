"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ListAction } from "@agentic-toolkit/ui/blocks/selection-actions";
import { projectWorkItemsApi } from "@agentic-toolkit/data/projects";
import type { ProjectStatus, ProjectParticipant } from "@agentic-toolkit/data/projects";
import { BulkEditDialog } from "./BulkEditDialog";

/**
 * What a multi-selection DOES to work items — Update… and Delete — as one hook, so the List and
 * the Table offer the same two things and mean the same thing by them.
 *
 * The alternative was each view declaring its own `actions` array. That reads harmless right up
 * to the first divergence: one view confirms a delete and the other doesn't, or they disagree on
 * whether a partial failure counts as success. Selection is a shared idea here, so its verbs are
 * too. The views still differ in how selection is EXPRESSED (the List's lives inside its
 * details-pane block, the Table holds its own set) — this hook takes the ids as arguments and
 * stays out of that.
 *
 * Failure is per-row and reported honestly. N patches are N requests, and some can fail while
 * others land — most usefully when a row was deleted by someone else mid-selection. Nothing here
 * pretends that was all-or-nothing: the survivors keep their change, the count that failed is
 * named, and the caller reloads either way so the screen shows what is actually stored.
 */

/** Run `op` over every id and report the failures as one error. `allSettled`, not `all`: the
 *  first rejection must not abandon the rest, because the requests are already in flight and
 *  the rows they touch will change whether or not anyone is listening. */
async function forEachRow(
  ids: string[],
  op: (id: string) => Promise<unknown>,
  verb: string,
): Promise<void> {
  const results = await Promise.allSettled(ids.map(op));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === 0) return;
  const first = failed[0] as PromiseRejectedResult;
  const reason = first.reason instanceof Error ? first.reason.message : String(first.reason);
  throw new Error(
    `${failed.length} of ${ids.length} work items could not be ${verb}: ${reason}`,
  );
}

export interface BulkWorkItemActions {
  /** Hand to `ListWithDetailsPane`'s `actions`, or to `SelectionActions`. */
  actions: ListAction[];
  onDelete: (ids: string[]) => void;
  deleteConfirm: { title: string; description: ReactNode };
  /** The last bulk failure, for the view's own `ErrorText`. */
  error: string | null;
  /** The Update… dialog while it is open. Render it inside the view. */
  dialog: ReactNode;
}

export function useBulkWorkItemActions({
  statuses,
  participants,
  onChanged,
}: {
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** Re-read the shared items, so every view repaints on what the server now holds. */
  onChanged: () => Promise<void>;
}): BulkWorkItemActions {
  // The ids the open dialog will patch, captured when Update… was pressed. Held here rather than
  // read at confirm time because the selection can move underneath an open dialog — the user
  // agreed to change THESE rows.
  const [editing, setEditing] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setError(null);
      void (async () => {
        try {
          await forEachRow(ids, (id) => projectWorkItemsApi.remove(id), "deleted");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
        await onChanged();
      })();
    },
    [onChanged],
  );

  const actions = useMemo<ListAction[]>(
    () => [
      {
        id: "bulk-edit",
        label: "Update…",
        requiresSelection: true,
        onClick: (ids) => {
          setError(null);
          setEditing(ids);
        },
      },
    ],
    [],
  );

  const dialog =
    editing === null ? null : (
      <BulkEditDialog
        count={editing.length}
        noun="work item"
        statuses={statuses}
        participants={participants}
        onCancel={() => setEditing(null)}
        onApply={async (patch) => {
          try {
            await forEachRow(editing, (id) => projectWorkItemsApi.update(id, patch), "updated");
          } finally {
            // Whether or not every row took the patch, some may have — the views must not keep
            // showing the pre-patch rows. The reload happens before the throw propagates.
            await onChanged();
          }
          setEditing(null);
        }}
      />
    );

  return {
    actions,
    onDelete,
    deleteConfirm: {
      title: "Delete the selected work items?",
      // Both sentences are what the code does, not a guess. The route soft-deletes (the row stays,
      // hidden), and `flattenTree` roots a row whose parent is not among the visible ones — so a
      // deleted parent's children survive and climb to the top level rather than vanishing with it.
      description:
        "Any sub-items they have are not deleted — they move up to the top level of the list.",
    },
    error,
    dialog,
  };
}
