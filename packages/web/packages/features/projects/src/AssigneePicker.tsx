"use client";

import { useMemo, type ReactElement } from "react";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { ListChooser } from "@agentic-toolkit/ui/components/list-chooser";
import type { ProjectParticipant } from "@agentic-toolkit/data/projects";

/**
 * The work-item assignment UI: a Field + the shared {@link ListChooser} typeahead over the
 * project's participants, plus an "Unassigned" entry (→ null).
 *
 * It began as a native `<Select>`, which is the right control for a bounded list and the wrong
 * one here: a project's participant list grows without bound, and past a dozen entries a
 * dropdown is a scroll rather than a choice — you cannot find a name you already know without
 * reading every name you don't. `ListChooser` is the toolkit's answer (type to filter, arrow
 * keys to move, Enter to accept), so this is a composition rather than a new control.
 * `allowCreate` is off: you can only assign someone who is on this project, and inventing a
 * name here would produce an assignee id nothing can resolve.
 *
 * The composite `${kind}:${id}` VALUE codec is unchanged and still exported — the list view's
 * inline assignee cell is a native select (a typeahead popover inside a dense grid row would
 * fight the row), and both encode an assignee identically. "" is the Unassigned sentinel
 * (→ null), carried as a real ITEM rather than as the absence of one: an unassigned card is an
 * answer people pick deliberately, and a chooser with no way back to it is a trap.
 */

/** The (kind, id) reference an assignee resolves to — the assignable subset of a
 *  participant. Kept as plain strings (the picker is kind-agnostic); the caller
 *  narrows to the work-item union when it hits the API. */
export interface AssigneeValue {
  assigneeKind: string;
  assigneeId: string;
}

/** A participant's human label, shared by the picker options and the list's
 *  assignee column so both read the same — "customer · cust-1". */
export function participantLabel(p: ProjectParticipant): string {
  return `${p.participantKind} · ${p.participantId}`;
}

/** Encode an assignee as its composite option value (""=Unassigned). Exported so the list view's
 *  inline assignee column encodes it exactly the same way — one authoritative codec. */
export function toOptionValue(v: AssigneeValue | null): string {
  return v ? `${v.assigneeKind}:${v.assigneeId}` : "";
}

/** Decode a composite option value back to an assignee (""→null). participantId
 *  is opaque and may itself contain ':', so split on the FIRST colon only. Exported alongside
 *  {@link toOptionValue} so every consumer shares the one codec. */
export function fromOptionValue(raw: string): AssigneeValue | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  return { assigneeKind: raw.slice(0, idx), assigneeId: raw.slice(idx + 1) };
}

export function AssigneePicker({
  participants,
  value,
  onChange,
  label = "Assignee",
  noneLabel = "Unassigned",
}: {
  participants: ProjectParticipant[];
  value: AssigneeValue | null;
  onChange: (v: AssigneeValue | null) => void;
  /** What this reference IS on the record being edited. Defaults to a card's assignee, because
   *  that is what the control was written for; a project's LEAD is the same question asked of the
   *  same roster, so it is this control under another word rather than a second one. */
  label?: string;
  /** How the all-important empty answer reads. "Unassigned" is right for a card and wrong for a
   *  project ("No lead"), and the sentinel it carries is `""` either way. */
  noneLabel?: string;
}): ReactElement {
  const items = useMemo(
    () => [
      { value: "", label: noneLabel },
      ...participants.map((p) => ({
        value: toOptionValue({
          assigneeKind: p.participantKind,
          assigneeId: p.participantId,
        }),
        label: participantLabel(p),
      })),
    ],
    [participants, noneLabel],
  );

  return (
    <Field label={label}>
      <ListChooser
        items={items}
        value={toOptionValue(value)}
        onChange={(v) => onChange(fromOptionValue(v))}
        allowCreate={false}
        ariaLabel={label}
        inputLabel="Find a participant"
        placeholder="Type a name…"
        emptyLabel="No matching participant"
      />
    </Field>
  );
}
