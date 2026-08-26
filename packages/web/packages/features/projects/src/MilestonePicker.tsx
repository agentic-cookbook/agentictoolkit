"use client";

import { type ReactElement } from "react";
import { Field } from "@agenticdevelopertoolkit/ui/blocks/field";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import type { Milestone } from "@agentic-toolkit/data/projects";
import { dateLabel } from "./helpers";

/**
 * Which point in the plan a card counts toward: a Field + native Select over the PROJECT's
 * milestones, plus a "No milestone" option (→ null).
 *
 * Native, for the same reason {@link IterationPicker} is and {@link AssigneePicker} is not: a
 * board's plan is a handful of points a reader already knows the names of, so reading the list
 * whole beats typing at it. If a plan ever grows past that, the fix is this file becoming a
 * ListChooser — not a second control beside it.
 *
 * Ungrouped, where the iteration picker groups by state. A milestone has no state to group BY: it
 * is a date and a name, and the server already returns them in the only order that means anything
 * (soonest first, undated last). Inventing "past / upcoming" buckets here would be this bundle
 * asserting a status the record does not carry — and a point whose cards are all finished is not
 * "past" merely because the calendar moved.
 *
 * The value is the milestone id as a plain string, and "" is none — flat, because the editor
 * compares its draft fields with `Object.is` and an object-valued field would read dirty forever.
 *
 * On a board with NO milestones this renders nothing, the way {@link EstimatePicker} renders
 * nothing under the `none` scale. A select whose only entry is "No milestone" is not a choice, and
 * most boards never declare a plan at all — where the iteration picker always renders, because its
 * list belongs to the workspace and "Backlog" is a real answer about the card either way. The
 * exception is a card that already NAMES one: then the field appears regardless, since a value the
 * reader cannot see is a value they cannot correct.
 */

/** The unset option's value. "" rather than a word, so it cannot collide with an id and so the
 *  empty draft field and "counts toward nothing" are the same thing. */
export const NO_MILESTONE = "";

export function MilestonePicker({
  milestones,
  value,
  onChange,
  label = "Milestone",
}: {
  /** the project's plan, in the server's order (soonest first, undated last). */
  milestones: Milestone[];
  /** the milestone's id, or {@link NO_MILESTONE}. */
  value: string;
  onChange: (milestoneId: string) => void;
  label?: string;
}): ReactElement | null {
  if (milestones.length === 0 && value === NO_MILESTONE) return null;

  // A point the picker no longer offers — deleted, or belonging to a plan this reader cannot see —
  // still has to be SELECTABLE, or opening the editor would silently detach the card on the next
  // save. Same guard as the iteration picker's, for the same reason.
  const known = new Set(milestones.map((m) => m.id));
  const orphan = value !== NO_MILESTONE && !known.has(value) ? value : null;

  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NO_MILESTONE}>No milestone</option>
        {orphan ? <option value={orphan}>Keep current milestone</option> : null}
        {milestones.map((m) => (
          <option key={m.id} value={m.id}>
            {m.targetDate ? `${m.name} · ${dateLabel(m.targetDate)}` : m.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
