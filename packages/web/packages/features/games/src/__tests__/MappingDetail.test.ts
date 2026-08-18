import { describe, expect, it } from "vitest";
import {
  mappingBlank,
  mappingDiffers,
  mappingLabel,
  mappingNormalize,
  mappingToInput,
  mappingValidate,
} from "../MappingDetail";
import { wholeNumberProblem } from "../fields";
import type { GameMapping } from "@agentic-toolkit/data/games";

function row(over: Partial<GameMapping> = {}): GameMapping {
  return {
    id: "map-1",
    gameId: "game-1",
    kind: "exit",
    fromId: "def-1",
    toId: "def-2",
    amount: 1,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("the connection draft helpers", () => {
  // `amount` defaults to 1 and `sort_order` to 0 in `game.mappings` — an edge is one of a
  // thing unless the author says otherwise.
  it("blanks to the schema's own defaults", () => {
    expect(mappingBlank()).toEqual({ kind: "", fromId: "", toId: "", amount: 1, sortOrder: 0 });
  });

  it("blanks pointed at its origin when opened from inside one", () => {
    expect(mappingBlank("def-9").fromId).toBe("def-9");
  });

  // There is no `label` column: the ends name the edge.
  it("carries every writable column and labels a row by its two ends", () => {
    expect(mappingToInput(row())).toEqual({
      kind: "exit",
      fromId: "def-1",
      toId: "def-2",
      amount: 1,
      sortOrder: 0,
    });
    expect(mappingLabel(row())).toBe("def-1 → def-2");
  });

  it("requires a kind and two different ends", () => {
    const d = mappingToInput(row());
    expect(mappingValidate({ ...d, kind: " " }, [])).toBe("Kind is required.");
    expect(mappingValidate({ ...d, fromId: " " }, [])).toBe("From is required.");
    expect(mappingValidate({ ...d, toId: " " }, [])).toBe("To is required.");
    expect(mappingValidate({ ...d, toId: "def-1" }, [])).toBe(
      "A connection needs two different ends.",
    );
  });

  // `(game_id, from_id, kind, to_id)` — the same pair MAY be joined twice under two kinds.
  it("rejects a duplicate edge, and allows the same pair under another kind", () => {
    expect(mappingValidate(mappingToInput(row()), [row({ id: "map-2" })])).toBe(
      "That connection already exists.",
    );
    expect(
      mappingValidate(mappingToInput(row()), [row({ id: "map-2", kind: "sees" })]),
    ).toBeNull();
  });

  it("requires a whole-number amount", () => {
    expect(mappingValidate({ ...mappingToInput(row()), amount: 1.5 }, [])).toBe(
      wholeNumberProblem("Amount"),
    );
  });

  // An unfinished number parses to NaN rather than to a made-up value (see `fields.ts`);
  // both integer columns need the check, or that NaN reaches the wire as `null`.
  it("refuses an unfinished number in either integer field", () => {
    const d = mappingToInput(row());
    expect(mappingValidate({ ...d, amount: NaN }, [])).toBe(wholeNumberProblem("Amount"));
    expect(mappingValidate({ ...d, sortOrder: NaN }, [])).toBe(
      wholeNumberProblem("Sort order"),
    );
  });

  it("trims the ends and sees a difference in any field", () => {
    expect(mappingNormalize({ ...mappingToInput(row()), toId: " def-2 " }).toId).toBe("def-2");
    const a = mappingToInput(row());
    expect(mappingDiffers(a, a)).toBe(false);
    expect(mappingDiffers(a, { ...a, amount: 3 })).toBe(true);
    expect(mappingDiffers(a, { ...a, sortOrder: 1 })).toBe(true);
  });
});
