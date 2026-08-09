"use client";

import { useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@agentic-toolkit/ui/components/dialog";
import { DialogActions } from "@agentic-toolkit/ui/components/dialog-actions";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { errorMessage } from "@agentic-toolkit/ui/lib/errors";
import { projectWorkItemsApi } from "@agentic-toolkit/data/projects";
import type {
  PriorityScale,
  ProjectStatus,
  ProjectParticipant,
  WorkItem,
} from "@agentic-toolkit/data/projects";
import { PRIORITIES } from "./WorkItemEditor";
import { participantLabel, fromOptionValue } from "./AssigneePicker";

/**
 * Change status, assignee or priority on EVERY selected work item at once — the thing a
 * multi-selection is for, and the reason the views wire `DataTable`'s selection at all.
 *
 * One dialog rather than three ("Set status…", "Assign…", "Prioritise…") because it is one
 * operation: a PATCH. Each field defaults to "Leave unchanged" and only the fields the user
 * actually set are sent, which is exactly the rule the List view's inline rows already follow —
 * a patch carries what THIS user touched, so it cannot clobber a field that changed underneath.
 * Three separate buttons would be three dialogs, three round-trip loops, and three chances for
 * them to disagree about what an untouched field means.
 *
 * "Leave unchanged" is the empty option value, which is safe here because no field's real values
 * can be empty: a status id and a priority are never "", and the assignee's own "clear it" case
 * is the explicit `UNASSIGN` option below rather than "". That keeps the sentinel out of the
 * data — nothing has to reserve a magic id.
 */

/** Clear the assignee (→ null), as distinct from leaving it alone. It carries no colon, so the
 *  shared codec decodes it to null on its own — a participant value is always `kind:id`. */
const UNASSIGN = "unassigned";

interface BulkDraft {
  statusId: string;
  assignee: string;
  priority: string;
}

const BLANK: BulkDraft = { statusId: "", assignee: "", priority: "" };

/** The work-item PATCH body, taken FROM the client rather than restated: a field the API stops
 *  accepting has to stop compiling here too. */
export type WorkItemBulkPatch = Parameters<typeof projectWorkItemsApi.update>[1];

/** The PATCH the draft describes: only the fields the user set. Exported for the test, which
 *  otherwise could only observe it through N mocked requests. */
export function bulkPatchOf(draft: BulkDraft): WorkItemBulkPatch {
  const assignee = draft.assignee ? fromOptionValue(draft.assignee) : undefined;
  return {
    ...(draft.statusId ? { statusId: draft.statusId } : {}),
    ...(draft.priority ? { priority: Number(draft.priority) } : {}),
    ...(draft.assignee
      ? {
          // The picker's kinds come from the project's participants, which are exactly the
          // assignable kinds — same narrowing the List view's inline column performs.
          assigneeKind: (assignee?.assigneeKind ?? null) as WorkItem["assigneeKind"],
          assigneeId: assignee?.assigneeId ?? null,
        }
      : {}),
  };
}

export function BulkEditDialog({
  count,
  noun,
  nounPlural,
  statuses,
  participants,
  priorityScale = "standard",
  onCancel,
  onApply,
}: {
  /** How many rows the change lands on — named in the heading, because "Update" over an
   *  off-screen selection is otherwise a change of unknown size. */
  count: number;
  /** What the rows are called, singular (e.g. "work item"). */
  noun: string;
  /** And plural. A separate prop rather than `noun + "s"` because a board renames its cards to
   *  whatever it likes, and "storys" is the shape that bug takes. Defaults to the suffixed form
   *  for a caller whose noun is regular. */
  nounPlural?: string;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** `none` drops the Priority field: the board does not rank, so there is nothing to set. */
  priorityScale?: PriorityScale;
  onCancel: () => void;
  /** Apply the patch to every selected row. Rejecting keeps the dialog open with the message,
   *  so a partial failure is visible rather than swallowed by a close. */
  onApply: (patch: WorkItemBulkPatch) => Promise<void>;
}): ReactElement {
  const [draft, setDraft] = useState<BulkDraft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BulkDraft>(key: K, value: BulkDraft[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }));

  const patch = bulkPatchOf(draft);
  const touched = Object.keys(patch).length > 0;

  async function apply(): Promise<void> {
    if (!touched) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(patch);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-apt-gold">
            Update {count} {count === 1 ? noun : nounPlural ?? `${noun}s`}
          </DialogTitle>
        </DialogHeader>

        <Field label="Status">
          <Select
            value={draft.statusId}
            onChange={(e) => set("statusId", e.target.value)}
            aria-label="Status for every selected row"
          >
            <option value="">Leave unchanged</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Assignee">
          <Select
            value={draft.assignee}
            onChange={(e) => set("assignee", e.target.value)}
            aria-label="Assignee for every selected row"
          >
            <option value="">Leave unchanged</option>
            <option value={UNASSIGN}>Unassigned</option>
            {participants.map((p) => (
              <option
                key={`${p.participantKind}:${p.participantId}`}
                value={`${p.participantKind}:${p.participantId}`}
              >
                {participantLabel(p)}
              </option>
            ))}
          </Select>
        </Field>

        {priorityScale !== "none" && (
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(e) => set("priority", e.target.value)}
              aria-label="Priority for every selected row"
            >
              <option value="">Leave unchanged</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={String(p.value)}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <ErrorText error={error} />

        <DialogFooter>
          <DialogActions
            cancelLabel="Cancel"
            onCancel={onCancel}
            confirmLabel="Update"
            onConfirm={() => void apply()}
            busy={busy}
            // Nothing chosen ⇒ nothing to send. An enabled Update that PATCHes `{}` onto N rows
            // would touch every one of their `updated_at`s to say nothing.
            confirmDisabled={!touched}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
