"use client";

import { useMemo, useState, type ReactElement } from "react";
import { SearchFilterBar } from "@agenticdevelopertoolkit/ui/components/search-filter-bar";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Disclosure } from "@agenticdevelopertoolkit/ui/components/disclosure";
import { EntityChooser } from "@agenticdevelopertoolkit/ui/components/entity-chooser";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { ListChooser } from "@agenticdevelopertoolkit/ui/components/list-chooser";
import type {
  Iteration,
  Milestone,
  PriorityScale,
  ProjectParticipant,
  ProjectStatus,
} from "@agentic-toolkit/data/projects";
import { participantLabel, toOptionValue } from "./AssigneePicker";
import { PRIORITIES } from "./WorkItemEditor";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";
import {
  EMPTY_FILTER,
  NO_ITERATION,
  NO_MILESTONE,
  UNASSIGNED,
  isFilterActive,
  type WorkItemFilter,
} from "./filters";

/**
 * The work-items filter bar: the controls that produce a {@link WorkItemFilter}.
 *
 * It is a composition, not a new control. The shared {@link SearchFilterBar} supplies the
 * `role="search"` landmark, the text field and the row; the single-select axes are its `filters`
 * config; the two axes that are genuinely not single-selects — the assignee TYPEAHEAD and the
 * label SET — arrive through the slot its own docs reserve for exactly that ("a multi-select, a
 * date range, a toggle group"). The dates are two native `<input type="date">`, per
 * `native-controls`: a hand-rolled calendar would be a month of behaviour (locales, keyboard,
 * mobile pickers) to re-earn what the platform already ships.
 *
 * The split across the Disclosure is about FREQUENCY, not importance. Status, assignee and text
 * are what someone reaches for constantly, so they are always visible; labels and a due-date
 * window are occasional, and putting all seven axes in one permanent row costs the board two
 * lines of vertical space every day to serve the rarer question. What the disclosure must never
 * do is HIDE an active filter — a list silently narrowed by a control the user cannot see is a
 * list that looks broken — so its header carries a count of the axes folded inside it, and it
 * opens by itself while any of them is set.
 *
 * The bar owns no state: `filter` in, `onChange` out. That keeps the filter a value the surface
 * holds (and a saved view can store) rather than something locked inside a control.
 */
