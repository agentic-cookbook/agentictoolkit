"use client";

import { useId } from "react";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import type {
  GameEffect,
  GameEffectInput,
  GameEffectOperation,
  GameEffectTrigger,
} from "@agentic-toolkit/data/games";
import { optionalWholeNumberProblem, wholeNumberProblem } from "./fields";
import { IntegerInput, OptionalIntegerInput } from "./IntegerInput";

/**
 * One row of `game.effects`, as a draft — shared by the top-level Effects topic (the
 * balancing view: every effect in the game, grouped by trigger) and by the inline list
 * inside a definition's detail. Both write the SAME row, so they share these helpers
 * rather than each growing their own copy of the rules.
 *
 * adh never evaluates an effect; the engine does. What this file knows is the shape of
 * the row and which of its columns are closed sets.
 */

/** `trigger` has a `check` behind it — five values, no others, no free text. */
export const EFFECT_TRIGGERS: { value: GameEffectTrigger; label: string }[] = [
  { value: "on_use", label: "On use" },
  { value: "on_equip", label: "On equip" },
  { value: "on_hold", label: "On hold" },
  { value: "on_enter", label: "On enter" },
  { value: "on_acquire", label: "On acquire" },
];

/** `operation` has a `check` behind it too. */
export const EFFECT_OPERATIONS: { value: GameEffectOperation; label: string }[] = [
  { value: "add", label: "Add" },
  { value: "multiply", label: "Multiply" },
  { value: "set", label: "Set" },
];

export function effectBlank(definitionId = ""): GameEffectInput {
  return {
    definitionId,
    key: "",
    // No default for either closed set: the schema gives neither one, so the operator
    // picks and the form is invalid until they do.
    trigger: "",
    target: "",
    operation: "",
    value: 0,
    // Not 0. Null is the meaningful absence — "for as long as it is held".
    duration: null,
    sortOrder: 0,
  };
}

export function effectToInput(e: GameEffect): GameEffectInput {
  return {
    definitionId: e.definitionId,
    key: e.key,
    trigger: e.trigger,
    target: e.target,
    operation: e.operation,
    value: e.value,
    duration: e.duration,
    sortOrder: e.sortOrder,
  };
}

export function effectNormalize(d: GameEffectInput): GameEffectInput {
  return {
    ...d,
    definitionId: d.definitionId.trim(),
    key: d.key.trim(),
    target: d.target.trim(),
  };
}

export function effectDiffers(a: GameEffectInput, b: GameEffectInput): boolean {
  return (
    a.definitionId !== b.definitionId ||
    a.key !== b.key ||
    a.trigger !== b.trigger ||
    a.target !== b.target ||
    a.operation !== b.operation ||
    a.value !== b.value ||
    a.duration !== b.duration ||
    a.sortOrder !== b.sortOrder
  );
}

/** `others` = every effect except this one, so the key check matches the schema's unique:
 *  `(game_id, definition_id, key)` — a key is unique WITHIN its definition, not globally. */
export function effectValidate(draft: GameEffectInput, others: GameEffect[]): string | null {
  const definitionId = draft.definitionId.trim();
  if (!definitionId) return "Definition is required.";
  const key = draft.key.trim();
  if (!key) return "Key is required.";
  if (!draft.trigger) return "Choose when this effect fires.";
  if (!draft.operation) return "Choose what this effect does to its target.";
  if (!draft.target.trim()) return "Target is required.";
  // These three are what stops an unfinished, unreadable or unstorable number reaching the
  // wire: a box holding `-`, `1.9` or twenty digits parses to `NaN` rather than to a
  // made-up value (see `fields.ts`), and `Number.isInteger` is where that lands. Every
  // integer column needs one, or the NaN it misses is `JSON.stringify`d as `null` against
  // a NOT NULL column.
  if (!Number.isInteger(draft.value)) return wholeNumberProblem("Value");
  if (draft.duration !== null && !Number.isInteger(draft.duration)) {
    return optionalWholeNumberProblem("Duration");
  }
  if (!Number.isInteger(draft.sortOrder)) return wholeNumberProblem("Sort order");
  if (others.some((e) => e.definitionId === definitionId && e.key === key)) {
    return `Key “${key}” is already used by another effect on this definition.`;
  }
  return null;
}

/** The rail row's label. There is no `name` column — the key IS the handle. */
export function effectLabel(e: GameEffect): string {
  return e.key;
}

export function EffectFields({
  draft,
  onChange,
  error,
  /** True inside a definition's inline list, where the parent is the pane you are in and
   *  editing it would move the effect to another definition behind your back. */
  definitionLocked = false,
}: {
  draft: GameEffectInput;
  onChange: (next: GameEffectInput) => void;
  error?: string | null;
  definitionLocked?: boolean;
}) {
  const uid = useId();
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        {!definitionLocked && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-definition`}>Definition</Label>
            <Input
              id={`${uid}-definition`}
              placeholder="Definition id"
              value={draft.definitionId}
              onChange={(e) => onChange({ ...draft, definitionId: e.target.value })}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-xs text-apt-text-muted">
              The definition this effect belongs to, by its id.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-key`}>Key</Label>
          <Input
            id={`${uid}-key`}
            placeholder="chill"
            value={draft.key}
            onChange={(e) => onChange({ ...draft, key: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            This effect&rsquo;s stable handle within its definition. Re-running a seed matches
            on it, so changing it mints a second effect rather than editing this one.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-trigger`}>Trigger</Label>
          <Select
            id={`${uid}-trigger`}
            value={draft.trigger}
            onChange={(e) =>
              onChange({ ...draft, trigger: e.target.value as GameEffectTrigger | "" })
            }
          >
            <option value="">Choose when this fires…</option>
            {EFFECT_TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-apt-text-muted">
            Effects sharing a trigger are listed together.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-target`}>Target</Label>
          <Input
            id={`${uid}-target`}
            placeholder="hp"
            value={draft.target}
            onChange={(e) => onChange({ ...draft, target: e.target.value })}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            A stat or key-value key from your game. It is your vocabulary, so nothing here can
            check that it exists &mdash; a typo mints a new one silently.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-operation`}>Operation</Label>
          <Select
            id={`${uid}-operation`}
            value={draft.operation}
            onChange={(e) =>
              onChange({ ...draft, operation: e.target.value as GameEffectOperation | "" })
            }
          >
            <option value="">Choose what it does…</option>
            {EFFECT_OPERATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-value`}>Value</Label>
          <IntegerInput
            id={`${uid}-value`}
            value={draft.value}
            fallback={0}
            onChange={(value) => onChange({ ...draft, value })}
          />
          <p className="text-xs text-apt-text-muted">
            Whole numbers, and <strong>negative ones are the point</strong> &mdash; damage is{" "}
            <code>hp</code>, <code>add</code>, <code>-30</code>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${uid}-duration`}>Duration</Label>
          <OptionalIntegerInput
            id={`${uid}-duration`}
            placeholder="While held"
            value={draft.duration}
            onChange={(duration) => onChange({ ...draft, duration })}
          />
          <p className="text-xs text-apt-text-muted">
            Turns or seconds. <strong>Leave it empty for &ldquo;for as long as it is
            held&rdquo;</strong> &mdash; that is what an empty duration means, not &ldquo;no
            duration&rdquo;. A 0 here would mean it expires immediately.
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
            The order effects apply in, lowest first &mdash; and it changes the outcome:{" "}
            <em>add then multiply</em> is not <em>multiply then add</em>.
          </p>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
