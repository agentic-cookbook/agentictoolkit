import { describe, expect, it } from "vitest";
import {
  effectBlank,
  effectDiffers,
  effectLabel,
  effectNormalize,
  effectToInput,
  effectValidate,
} from "../EffectDetail";
import { optionalWholeNumberProblem, wholeNumberProblem } from "../fields";
import type { GameEffect } from "@agentic-toolkit/data/games";

function row(over: Partial<GameEffect> = {}): GameEffect {
  return {
    id: "eff-1",
    gameId: "game-1",
    definitionId: "def-1",
    key: "chill",
    trigger: "on_enter",
    target: "hp",
    operation: "add",
    value: -1,
    duration: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("the effect draft helpers", () => {
  // Neither closed set has a schema default, so neither gets one here: the operator picks.
  it("blanks the two closed sets to nothing chosen, and duration to null", () => {
    expect(effectBlank()).toEqual({
      definitionId: "",
      key: "",
      trigger: "",
      target: "",
      operation: "",
      value: 0,
      duration: null,
      sortOrder: 0,
    });
  });

  it("blanks pointed at a parent when opened from inside one", () => {
    expect(effectBlank("def-9").definitionId).toBe("def-9");
  });

  it("carries every writable column", () => {
    expect(effectToInput(row())).toEqual({
      definitionId: "def-1",
      key: "chill",
      trigger: "on_enter",
      target: "hp",
      operation: "add",
      value: -1,
      duration: null,
      sortOrder: 0,
    });
  });

  it("requires a definition, a key, a trigger, an operation and a target", () => {
    const d = effectToInput(row());
    expect(effectValidate({ ...d, definitionId: " " }, [])).toBe("Definition is required.");
    expect(effectValidate({ ...d, key: " " }, [])).toBe("Key is required.");
    expect(effectValidate({ ...d, trigger: "" }, [])).toBe("Choose when this effect fires.");
    expect(effectValidate({ ...d, operation: "" }, [])).toBe(
      "Choose what this effect does to its target.",
    );
    expect(effectValidate({ ...d, target: " " }, [])).toBe("Target is required.");
  });

  // `(game_id, definition_id, key)` — a key is unique WITHIN its definition, not globally.
  it("rejects a key already used on the same definition, and allows it on another", () => {
    expect(effectValidate(effectToInput(row()), [row({ id: "eff-2" })])).toBe(
      "Key “chill” is already used by another effect on this definition.",
    );
    expect(
      effectValidate(effectToInput(row()), [row({ id: "eff-2", definitionId: "def-2" })]),
    ).toBeNull();
  });

  // Null is the meaningful absence — "for as long as it is held". 0 would mean it expires
  // immediately, so an empty field must never become one.
  it("accepts a null duration, and a typed 0 as a different thing", () => {
    expect(effectValidate({ ...effectToInput(row()), duration: null }, [])).toBeNull();
    expect(effectValidate({ ...effectToInput(row()), duration: 0 }, [])).toBeNull();
    expect(effectValidate({ ...effectToInput(row()), duration: 1.5 }, [])).toBe(
      optionalWholeNumberProblem("Duration"),
    );
  });

  it("requires a whole-number value", () => {
    expect(effectValidate({ ...effectToInput(row()), value: 0.5 }, [])).toBe(
      wholeNumberProblem("Value"),
    );
  });

  // A box holding a half-typed `-` parses to NaN rather than to a made-up 0 (see
  // `fields.ts`), so every integer column needs a check or the NaN reaches the wire as the
  // `null` JSON.stringify turns it into. A negative value is the ordinary case here: the
  // schema's own canonical effect is `hp / add / -30`.
  it("refuses an unfinished number in any of the three integer fields, and keeps a negative", () => {
    const d = effectToInput(row());
    expect(effectValidate({ ...d, value: NaN }, [])).toBe(wholeNumberProblem("Value"));
    expect(effectValidate({ ...d, duration: NaN }, [])).toBe(
      optionalWholeNumberProblem("Duration"),
    );
    expect(effectValidate({ ...d, sortOrder: NaN }, [])).toBe(
      wholeNumberProblem("Sort order"),
    );
    expect(effectValidate({ ...d, value: -30 }, [])).toBeNull();
  });

  it("trims the free-text fields and sees a difference in any field", () => {
    expect(effectNormalize({ ...effectToInput(row()), target: " hp " }).target).toBe("hp");
    const a = effectToInput(row());
    expect(effectDiffers(a, a)).toBe(false);
    expect(effectDiffers(a, { ...a, duration: 3 })).toBe(true);
    expect(effectDiffers(a, { ...a, sortOrder: 2 })).toBe(true);
    expect(effectDiffers(a, { ...a, operation: "multiply" })).toBe(true);
  });

  // There is no `name` column: the key IS the handle, and the list has to say so.
  it("labels a row by its key", () => {
    expect(effectLabel(row())).toBe("chill");
  });
});
