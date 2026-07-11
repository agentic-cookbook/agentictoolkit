"use client";

import { type ReactElement } from "react";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import type { ProjectParticipant } from "@agentic-toolkit/data/projects";

/**
 * The work-item assignment UI: a Field + native Select over the project's
 * participants, plus an "Unassigned" option (→ null). There is no existing
 * entity picker, so this is built fresh, mirroring the TeamMembersPane
 * add-an-agent Field+Select idiom.
 *
 * A native <select> can only carry string option values, so each participant is
 * VALUED by a composite `${kind}:${id}` key that maps back to the {assigneeKind,
 * assigneeId} pair a work item stores; "" is the Unassigned sentinel (→ null).
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
}: {
  participants: ProjectParticipant[];
  value: AssigneeValue | null;
  onChange: (v: AssigneeValue | null) => void;
}): ReactElement {
  return (
    <Field label="Assignee">
      <Select
        value={toOptionValue(value)}
        onChange={(e) => onChange(fromOptionValue(e.target.value))}
      >
        <option value="">Unassigned</option>
        {participants.map((p) => (
          <option
            key={p.id}
            value={toOptionValue({
              assigneeKind: p.participantKind,
              assigneeId: p.participantId,
            })}
          >
            {participantLabel(p)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
