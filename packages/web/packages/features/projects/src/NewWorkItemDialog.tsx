"use client";

import type { ReactElement } from "react";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Select } from "@agentic-toolkit/ui/components/select";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { CreateResourceDialog } from "@agentic-toolkit/resource";
import {
  projectWorkItemsApi,
  type ProjectStatus,
  type WorkItem,
} from "@agentic-toolkit/data/projects";

/**
 * The "New work item" MODAL — the create affordance for the Work Items level's header `+`.
 *
 * Creating is a modal in the hierarchical stack, never a blank leaf: the detail pane always shows
 * a REAL, selected record, so a create can't borrow it (see the hierarchical-topic-detail recipe,
 * `must-create-in-modal`). The modal captures only what is needed to bring the record into
 * existence and place it — title, description, the status column it lands in — and the created
 * item's own detail opens for everything else (assignee, priority, dates, parent, activity),
 * exactly as "New Project" does.
 *
 * The iteration and the estimate are in that second group deliberately, though a card COULD be
 * created straight into a cycle (the API takes both on create). Committing work to a fortnight
 * and sizing it are planning decisions made about a card that exists, usually later and often by
 * someone else; putting them in the modal would make writing down an idea a planning meeting.
 * The detail pane's pickers are where both are answered.
 *
 * Built on the shared {@link CreateResourceDialog}, so the guarded close (Save / Discard / keep
 * editing, inert backdrop) behaves like every other create on the platform.
 */

interface WorkItemInput {
  title: string;
  description: string;
  statusId: string;
}

export function NewWorkItemDialog({
  projectId,
  statuses,
  onClose,
  onCreated,
}: {
  projectId: string;
  /** The project's status columns; the first is the default landing column. */
  statuses: ProjectStatus[];
  onClose: () => void;
  /** The created item — the caller refreshes the views and opens its detail. */
  onCreated: (item: WorkItem) => void;
}): ReactElement {
  return (
    <CreateResourceDialog<WorkItemInput, WorkItem>
      ariaLabel="New work item"
      heading="New work item"
      blank={() => ({ title: "", description: "", statusId: statuses[0]?.id ?? "" })}
      validate={(d) => (d.title.trim() ? null : "Title is required.")}
      create={(d) =>
        projectWorkItemsApi.create(projectId, {
          title: d.title.trim(),
          description: d.description.trim() || undefined,
          statusId: d.statusId || undefined,
        })
      }
      onClose={onClose}
      onCreated={onCreated}
      renderForm={(draft, onChange, error) => (
        <>
          <Field label="Title">
            <Input
              /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
              autoFocus
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
              placeholder="Design the landing page"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              placeholder="What needs to happen? (optional)"
              rows={3}
            />
          </Field>

          <Field label="Status">
            <Select
              value={draft.statusId}
              onChange={(e) => onChange({ ...draft, statusId: e.target.value })}
            >
              {statuses.length === 0 && <option value="">Default</option>}
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <ErrorText error={error} />
        </>
      )}
    />
  );
}
