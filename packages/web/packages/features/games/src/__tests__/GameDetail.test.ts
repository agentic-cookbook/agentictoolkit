import { describe, expect, it } from "vitest";
import { gameBlank, gameToInput, gameValidate, gameDiffers, gameNormalize } from "../GameDetail";
import { wholeNumberProblem } from "../fields";
import type { Game } from "@agentic-toolkit/data/games";

const row: Game = {
  id: "game.acme.cavern",
  name: "Cavern",
  slug: "cavern",
  description: "A dark place.",
  engine: "ink",
  engineConfig: '{"start":"hall"}',
  characterNames: "optional",
  status: "hidden",
  // Both off their schema defaults on purpose: a row's own values have to survive the
  // trip through toInput, and a default-valued fixture cannot tell that apart from a
  // helper that quietly substitutes the default.
  eventLog: "authoritative",
  eventRetentionDays: 30,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("the game draft helpers", () => {
  // The closed sets blank to their SCHEMA defaults, not to empty: `game.games` defaults
  // `character_names` to 'off', `status` to 'active' and `event_log` to 'debug', and a
  // create that sent "" would be rejected by their checks. The retention window is the
  // same rule one type along — 90 is the column's default, and 0 is not a legal value.
  it("blanks every field, closed sets at their schema defaults", () => {
    expect(gameBlank()).toEqual({
      slug: "",
      name: "",
      description: "",
      engine: "",
      engineConfig: "",
      characterNames: "off",
      status: "active",
      eventLog: "debug",
      eventRetentionDays: 90,
    });
  });

  // Both panes edit the SAME row, so toInput must carry the WHOLE input — an Engine save
  // that dropped `name` would blank it.
  it("carries every editable field out of a row, not just one pane's half", () => {
    expect(gameToInput(row)).toEqual({
      slug: "cavern",
      name: "Cavern",
      description: "A dark place.",
      engine: "ink",
      engineConfig: '{"start":"hall"}',
      characterNames: "optional",
      status: "hidden",
      eventLog: "authoritative",
      eventRetentionDays: 30,
    });
  });

  // The round trip the two selects depend on: a non-default choice survives blank → edit →
  // toInput → normalize without being reset or trimmed into nonsense.
  it("round-trips status and characterNames through blank, toInput and normalize", () => {
    const edited = { ...gameBlank(), name: "C", slug: "c", status: "retired" as const, characterNames: "required" as const };
    expect(gameNormalize(edited).status).toBe("retired");
    expect(gameNormalize(edited).characterNames).toBe("required");
    expect(gameToInput(row).status).toBe("hidden");
    expect(gameNormalize(gameToInput(row))).toEqual(gameToInput(row));
  });

  it("requires a name and a slug", () => {
    expect(gameValidate({ ...gameToInput(row), name: "  " }, [])).toBe("Name is required.");
    expect(gameValidate({ ...gameToInput(row), slug: "" }, [])).toBe("Slug is required.");
  });

  it("rejects a slug that is not one lowercase rdid segment", () => {
    expect(gameValidate({ ...gameToInput(row), slug: "Cavern_1" }, [])).toBe(
      "Lowercase letters, digits, and interior hyphens only (no underscores).",
    );
  });

  it("rejects the two reserved URL segments as slugs", () => {
    expect(gameValidate({ ...gameToInput(row), slug: "new" }, [])).toBe(
      '"new" is reserved — pick another slug.',
    );
    expect(gameValidate({ ...gameToInput(row), slug: "all" }, [])).toBe(
      '"all" is reserved — pick another slug.',
    );
  });

  it("rejects a slug already taken", () => {
    expect(gameValidate(gameToInput(row), ["cavern"])).toBe('Slug "cavern" is already in use.');
  });

  it("rejects engine config that is not JSON", () => {
    expect(gameValidate({ ...gameToInput(row), engineConfig: "{" }, [])).toBe(
      "Engine config must be valid JSON.",
    );
  });

  it("accepts empty engine config", () => {
    expect(gameValidate({ ...gameToInput(row), engineConfig: "   " }, [])).toBeNull();
  });

  // `IntegerInput` hands unfinished or out-of-range text over as NaN rather than inventing
  // a number, so validation is where that stops being savable.
  it("rejects a retention window that is not a storable whole number", () => {
    expect(gameValidate({ ...gameToInput(row), eventRetentionDays: NaN }, [])).toBe(
      wholeNumberProblem("Event retention"),
    );
    expect(gameValidate({ ...gameToInput(row), eventRetentionDays: 1.5 }, [])).toBe(
      wholeNumberProblem("Event retention"),
    );
  });

  // `games_event_retention_days_chk` is `> 0` and applies whatever `event_log` says, so
  // zero is refused on BOTH branches — `authoritative` stops the sweep reading the window,
  // it does not make the column accept the value.
  it("rejects a retention window below one day, on either log mode", () => {
    const atLeastOne = "Event retention must be at least one day.";
    expect(gameValidate({ ...gameToInput(row), eventRetentionDays: 0 }, [])).toBe(atLeastOne);
    expect(
      gameValidate({ ...gameToInput(row), eventLog: "debug", eventRetentionDays: -1 }, []),
    ).toBe(atLeastOne);
  });

  it("accepts a valid draft", () => {
    expect(gameValidate(gameToInput(row), [])).toBeNull();
  });

  it("sees a difference in any field", () => {
    const a = gameToInput(row);
    expect(gameDiffers(a, a)).toBe(false);
    expect(gameDiffers(a, { ...a, engine: "twine" })).toBe(true);
    expect(gameDiffers(a, { ...a, description: "" })).toBe(true);
    // Every switch is editable, so every one has to count as a change or Save stays grey.
    expect(gameDiffers(a, { ...a, status: "active" })).toBe(true);
    expect(gameDiffers(a, { ...a, characterNames: "off" })).toBe(true);
    expect(gameDiffers(a, { ...a, eventLog: "debug" })).toBe(true);
    expect(gameDiffers(a, { ...a, eventRetentionDays: 90 })).toBe(true);
  });

  // Without this a trailing space leaves the form permanently dirty: the save persists
  // the trimmed value, the re-hydrated baseline is trimmed, and the draft is not.
  it("trims every text field and leaves the closed sets alone", () => {
    expect(
      gameNormalize({
        slug: " c ",
        name: " C ",
        description: " s ",
        engine: " e ",
        engineConfig: " {} ",
        characterNames: "required",
        status: "retired",
        eventLog: "authoritative",
        eventRetentionDays: 30,
      }),
    ).toEqual({
      slug: "c",
      name: "C",
      description: "s",
      engine: "e",
      engineConfig: "{}",
      characterNames: "required",
      status: "retired",
      eventLog: "authoritative",
      eventRetentionDays: 30,
    });
  });
});
