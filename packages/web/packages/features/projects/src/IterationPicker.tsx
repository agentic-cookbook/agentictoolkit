"use client";

import { type ReactElement } from "react";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import type { Iteration, IterationState } from "@agentic-toolkit/data/projects";
import { iterationDateRange } from "./helpers";

/**
 * Which time-box a card is committed to: a Field + native Select over the WORKSPACE's
 * iterations, plus a "Backlog" option (→ null). The AssigneePicker idiom, deliberately — the
 * two sit next to each other in the editor and there is no reason for them to be different
 * shapes of control.
 *
 * Two things about the list are worth stating rather than leaving to be discovered:
 *
 * 1. The options come from the workspace, not the project. A cycle spans every board its owner
 *    runs, so this list is the SAME on every project in the workspace — which is what lets one
 *    sprint hold work from three boards.
 * 2. The value is the iteration id as a plain string, and "" is the backlog. That is not
 *    incidental: the editor carries its draft as flat scalars so a re-render can compare them
 *    with `Object.is`, and an object-valued field would read as dirty forever.
 */

/** The backlog's option value. "" rather than a word, so it cannot collide with an id, and so
 *  the empty draft field and "no iteration" are the same thing. */
export const NO_ITERATION = "";

/** The order the states are offered in — the order a person plans in: the box they are in, then
 *  the ones they are planning, then what is already closed. Completed boxes are offered rather
 *  than hidden, because re-filing a card into the cycle it was actually done in is an ordinary
 *  correction, and a picker that refuses it forces the lie. */
const STATE_ORDER: IterationState[] = ["active", "upcoming", "completed"];

const GROUP_LABEL: Record<IterationState, string> = {
  active: "Active",
  upcoming: "Upcoming",
  completed: "Completed",
};

export function IterationPicker({
  iterations,
  value,
  onChange,
  label = "Iteration",
}: {
  /** the workspace's boxes; grouped by state here, so any order is accepted. */
  iterations: Iteration[];
  /** the committed iteration's id, or {@link NO_ITERATION} for the backlog. */
  value: string;
  onChange: (iterationId: string) => void;
  label?: string;
}): ReactElement {
  // Grouped rather than flat: a run of a dozen sprints reads as a wall of names otherwise, and
  // the one fact a person needs while committing a card — is this cycle running yet — is exactly
  // the one a flat list throws away.
  const groups = STATE_ORDER.map((state) => ({
    state,
    items: iterations.filter((i) => i.state === state),
  })).filter((g) => g.items.length > 0);

  // A box the picker no longer offers — one from a state this bundle does not know, or an id
  // that arrived on the card and is not in the list — still has to be SELECTABLE, or opening
  // the editor would silently re-file the card into the backlog on the next save.
  const known = new Set(iterations.map((i) => i.id));
  const orphan = value !== NO_ITERATION && !known.has(value) ? value : null;

  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NO_ITERATION}>Backlog</option>
        {orphan ? <option value={orphan}>Keep current iteration</option> : null}
        {groups.map((g) => (
          <optgroup key={g.state} label={GROUP_LABEL[g.state] ?? g.state}>
            {g.items.map((i) => (
              <option key={i.id} value={i.id}>
                {`${i.name} · ${iterationDateRange(i.startDate, i.endDate)}`}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}
