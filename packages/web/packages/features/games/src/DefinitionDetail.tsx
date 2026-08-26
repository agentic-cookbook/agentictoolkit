"use client";

import { useId } from "react";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import type {
  GameDefinition,
  GameDefinitionInput,
  GameDefinitionStatus,
} from "@agentic-toolkit/data/games";
import { wholeNumberProblem } from "./fields";
import { IntegerInput } from "./IntegerInput";
import { readSlots, validateSlots, writeSlots } from "./slots";
import { SlotsEditor } from "./SlotsEditor";

/**
 * One row of `game.definitions`, as a draft.
 *
 * `kind` is FREE TEXT and stays that way. The kinds are the game's own vocabulary —
 * spell, room, npc, form, term, whatever a game invents — discovered from the data and
 * never hard-coded; a fixed list here would be exactly the engine knowledge the schema is
 * arranged to avoid. `term` is not special-cased either.
 *
 * `form` is the one kind whose `data` this UI understands, and only its `slots` key. See
 * `slots.ts` for why that exception is a safety property rather than a convenience.
 */

/** Only two, unlike a game's three: a definition is offered or it is not. `retired` is
 *  deliberately not `deleted_at` — retiring a thing must stop it being offered without
 *  orphaning the artifacts that already contain it. */
export const DEFINITION_STATUSES: { value: GameDefinitionStatus; label: string }[] = [
  { value: "active", label: "Active — offered to players" },
  { value: "retired", label: "Retired — no longer offered, but still resolves where it is used" },
];

export function definitionBlank(): GameDefinitionInput {
  return {
    kind: "",
    key: "",
    name: "",
    description: "",
    status: "active", // the schema default
    sortOrder: 0, // the schema default
    data: "",
  };
}

export function definitionToInput(d: GameDefinition): GameDefinitionInput {
  return {
    kind: d.kind,
    key: d.key,
    name: d.name,
    description: d.description,
    status: d.status,
    sortOrder: d.sortOrder,
    data: d.data,
  };
}

export function definitionNormalize(d: GameDefinitionInput): GameDefinitionInput {
  return {
    ...d,
    kind: d.kind.trim(),
    key: d.key.trim(),
    name: d.name.trim(),
    description: d.description.trim(),
    data: d.data.trim(),
  };
}

export function definitionDiffers(a: GameDefinitionInput, b: GameDefinitionInput): boolean {
  return (
    a.kind !== b.kind ||
    a.key !== b.key ||
    a.name !== b.name ||
    a.description !== b.description ||
    a.status !== b.status ||
    a.sortOrder !== b.sortOrder ||
    a.data !== b.data
  );
}

/**
 * `others` = every definition except this one. The key check is PER KIND, mirroring the
 * schema's unique `(ecosystem_id, game_id, kind, key)`: two kinds may each have a `hall`,
 * and one kind may not have two.
 */
export function definitionValidate(
  draft: GameDefinitionInput,
  others: GameDefinition[],
): string | null {
  const kind = draft.kind.trim();
  if (!kind) return "Kind is required.";
  const key = draft.key.trim();
  if (!key) return "Key is required.";
  if (!draft.name.trim()) return "Name is required.";
  if (!Number.isInteger(draft.sortOrder)) return wholeNumberProblem("Sort order");
  if (others.some((d) => d.kind === kind && d.key === key)) {
    return `Key “${key}” is already used by another ${kind}.`;
  }
  const data = draft.data.trim();
  if (data) {
    try {
      JSON.parse(data);
    } catch {
      return "Data must be valid JSON.";
    }
  }
  if (kind === "form") {
    const read = readSlots(draft.data);
    // ONLY the §6.5 safety property gates a save — a slot whose `input` nobody has
    // answered, because that choice is what decides whether a player's typed string is
    // screened. A `slots` this editor cannot READ is not that: it is engine content in a
    // shape adh never promised to understand, and blocking on it would mean a seeded form
    // whose slots are a map instead of a list cannot have a typo in its NAME fixed. The
    // typed editor stays hidden and says why (`DefinitionFields`); everything else saves.
    if (read.ok) return validateSlots(read.doc.slots);
  }
  return null;
}

/** The rail row's label. */
export function definitionLabel(d: GameDefinition): string {
  return d.name;
}

export function DefinitionFields({
  draft,
  onChange,
  error,
}: {
  draft: GameDefinitionInput;
  onChange: (next: GameDefinitionInput) => void;
  error?: string | null;
}) {
  const uid = useId();
  const isForm = draft.kind.trim() === "form";
  const read = isForm ? readSlots(draft.data) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-kind`}>Kind</Label>
          <Input
            id={`${uid}-kind`}
            placeholder="room"
            value={draft.kind}
            onChange={(e) => onChange({ ...draft, kind: e.target.value })}
          />
          <p className="text-xs text-apt-text-muted">
            Your own vocabulary &mdash; room, spell, item, npc, form, term. Definitions sharing
            a kind are listed together, and adh never branches on it.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-key`}>Key</Label>
          <Input
            id={`${uid}-key`}
            placeholder="great-hall"
            value={draft.key}
            onChange={(e) => onChange({ ...draft, key: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            The stable handle your engine refers to. Unique within this kind &mdash; a{" "}
            <code>room</code> and a <code>spell</code> may share one.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-name`}>Name</Label>
          <Input
            id={`${uid}-name`}
            placeholder="The Great Hall"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-description`}>Description</Label>
          <Textarea
            id={`${uid}-description`}
            rows={3}
            placeholder="What this is, in a sentence."
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-status`}>Status</Label>
          <Select
            id={`${uid}-status`}
            value={draft.status}
            onChange={(e) =>
              onChange({ ...draft, status: e.target.value as GameDefinitionStatus })
            }
          >
            {DEFINITION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-sort-order`}>Sort order</Label>
          <IntegerInput
            id={`${uid}-sort-order`}
            value={draft.sortOrder}
            fallback={0}
            onChange={(sortOrder) => onChange({ ...draft, sortOrder })}
          />
          <p className="text-xs text-apt-text-muted">
            The order definitions of one kind are listed in, lowest first.
          </p>
        </div>

        {isForm &&
          (read?.ok ? (
            <SlotsEditor
              slots={read.doc.slots}
              onChange={(slots) => onChange({ ...draft, data: writeSlots(draft.data, slots) })}
            />
          ) : (
            // Never silently discard what the operator typed: the raw editor below still
            // holds it, and this says exactly why the typed view is missing.
            <p className="text-xs text-apt-text-muted">{read?.reason}</p>
          ))}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-data`}>Data</Label>
          <Textarea
            id={`${uid}-data`}
            rows={10}
            placeholder="{}"
            value={draft.data}
            onChange={(e) => onChange({ ...draft, data: e.target.value })}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            JSON handed to the engine as-is &mdash; adh never reads it. Leave it empty when
            this definition needs none.
            {isForm ? " A form's slots live here, under “slots”." : ""}
          </p>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
