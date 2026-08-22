import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  gamesApi,
  gameDefinitionsApi,
  gameEffectsApi,
  gameMappingsApi,
  gameFromWire,
  gameToWire,
  definitionFromWire,
  definitionToWire,
  type GameInput,
  type GameDefinitionInput,
  type GameEffectInput,
  type GameMappingInput,
} from "../games";

// A plausible `game.games` wire row — the default answer to every request here, so the
// client's own unwrap runs for real instead of being skipped by a rejected promise.
const gameRow = {
  id: "8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34",
  slug: "cavern",
  name: "Cavern",
  description: "Cold." as string | null,
  engine: "zmachine-v3",
  engineConfig: {} as unknown,
  characterNames: "off" as const,
  status: "active" as const,
  eventLog: "debug" as const,
  eventRetentionDays: 90,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const definitionRow = {
  id: "def-1",
  gameId: "8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34",
  authorCustomerId: "",
  kind: "room",
  key: "hall",
  name: "Hall",
  description: "Cold." as string | null,
  status: "active" as const,
  sortOrder: 0,
  data: null as unknown,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const gameInput: GameInput = {
  slug: "cavern",
  name: "Cavern",
  description: "Cold.",
  engine: "zmachine-v3",
  engineConfig: "",
  characterNames: "off",
  status: "active",
  eventLog: "debug",
  eventRetentionDays: 90,
};

const definitionInput: GameDefinitionInput = {
  kind: "room",
  key: "hall",
  name: "Hall",
  description: "Cold.",
  status: "active",
  sortOrder: 0,
  data: "",
};

const effectInput: GameEffectInput = {
  definitionId: "def-1",
  key: "chill",
  trigger: "on_enter",
  target: "hp",
  operation: "add",
  value: -1,
  duration: null,
  sortOrder: 0,
};

const mappingInput: GameMappingInput = {
  kind: "exit",
  fromId: "def-1",
  toId: "def-2",
  amount: 1,
  sortOrder: 0,
};

// ── THE ROUTE GRAMMAR ────────────────────────────────────────────────────────────────
//
// Two spellings of "which parent" reach these routes, and they are NOT interchangeable.
// Generic CRUD reads query params on LIST and reads nothing but the BODY on CREATE, so a
// create that named its parent in the query string writes a row with no `ecosystem_id` /
// `game_id`: a misfiled game, or a NOT NULL violation that reads as a backend fault. The
// two spellings are one line apart in the client and identical to a reader.
describe("where each request names its parent", () => {
  const fetchMock = vi.fn();

  /** Re-point the shared stub at one specific JSON body. */
  const respondWith = (body: unknown) =>
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });

  beforeEach(() => {
    fetchMock.mockReset();
    respondWith(gameRow);
    vi.stubGlobal("fetch", fetchMock);
  });

  const urlOf = () => String(fetchMock.mock.calls[0]![0]);
  const bodyOf = () =>
    JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body)) as Record<
      string,
      unknown
    >;

  it("filters the catalog by ecosystem in the QUERY", async () => {
    respondWith([]);
    await gamesApi.list("ecosystem.acme");
    expect(urlOf()).toBe("/api/game/games?ecosystemId=ecosystem.acme");
  });

  it("asks for the whole catalog when no ecosystem is named", async () => {
    respondWith([]);
    await gamesApi.list();
    expect(urlOf()).toBe("/api/game/games");
  });

  // `uq_games_ecosystem` (partial on `deleted_at IS NULL`) makes at most one row possible, so
  // taking the first is not a guess — it is the whole answer. The two tests below pin both
  // halves of that: a hit unwraps to the row, a miss is `null` rather than a throw, because a
  // product in `none` or `gamification` mode legitimately has no game and every pane renders
  // an empty state off exactly this.
  it("resolves the one game of an ecosystem", async () => {
    respondWith([{ ...gameRow, id: "8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34" }]);
    const found = await gamesApi.forEcosystem("ecosystem.acme");
    expect(urlOf()).toBe("/api/game/games?ecosystemId=ecosystem.acme");
    expect(found?.id).toBe("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
  });

  it("answers null for an ecosystem with no game", async () => {
    respondWith([]);
    await expect(gamesApi.forEcosystem("ecosystem.acme")).resolves.toBeNull();
  });

  // `game.games` is NOT in the backend's ECOSYSTEM_PARAM_SCOPED_TABLES, so `?ecosystemId=`
  // is an ordinary column filter rather than a scope override — and POST reads no query
  // params at all. Named in the query, the new game is filed under the CALLER's ecosystem
  // instead: silently, and with a 201.
  it("stamps a created game into its ecosystem through the BODY, not the query", async () => {
    await gamesApi.create(gameInput, "ecosystem.acme");
    expect(urlOf()).not.toContain("ecosystemId=");
    expect(bodyOf().ecosystemId).toBe("ecosystem.acme");
  });

  // A game does not move between ecosystems, and a PUT naming one is the only way to try.
  it("does not resend the ecosystem on update", async () => {
    await gamesApi.update("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34", gameInput);
    expect(urlOf()).toBe("/api/game/games/8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
    expect(bodyOf()).not.toHaveProperty("ecosystemId");
  });

  it("percent-encodes the id in the path", async () => {
    await gamesApi.delete("a b");
    expect(urlOf()).toBe(`/api/game/games/${encodeURIComponent("a b")}`);
  });

  it("filters each child collection by game in the QUERY", async () => {
    for (const [api, base] of [
      [gameDefinitionsApi, "definitions"],
      [gameEffectsApi, "effects"],
      [gameMappingsApi, "mappings"],
    ] as const) {
      fetchMock.mockReset();
      respondWith([]);
      await api.list("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
      expect(urlOf()).toBe(`/api/game/${base}?gameId=8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34`);
    }
  });

  it("parents a created definition through the BODY, not the query", async () => {
    respondWith(definitionRow);
    await gameDefinitionsApi.create("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34", definitionInput);
    expect(urlOf()).toBe("/api/game/definitions");
    expect(bodyOf().gameId).toBe("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
  });

  it("parents a created effect through the BODY, not the query", async () => {
    await gameEffectsApi.create("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34", effectInput);
    expect(urlOf()).toBe("/api/game/effects");
    expect(bodyOf().gameId).toBe("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
  });

  it("parents a created mapping through the BODY, not the query", async () => {
    await gameMappingsApi.create("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34", mappingInput);
    expect(urlOf()).toBe("/api/game/mappings");
    expect(bodyOf().gameId).toBe("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34");
  });

  // `definitions.author_customer_id` is ROUTE-MANAGED and masked out of the generic CRUD
  // body: a sent value is STRIPPED rather than refused, so the 201 looks identical either
  // way. The guarantee this client can actually make is that it never sends one.
  it("never sends a definition's author, which the route owns", async () => {
    respondWith(definitionRow);
    await gameDefinitionsApi.create("8f2b1c40-0d3e-4a7b-9c11-6e5a2d8f0b34", definitionInput);
    expect(bodyOf()).not.toHaveProperty("authorCustomerId");
  });

  it("names the entity, not the constraint, when a slug is taken", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: "games_ecosystem_slug_uniq already exists" } }),
      text: async () => "conflict",
    });
    await expect(gamesApi.create(gameInput, "ecosystem.acme")).rejects.toThrow(
      'A game with slug "cavern" already exists.',
    );
  });
});

