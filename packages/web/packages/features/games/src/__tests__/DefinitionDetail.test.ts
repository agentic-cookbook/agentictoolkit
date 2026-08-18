import { describe, expect, it } from "vitest";
import {
  definitionBlank,
  definitionDiffers,
  definitionNormalize,
  definitionToInput,
  definitionValidate,
} from "../DefinitionDetail";
import { wholeNumberProblem } from "../fields";
import type { GameDefinition } from "@agentic-toolkit/data/games";

function row(over: Partial<GameDefinition> = {}): GameDefinition {
  return {
    id: "def-1",
    gameId: "game-1",
    authorCustomerId: null,
    kind: "room",
    key: "hall",
    name: "The Great Hall",
    description: "Cold.",
    status: "active",
    sortOrder: 0,
    data: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("the definition draft helpers", () => {
  it("blanks to the schema's own defaults", () => {
    expect(definitionBlank()).toEqual({
      kind: "",
      key: "",
      name: "",
      description: "",
      status: "active",
      sortOrder: 0,
      data: "",
    });
  });

  // `author_customer_id` is on the ROW and never in the input: it records who wrote the
  // definition, and an operator form must not be able to reassign it.
  it("carries the writable columns only — never the author", () => {
    expect(definitionToInput(row())).toEqual({
      kind: "room",
      key: "hall",
      name: "The Great Hall",
      description: "Cold.",
      status: "active",
      sortOrder: 0,
      data: "",
    });
  });

  it("requires kind, key and name", () => {
    expect(definitionValidate({ ...definitionToInput(row()), kind: " " }, [])).toBe(
      "Kind is required.",
    );
    expect(definitionValidate({ ...definitionToInput(row()), key: " " }, [])).toBe(
      "Key is required.",
    );
    expect(definitionValidate({ ...definitionToInput(row()), name: " " }, [])).toBe(
      "Name is required.",
    );
  });

  // The schema's unique is (ecosystem, game, KIND, key): two kinds may each have a `hall`.
  it("rejects a key already used within the SAME kind", () => {
    expect(definitionValidate(definitionToInput(row()), [row({ id: "def-2" })])).toBe(
      "Key “hall” is already used by another room.",
    );
  });

  it("allows the same key under a different kind", () => {
    expect(
      definitionValidate(definitionToInput(row()), [row({ id: "def-2", kind: "spell" })]),
    ).toBeNull();
  });

  it("rejects data that is not JSON", () => {
    expect(definitionValidate({ ...definitionToInput(row()), data: "{" }, [])).toBe(
      "Data must be valid JSON.",
    );
  });

  // A form's slots are the one part of `data` this UI understands, so they are the one part
  // it can hold a save back over.
  it("fails a form whose slot has no input mode chosen", () => {
    const draft = definitionToInput(
      row({ kind: "form", data: '{"slots":[{"key":"name","label":"Name"}]}' }),
    );
    expect(definitionValidate(draft, [])).toBe(
      "Choose free text or curated for the “name” slot — there is no default.",
    );
  });

  it("accepts a form whose slots are all answered", () => {
    const draft = definitionToInput(
      row({ kind: "form", data: '{"slots":[{"key":"name","label":"Name","input":"free-text"}]}' }),
    );
    expect(definitionValidate(draft, [])).toBeNull();
  });

  // Slots are checked ONLY for `kind = 'form'`: every other kind's `data` is opaque, and
  // a `slots` key in it means whatever that game's engine says it means.
  it("ignores a slots-shaped data on any other kind", () => {
    const draft = definitionToInput(row({ data: '{"slots":[{"key":"name"}]}' }));
    expect(definitionValidate(draft, [])).toBeNull();
  });

  // The gate is the §6.5 safety property — an unanswered slot — and nothing wider. A form
  // whose `slots` this editor cannot READ is engine content in a shape adh never promised
  // to understand; blocking on it would mean a seeded form with a map of slots could not
  // have the typo in its NAME fixed. The typed editor hides itself and says why instead.
  it("saves a form whose slots are in a shape it cannot read", () => {
    const shapes = [
      '{"slots":{"creature":{"input":"curated"}}}',
      '{"slots":[1,2]}',
      '{"slots":[{"label":"no key"}]}',
      '["not an object at all"]',
    ];
    for (const data of shapes) {
      expect(definitionValidate(definitionToInput(row({ kind: "form", data })), [])).toBeNull();
    }
  });

  // An unfinished number in the sort-order box parses to NaN rather than to a made-up 0
  // (see `fields.ts`), and this is what stops it reaching a NOT NULL integer column as the
  // `null` that `JSON.stringify` turns NaN into.
  it("refuses a sort order that is not a whole number", () => {
    expect(definitionValidate({ ...definitionToInput(row()), sortOrder: NaN }, [])).toBe(
      wholeNumberProblem("Sort order"),
    );
  });

  it("trims the text fields and sees a difference in any field", () => {
    expect(definitionNormalize({ ...definitionToInput(row()), kind: " room " }).kind).toBe("room");
    const a = definitionToInput(row());
    expect(definitionDiffers(a, a)).toBe(false);
    expect(definitionDiffers(a, { ...a, sortOrder: 1 })).toBe(true);
    expect(definitionDiffers(a, { ...a, status: "retired" })).toBe(true);
    expect(definitionDiffers(a, { ...a, data: "{}" })).toBe(true);
  });
});
