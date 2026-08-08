"use client";

import { useMemo, useState, type ReactElement } from "react";
import { SearchFilterBar } from "@agentic-toolkit/ui/components/search-filter-bar";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Disclosure } from "@agentic-toolkit/ui/components/disclosure";
import { EntityChooser } from "@agentic-toolkit/ui/components/entity-chooser";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Input } from "@agentic-toolkit/ui/components/input";
import { ListChooser } from "@agentic-toolkit/ui/components/list-chooser";
import type {
  Iteration,
  ProjectParticipant,
  ProjectStatus,
} from "@agentic-toolkit/data/projects";
import { participantLabel, toOptionValue } from "./AssigneePicker";
import { PRIORITIES } from "./WorkItemEditor";
import {
  EMPTY_FILTER,
  NO_ITERATION,
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
  labelOptions,
}: {
  filter: WorkItemFilter;
  onChange: (next: WorkItemFilter) => void;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  iterations: Iteration[];
  /** The project's label vocabulary — the same suggestions the editor offers. */
  labelOptions: string[];
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
        aria-label="Filter work items"
        orientation="inline"
        search={{
          value: filter.text,
          onChange: (text) => set("text", text),
          label: "Search work items",
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
          {
            name: "priority",
            label: "Filter by priority",
            value: filter.priority,
            options: PRIORITIES.map((p) => ({ value: String(p.value), label: p.label })),
            allLabel: "Any priority",
            onChange: (v) => set("priority", v),
          },
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
            hint="An item must carry every label listed."
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
            hint="Items with no due date are outside any window."
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