// ── THE TWO COLUMN CROSSINGS ─────────────────────────────────────────────────────────
//
// Four columns are `string` on this side and are not strings on the wire. Both crossings
// are HELD at this boundary rather than asserted in a doc comment — every entity type in
// this module is a cast over whatever the route returns, so a comment promising a shape
// bought nothing.

describe("the nullable text columns", () => {
  it("reads a null description as an empty field", () => {
    const game = gameFromWire({ ...gameRow, description: null });
    expect(game.description).toBe("");
    // Nothing else is touched on the way past.
    expect(game.slug).toBe("cavern");
    expect(game.eventRetentionDays).toBe(90);
  });

  it("keeps a description that is actually there", () => {
    expect(gameFromWire(gameRow).description).toBe("Cold.");
  });

  it("writes an empty box as an empty COLUMN, not an empty string in one", () => {
    for (const typed of ["", "   "]) {
      expect(gameToWire({ ...gameInput, description: typed }).description).toBeNull();
      expect(
        definitionToWire({ ...definitionInput, description: typed }).description,
      ).toBeNull();
    }
  });

  it("applies the same reading rule to a definition", () => {
    const definition = definitionFromWire({ ...definitionRow, description: null });
    expect(definition.description).toBe("");
    // `author_customer_id` is NOT NULL with a `''` default — house-authored content, and
    // never a null to translate.
    expect(definition.authorCustomerId).toBe("");
  });
});