export function WorkItemFilterBar({
  filter,
  onChange,
  statuses,
  participants,
  iterations,
  milestones,
  labelOptions,
  priorityScale = "standard",
  words = DEFAULT_ITEM_WORDS,
}: {
  filter: WorkItemFilter;
  onChange: (next: WorkItemFilter) => void;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  iterations: Iteration[];
  /** This board's milestones. An empty list removes the axis entirely (see below) — most boards
   *  never declare one, and an axis whose every answer is "no" is a control that cannot narrow. */
  milestones: Milestone[];
  /** The project's label vocabulary — the same suggestions the editor offers. */
  labelOptions: string[];
  /** Whether this board ranks at all. `"none"` drops the priority axis for the same reason an
   *  empty milestone list drops that one: every card answers the same, so the control cannot
   *  narrow. Defaults to `"standard"` so the axis is present while the project is still loading —
   *  the common board ranks, and a control that blinks in is worse than one that blinks out. */
  priorityScale?: PriorityScale;
  /** What this board calls its cards. */
  words?: ItemWords;
}): ReactElement {
  const set = <K extends keyof WorkItemFilter>(key: K, value: WorkItemFilter[K]): void =>
    onChange({ ...filter, [key]: value });

  // Every answer the assignee axis can give. Three kinds of entry, and the order is the point:
  // "Anyone" is the all-pass entry (`""`), carried as an ITEM so the axis can be widened again
  // from inside the typeahead — a chooser with no way back to "all" is a trap. "Unassigned" is a
  // real answer about a card rather than the absence of one, so it is an option, not the
  // all-pass. The rest are the project's participants, valued through the SAME composite
  // `kind:id` codec the assignee picker writes, so a filter for someone matches every card that
  // picker assigned to them.
  const assigneeItems = useMemo(
    () => [
      { value: "", label: "Anyone" },
      { value: UNASSIGNED, label: "Unassigned" },
      ...participants.map((p) => ({
        value: toOptionValue({ assigneeKind: p.participantKind, assigneeId: p.participantId }),
        label: participantLabel(p),
      })),
    ],
    [participants],
  );

  // The priority axis, or null on a board that does not rank — dropped for the same reason the
  // milestone axis below is: on an unranked board every card carries the same rank, so the
  // control cannot narrow anything. And kept anyway while the FILTER names one, for that axis's
  // second reason too: a saved view written before the board turned ranking off still narrows
  // the list, and hiding the control would do it with nothing on screen to say so or undo it.
  //
  // Not memoised, and deliberately, for the reason spelled out under the milestone axis.
  const priorityAxis =
    priorityScale !== "none" || filter.priority !== ""
      ? {
          name: "priority",
          label: "Filter by priority",
          value: filter.priority,
          options: PRIORITIES.map((p) => ({ value: String(p.value), label: p.label })),
          allLabel: "Any priority",
          onChange: (v: string) => set("priority", v),
        }
      : null;

  // The milestone axis's answers, or null when the board has no milestone axis to offer.
  //
  // Two things are load-bearing here. The axis is DROPPED on a board with no milestones — the
  // same call TableView makes about its iteration column, and for the same reason: a select whose
  // only entries are "all" and "none" cannot narrow anything, so showing it costs a control and
  // buys a dead end. And it is kept anyway while the FILTER names one, because a filter arriving
  // from a URL or a saved view can outlive the milestone it names; dropping the control then
  // would narrow the list with nothing on screen to say so or to undo it. That same survivor gets
  // an option of its own, since a `<select>` whose value is absent from its options silently
  // displays the first one instead — the list would read "All milestones" while filtering.
  //
  // Deliberately NOT memoised, where the assignee list above is: this config closes over `set`,
  // and therefore over the whole `filter`. Held across renders it would merge the axis into a
  // stale filter and silently revert whatever the user changed in between.
  const namedMilestone = filter.milestoneId !== "" && filter.milestoneId !== NO_MILESTONE;
  const milestoneAxis =
    milestones.length === 0 && !namedMilestone
      ? null
      : {
          name: "milestone",
          label: "Filter by milestone",
          value: filter.milestoneId,
          // "No milestone" leads for the same reason "Backlog" leads the iteration axis: counting
          // toward nothing is an answer about a card, not the absence of a question.
          options: [
            { value: NO_MILESTONE, label: "No milestone" },
            ...milestones.map((m) => ({ value: m.id, label: m.name })),
            ...(namedMilestone && !milestones.some((m) => m.id === filter.milestoneId)
              ? [{ value: filter.milestoneId, label: "Filtered milestone" }]
              : []),
          ],
          allLabel: "All milestones",
          onChange: (v: string) => set("milestoneId", v),
        };

  // The axes behind the disclosure, counted rather than described: the header says how many are
  // narrowing the list so a folded filter is never invisible.
  const foldedActive =
    (filter.labels.length > 0 ? 1 : 0) +
    (filter.dueFrom !== "" ? 1 : 0) +
    (filter.dueTo !== "" ? 1 : 0);
  // Open if the user opened it OR something inside is narrowing the list. The two are ORed
  // rather than one being derived from the other: a filter arriving from a URL or a saved view
  // must reveal its own controls, and a section the user opened by hand must not slam shut the
  // moment they clear the last label they were editing in it.
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <SearchFilterBar
        aria-label={`Filter ${words.many}`}
        orientation="inline"
        search={{
          value: filter.text,
          onChange: (text) => set("text", text),
          label: `Search ${words.many}`,
          placeholder: "Search by key, title or description…",
        }}
        filters={[
          {
            name: "status",
            label: "Filter by status",
            value: filter.statusId,
            options: statuses.map((s) => ({ value: s.id, label: s.label })),
            allLabel: "All statuses",
            onChange: (v) => set("statusId", v),
          },
          ...(priorityAxis ? [priorityAxis] : []),
          {
            name: "iteration",
            label: "Filter by iteration",
            value: filter.iterationId,
            // Backlog leads the list for the same reason "Unassigned" does: a card with no
            // iteration is committed to nothing, which is a state people filter FOR.
            options: [
              { value: NO_ITERATION, label: "Backlog" },
              ...iterations.map((i) => ({ value: i.id, label: i.name })),
            ],
            allLabel: "All iterations",
            onChange: (v) => set("iterationId", v),
          },
          // Directly after the iteration, because the two are the same question asked twice —
          // when, and toward what — and a reader who is narrowing one usually wants the other.
          ...(milestoneAxis ? [milestoneAxis] : []),
        ]}
      >
        {/* A typeahead rather than a select: a project's participant list grows without bound,
            and past a dozen entries a dropdown is a scroll rather than a choice. `allowCreate` is
            off — you can only filter by someone who is on this project. */}
        <ListChooser
          items={assigneeItems}
          value={filter.assignee}
          onChange={(v) => set("assignee", v)}
          allowCreate={false}
          ariaLabel="Filter by assignee"
          inputLabel="Find an assignee"
          placeholder="Type a name…"
          emptyLabel="No matching participant"
          className="w-44"
        />
        {isFilterActive(filter) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTER)}>
            Clear filters
          </Button>
        )}
      </SearchFilterBar>

      <Disclosure
        title="More filters"
        subtitle={
          foldedActive === 0
            ? "Labels and due dates."
            : `${foldedActive} of these ${foldedActive === 1 ? "is" : "are"} narrowing the list.`
        }
        open={moreOpen || foldedActive > 0}
        onOpenChange={setMoreOpen}
      >
        <div className="flex flex-wrap items-start gap-4">
          <Field
            label="Labels"
            hint={`A ${words.one} must carry every label listed.`}
            className="min-w-64"
          >
            <EntityChooser
              multiple
              options={labelOptions}
              value={filter.labels}
              onChange={(next) => set("labels", next)}
              ariaLabel="Filter by labels"
              triggerLabel="Add a label…"
              // Filtering by a label nothing carries would empty the list with no way to tell
              // that from "nothing matches" — so the axis offers only labels in use.
              allowCreate={false}
              emptyLabel="No matching label"
              emptySelectionLabel="Any labels"
            />
          </Field>
          <Field label="Due on or after" className="w-44">
            <Input
              type="date"
              value={filter.dueFrom}
              aria-label="Due on or after"
              onChange={(e) => set("dueFrom", e.target.value)}
            />
          </Field>
          <Field
            label="Due on or before"
            hint={`${words.manyCap} with no due date are outside any window.`}
            className="w-44"
          >
            <Input
              type="date"
              value={filter.dueTo}
              aria-label="Due on or before"
              onChange={(e) => set("dueTo", e.target.value)}
            />
          </Field>
        </div>
      </Disclosure>
    </div>
  );
}
