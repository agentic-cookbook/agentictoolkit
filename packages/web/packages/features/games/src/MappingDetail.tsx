"use client";

import { useId } from "react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { GameMapping, GameMappingInput } from "@agentic-toolkit/data/games";
import { wholeNumberProblem } from "./fields";
import { IntegerInput } from "./IntegerInput";

/**
 * One row of `game.mappings`, as a draft — shared by the top-level Connections topic (the
 * cross-cutting map: every edge in the game, grouped by kind) and by the inline list inside
 * a definition's detail, which shows the edges leading OUT of that definition. A single edge
 * is editable from either place, and both write the same row.
 *
 * The two ends stay plain text over opaque definition ids. A picker would need the
 * definitions list loaded wherever this is rendered, and neither the spec nor the schema doc
 * asks for one; the hint says what the field holds instead of pretending it is validated.
 */

export function mappingBlank(fromId = ""): GameMappingInput {
  return {
    kind: "",
    fromId,
    toId: "",
    // The schema defaults, not UI taste: `amount` defaults to 1, `sort_order` to 0.
    amount: 1,
    sortOrder: 0,
  };
}

export function mappingToInput(m: GameMapping): GameMappingInput {
  return {
    kind: m.kind,
    fromId: m.fromId,
    toId: m.toId,
    amount: m.amount,
    sortOrder: m.sortOrder,
  };
}

export function mappingNormalize(d: GameMappingInput): GameMappingInput {
  return {
    ...d,
    kind: d.kind.trim(),
    fromId: d.fromId.trim(),
    toId: d.toId.trim(),
  };
}

export function mappingDiffers(a: GameMappingInput, b: GameMappingInput): boolean {
  return (
    a.kind !== b.kind ||
    a.fromId !== b.fromId ||
    a.toId !== b.toId ||
    a.amount !== b.amount ||
    a.sortOrder !== b.sortOrder
  );
}

/** `others` = every edge except this one. The duplicate check mirrors the schema's unique,
 *  `(game_id, from_id, kind, to_id)`. */
export function mappingValidate(draft: GameMappingInput, others: GameMapping[]): string | null {
  const kind = draft.kind.trim();
  const fromId = draft.fromId.trim();
  const toId = draft.toId.trim();
  if (!kind) return "Kind is required.";
  if (!fromId) return "From is required.";
  if (!toId) return "To is required.";
  if (fromId === toId) return "A connection needs two different ends.";
  // Both integer columns, because an unfinished number parses to `NaN` rather than to a
  // made-up value (see `fields.ts`) and this is where that is caught.
  if (!Number.isInteger(draft.amount)) return wholeNumberProblem("Amount");
  if (!Number.isInteger(draft.sortOrder)) return wholeNumberProblem("Sort order");
  if (others.some((m) => m.fromId === fromId && m.kind === kind && m.toId === toId)) {
    return "That connection already exists.";
  }
  return null;
}

/** The rail row's label. There is no `label` column — an edge is named by its two ends. */
export function mappingLabel(m: GameMapping): string {
  return `${m.fromId} → ${m.toId}`;
}

export function MappingFields({
  draft,
  onChange,
  error,
  /** True inside a definition's inline list: the edge's origin IS the definition you have
   *  open, and editing it there would silently move the edge onto another definition. */
  fromLocked = false,
}: {
  draft: GameMappingInput;
  onChange: (next: GameMappingInput) => void;
  error?: string | null;
  fromLocked?: boolean;
}) {
  const uid = useId();
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-kind`}>Kind</Label>
          <Input
            id={`${uid}-kind`}
            placeholder="exit"
            value={draft.kind}
            onChange={(e) => onChange({ ...draft, kind: e.target.value })}
          />
          <p className="text-xs text-apt-text-muted">
            What this connection is &mdash; exit, recipe input, drops, requires. Your own
            vocabulary; connections sharing a kind are listed together.
          </p>
        </div>
        {!fromLocked && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-from`}>From</Label>
            <Input
              id={`${uid}-from`}
              placeholder="Definition id"
              value={draft.fromId}
              onChange={(e) => onChange({ ...draft, fromId: e.target.value })}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-to`}>To</Label>
          <Input
            id={`${uid}-to`}
            placeholder="Definition id"
            value={draft.toId}
            onChange={(e) => onChange({ ...draft, toId: e.target.value })}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            Both ends are definition <strong>ids</strong>, copied from the Content topic
            &mdash; not names, and nothing here can look one up for you yet.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-amount`}>Amount</Label>
          <IntegerInput
            id={`${uid}-amount`}
            value={draft.amount}
            fallback={1}
            onChange={(amount) => onChange({ ...draft, amount })}
          />
          <p className="text-xs text-apt-text-muted">
            How many. A recipe needs three iron, not one.
          </p>
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
            The order connections of one kind are listed in, lowest first.
          </p>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