// `engine_config` and `data` are `jsonb`: the route hands back the PARSED value and stores
// whatever JSON value it is given, while the operator edits raw JSON TEXT. Sending the text
// unparsed stores a JSON STRING where the engine wants an object; handing the parsed value
// through as text gives `GameDetail`'s `d.engineConfig.trim()` an object to throw on.
describe("the jsonb columns", () => {
  it("reads a config OBJECT as the JSON text the operator edits", () => {
    const game = gameFromWire({ ...gameRow, engineConfig: { seed: 7 } });
    expect(game.engineConfig).toBe('{\n  "seed": 7\n}');
    // And it is text — the thing every form helper in this feature calls `.trim()` on.
    expect(typeof game.engineConfig).toBe("string");
  });

  it("parses the operator's text into a JSON VALUE on the way out", () => {
    const written = gameToWire({ ...gameInput, engineConfig: '{"seed":7}' });
    expect(written.engineConfig).toEqual({ seed: 7 });
    // Not the string — that stores a JSON string in the column.
    expect(written.engineConfig).not.toBe('{"seed":7}');
  });

  // `games.engine_config` is NOT NULL with a `{}` default, so its empty is the empty
  // OBJECT. Writing `null` there — the ordinary case of a game saved with the box blank —
  // is a 500 at the column.
  it("crosses an empty engine config as the empty OBJECT, both ways", () => {
    expect(gameFromWire(gameRow).engineConfig).toBe("");
    for (const typed of ["", "   "]) {
      const written = gameToWire({ ...gameInput, engineConfig: typed });
      expect(written.engineConfig).toEqual({});
      expect(written.engineConfig).not.toBeNull();
    }
  });

  // The type says this row cannot exist. The type is a cast over whatever the route
  // returns, and a null reaching the client makes `d.engineConfig.trim()` throw.
  it("reads a null engine config as an empty field, whatever the type says", () => {
    expect(gameFromWire({ ...gameRow, engineConfig: null }).engineConfig).toBe("");
  });

  // `definitions.data` IS nullable, so its empty is the empty COLUMN — the opposite answer
  // to the one above, from an identically empty box.
  it("crosses an empty definition payload as NULL, both ways", () => {
    expect(definitionFromWire(definitionRow).data).toBe("");
    const written = definitionToWire({ ...definitionInput, data: "" });
    expect(written.data).toBeNull();
    expect(written.data).not.toEqual({});
  });

  it("round-trips a real payload through both directions of the crossing", () => {
    const written = definitionToWire({ ...definitionInput, data: '{"prose":"a hall"}' });
    expect(written.data).toEqual({ prose: "a hall" });
    expect(definitionFromWire({ ...definitionRow, data: written.data }).data).toBe(
      '{\n  "prose": "a hall"\n}',
    );
  });

  // The forms block Save on unparseable JSON, so this is the second line — but it is the
  // one that cannot be bypassed. The 4xx `status` is load-bearing: `useMasterDetailForm`
  // hands what it caught to `reportUnexpectedAuthError`, whose gate keeps only status-less
  // and 5xx errors, so a bare Error reports an operator's typo to production telemetry as
  // an outage.
  it("refuses unparseable JSON with a 4xx the shared reporter drops", () => {
    const cases: [() => unknown, string][] = [
      [() => gameToWire({ ...gameInput, engineConfig: "{oops" }), "Engine config"],
      [() => definitionToWire({ ...definitionInput, data: "{oops" }), "Data"],
    ];
    for (const [call, label] of cases) {
      let thrown: unknown;
      try {
        call();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(`${label} must be valid JSON.`);
      expect((thrown as { status?: unknown }).status).toBe(400);
    }
  });
});
