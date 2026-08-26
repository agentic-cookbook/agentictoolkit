"use client";

import type { ReactElement } from "react";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { CreateResourceDialog } from "@agentic-toolkit/resource";
import {
  projectTemplatesApi,
  projectWorkItemsApi,
  workItemBodyOf,
  type ProjectStatus,
  type Template,
  type WorkItem,
} from "@agentic-toolkit/data/projects";
import { templateSublabel } from "./TemplatesPane";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";

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
 * The iteration, the milestone and the estimate are in that second group deliberately, though a
 * card COULD be created straight into any of them (the API takes all three on create). Committing
 * work to a fortnight, aiming it at a delivery and sizing it are planning decisions made about a
 * card that exists, usually later and often by someone else; putting them in the modal would make
 * writing down an idea a planning meeting. The detail pane's pickers are where all three are
 * answered.
 *
 * A TEMPLATE may stand in for the whole form. Picking one replaces "type a card" with "stamp out
 * the usual one", and the modal shrinks to the two things a template cannot know: which board
 * column it lands in, and whether this instance wants a different title. The description field
 * DISAPPEARS rather than greying out, because the instantiate endpoint has no description
 * parameter at all — the template writes it — and a field whose contents are silently discarded is
 * worse than an absent one. Templates that make a BOARD are filtered out here for the same reason
 * they are offered in "New project" instead: this dialog makes a card.
 *
 * Built on the shared {@link CreateResourceDialog}, so the guarded close (Save / Discard / keep
 * editing, inert backdrop) behaves like every other create on the platform.
 */

/** The "no template — type it myself" sentinel. `""` because that is what an unset Select reads
 *  as, so the blank draft needs no special case. */
const NO_TEMPLATE = "";

interface WorkItemInput {
  /** A card template's id, or {@link NO_TEMPLATE}. */
  templateId: string;
  title: string;
  description: string;
  statusId: string;
}

export function NewWorkItemDialog({
  projectId,
  statuses,
  templates,
  words = DEFAULT_ITEM_WORDS,
  onClose,
  onCreated,
}: {
  projectId: string;
  /** The project's status columns; the first is the default landing column. */
  statuses: ProjectStatus[];
  /** The WORKSPACE's templates, of both kinds — the same list the Templates pane holds, passed in
   *  rather than re-read so the two share one cached read. Card templates are selected out here;
   *  omit for a host that does not offer templates at all (the picker then does not render). */
  templates?: Template[];
  /** What this board calls its items. Defaulted rather than required so a host that has not
   *  loaded the project still opens a working dialog — with the default noun, which is what the
   *  overwhelming majority of boards say anyway. */
  words?: ItemWords;
  onClose: () => void;
  /** The created item — the caller refreshes the views and opens its detail. */
  onCreated: (item: WorkItem) => void;
}): ReactElement {
  // Only the ones that make a CARD. A board template in this list would be an offer to do
  // something this dialog cannot do.
  const cardTemplates = (templates ?? []).filter((t) => t.kind === "work_item");

  return (
    <CreateResourceDialog<WorkItemInput, WorkItem>
      ariaLabel={`New ${words.one}`}
      heading={`New ${words.one}`}
      blank={() => ({
        templateId: NO_TEMPLATE,
        title: "",
        description: "",
        statusId: statuses[0]?.id ?? "",
      })}
      // A template SUPPLIES the title, so the requirement is only on a card being typed from
      // nothing. Leaving it blank with a template chosen is a real answer — "use the usual title" —
      // and the placeholder says so.
      validate={(d) =>
        d.templateId !== NO_TEMPLATE || d.title.trim() ? null : "Title is required."
      }
      create={(d) =>
        d.templateId === NO_TEMPLATE
          ? projectWorkItemsApi.create(projectId, {
              title: d.title.trim(),
              description: d.description.trim() || undefined,
              statusId: d.statusId || undefined,
            })
          : // The children the template writes come back alongside; the dialog hands its caller the
            // PARENT, which is the card that was asked for and the one whose detail should open.
            // The caller reloads the list, which is where the steps appear.
            projectTemplatesApi
              .instantiateWorkItem(d.templateId, {
                projectId,
                title: d.title.trim() || undefined,
                statusId: d.statusId || undefined,
              })
              .then((r) => r.item)
      }
      onClose={onClose}
      onCreated={onCreated}
      renderForm={(draft, onChange, error) => {
        const chosen = cardTemplates.find((t) => t.id === draft.templateId) ?? null;
        const cardTitle = chosen ? (workItemBodyOf(chosen)?.title ?? "") : "";
        return (
          <>
            {cardTemplates.length > 0 && (
              <Field
                label="Template"
                hint={`Stamp out a ${words.one} this workspace makes often, with its checklist.`}
              >
                <Select
                  value={draft.templateId}
                  onChange={(e) => onChange({ ...draft, templateId: e.target.value })}
                >
                  <option value={NO_TEMPLATE}>{`Blank ${words.one}`}</option>
                  {cardTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {`${t.name} — ${templateSublabel(t)}`}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field
              label="Title"
              hint={chosen ? "Leave blank to use the template's title." : undefined}
            >
              <Input
                /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                autoFocus
                value={draft.title}
                onChange={(e) => onChange({ ...draft, title: e.target.value })}
                placeholder={chosen ? cardTitle : "Design the landing page"}
              />
            </Field>

            {/* Absent, not disabled, with a template chosen: the instantiate endpoint takes no
                description, so anything typed here would be dropped without a word. */}
            {!chosen && (
              <Field label="Description">
                <Textarea
                  value={draft.description}
                  onChange={(e) => onChange({ ...draft, description: e.target.value })}
                  placeholder="What needs to happen? (optional)"
                  rows={3}
                />
              </Field>
            )}

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
        );
      }}
    />
  );
}
