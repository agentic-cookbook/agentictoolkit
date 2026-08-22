// Games API client — the four OPERATOR-WRITABLE tables of the `game` schema
// (`game.games`, `game.definitions`, `game.effects`, `game.mappings`), over adh's
// generic CRUD routes. The schema's other eight tables are player state with no
// operator read path, and this client deliberately does not reach them.
//
// All four are at the 'owner' CRUD tier (backend crud/policy.ts CRUD_TIERS) and sit
// behind no roles-layer feature gate at all — `lib/feature-areas.ts` records the
// omission deliberately: a game is ECOSYSTEM-level configuration, not a workspace-owned
// artifact, so "whoever operates this ecosystem" is exactly the reach `owner` grants.
//
// SCOPING. `game.games` is NOT in ECOSYSTEM_PARAM_SCOPED_TABLES (that set holds six
// `integration.*` tables and `team.teams`, and nothing else), so `?ecosystemId=` is not
// a scope OVERRIDE here — the sibling Teams client's spelling does not transfer:
//   - on LIST it falls through to the ordinary column-filter loop (crud/factory.ts, the
//     `key === 'ecosystemId' && ecoScope !== undefined` skip does not fire), so it
//     narrows by `ecosystem_id` and is ANDed with the caller's own tenant pin.
//   - on CREATE a query param is read by nobody. The ecosystem travels in the BODY,
//     where `scopeIdProp` defaults it to the caller's ecosystem when absent and
//     `assertWriteWithinScope` 403s a foreign one.
// Either way the caller resolves the id with `ecosystemsApi.ecosystemIdForSlug(slug)`.
//
// ONE GAME PER ECOSYSTEM, AND WHY EVERY ID HERE IS A PLAIN UUID. `game.games` is NOT
// rdid-addressed — it has no address of its own. `id` is an opaque, server-generated
// uuid, like every other id in this file, and a game is reached as "the game of
// ecosystem X" through its product's ecosystem rdid rather than by an address of its
// own. That lookup is safe because a partial unique index (`uq_games_ecosystem`,
// `(ecosystem_id) WHERE deleted_at IS NULL`) enforces at most one live game per
// ecosystem — see `gamesApi.forEcosystem` below, now the primary way callers find a
// game. `game.games.ecosystem_id` still arrives as the product's ecosystem rdid — that
// direction never changed — but nothing here parses it; it is passed straight through,
// same as every other id.
//
// PARENT SCOPING. The children are filtered by `?gameId=` on list and carry `gameId` in
// the CREATE BODY — the same split as the ecosystem above, and for the same reason: the
// generic POST reads no query params.

import { authedJson, authedRequest, clientRefusal, rethrowConflict } from "../http";
import { enc, sortByText } from "../client-helpers";

/** `game.games.character_names` — whether players get a per-game display name and
 *  picture. Default `"off"`; a `check` behind it, so it is a closed set. */
export type GameCharacterNames = "off" | "optional" | "required";

/** `game.games.status`. Default `"active"`. `hidden` is delisted but still startable
 *  by anyone holding a link or a save; `retired` is neither. */
export type GameStatus = "active" | "hidden" | "retired";

/** `game.games.event_log` — whether the event log is the TRUTH. `authoritative` is never
 *  swept, whatever the retention window says; "keep forever" is spelled here and never as
 *  a magic `0` in a day count, where it would read as delete-immediately. Default
 *  `"debug"`; a `check` behind it, so it is a closed set. */
export type GameEventLog = "debug" | "authoritative";

/** A row of `game.games` — the catalog record. */
export interface Game {
  /** An opaque, server-generated uuid — no address of its own. A game is reached through
   *  its product's ecosystem rdid instead, one game per ecosystem; see
   *  `gamesApi.forEcosystem`. */
  id: string;
  /** Stable, URL-safe, ecosystem-unique. NOT the title. */
  slug: string;
  name: string;
  /** `text`, nullable in the schema. `""` here when the column is null — and that is a
   *  guarantee `gameFromWire` holds, not a hope: see THE TWO COLUMN CROSSINGS below. */
  description: string;
  engine: string;
  /** The engine's configuration, as the JSON TEXT the operator edits. Opaque — adh never
   *  reads it. The COLUMN is `jsonb`, so this is the text side of a parse/stringify
   *  crossing, not the stored shape; `""` here when the column holds its empty, `{}`. */
  engineConfig: string;
  characterNames: GameCharacterNames;
  status: GameStatus;
  eventLog: GameEventLog;
  /** The window the `debug` sweep applies (backend `sweepGameEvents`). NOT NULL, default
   *  90, and `> 0` by check — adh deletes rows on the strength of it. Ignored entirely
   *  when `eventLog` is `authoritative`. */
  eventRetentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameInput {
  slug: string;
  name: string;
  description: string;
  engine: string;
  engineConfig: string;
  characterNames: GameCharacterNames;
  status: GameStatus;
  eventLog: GameEventLog;
  eventRetentionDays: number;
}

/** `game.definitions.status` — only two, unlike a game's three. A definition is
 *  either offered or it is not; nothing about it is "startable". */
export type GameDefinitionStatus = "active" | "retired";

/** A row of `game.definitions` — the nouns a game declares (rooms, spells, items…). */
export interface GameDefinition {
  id: string;
  /** The parent game's uuid. */
  gameId: string;
  /** The author, and deliberately not `customerId` (that spelling would make the whole
   *  table customer-scoped for delta sync). NOT NULL with a `''` default: `''` is house-
   *  and operator-authored content, which is everything this site writes. READ-ONLY —
   *  the column is ROUTE-MANAGED (`ROUTE_MANAGED_COLUMNS`), stamped from the caller by
   *  `POST /game/terms`, and MASKED out of the generic CRUD body. Sending it would be
   *  stripped silently rather than refused, so this client does not send it. */
  authorCustomerId: string;
  /** The discriminator the schema collapsed `forms` and `terms` into. Game-defined —
   *  adh never branches on it, and neither does this client. */
  kind: string;
  /** The stable handle an engine refers to. Game-unique WITHIN `kind`. */
  key: string;
  name: string;
  /** `text`, nullable in the schema; `""` here when the column is null. */
  description: string;
  status: GameDefinitionStatus;
  sortOrder: number;
  /** The opaque payload, as the JSON TEXT the operator edits — the same `jsonb` crossing
   *  as `Game.engineConfig`, but over a NULLABLE column where that one is not. `""` here
   *  when the column is null, and back to null when the box is empty. */
  data: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameDefinitionInput {
  kind: string;
  key: string;
  name: string;
  description: string;
  status: GameDefinitionStatus;
  sortOrder: number;
  data: string;
}

/** `game.effects.trigger` — when the effect fires. A `check` behind it, so it is a
 *  closed set rather than the game's own vocabulary. */
export type GameEffectTrigger = "on_use" | "on_equip" | "on_hold" | "on_enter" | "on_acquire";

/** `game.effects.operation` — how the delta is applied. Also `check`ed, also closed. */
export type GameEffectOperation = "add" | "multiply" | "set";

/** A row of `game.effects` — the delta a definition applies, and what fires it. */
export interface GameEffect {
  id: string;
  /** The parent game's uuid. */
  gameId: string;
  /** The definition this effect hangs off. A plain uuid, like every other id here. */
  definitionId: string;
  /** The effect's stable handle WITHIN its definition. */
  key: string;
  trigger: GameEffectTrigger;
  /** A `game.stats.key` or a `game.key_values.key`. Game-defined: there is nothing on
   *  this side to validate it against. */
  target: string;
  operation: GameEffectOperation;
  value: number;
  /** Turns or seconds. **Null means "for as long as it is held"** — not "no duration",
   *  and emphatically not `0`, which would mean it expires immediately. */
  duration: number | null;
  /** Load-bearing: `add` then `multiply` is not `multiply` then `add`. */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameEffectInput {
  definitionId: string;
  key: string;
  /** `""` while the operator has not chosen yet — the closed set has no default, so a
   *  blank draft carries no trigger and the form is invalid until one is picked. */
  trigger: GameEffectTrigger | "";
  target: string;
  operation: GameEffectOperation | "";
  value: number;
  duration: number | null;
  sortOrder: number;
}

/** A row of `game.mappings` — a typed edge between two definitions. */
export interface GameMapping {
  id: string;
  /** The parent game's uuid. */
  gameId: string;
  /** The edge type — `exit`, `recipe_input`, `drops`, … The game's vocabulary, with no
   *  `check` behind it. */
  kind: string;
  /** Definition uuids, like `GameEffect.definitionId` and for the same reason. */
  fromId: string;
  toId: string;
  /** Default `1`. A recipe needs three iron, not one. */
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameMappingInput {
  kind: string;
  fromId: string;
  toId: string;
  amount: number;
  sortOrder: number;
}

// ── THE TWO COLUMN CROSSINGS ─────────────────────────────────────────────────────────
//
// Four columns are `string` on this side but are NOT strings on the wire, and each of the
// two reasons needs its own translation. Both are HELD HERE rather than asserted in a doc
// comment: every type above is a cast over whatever the route returns, so a comment
// promising a shape bought nothing.
//
// 1. NULLABLE TEXT — `games.description`, `definitions.description`. A form field's value
//    is text and `null` is not a thing a textarea can hold. A `description: null` reaching
//    the pane's `normalize` throws on `null.trim()` and the record becomes unsavable. So:
//    reading, `null → ""`; writing, `"" → null` — the empty COLUMN, not an empty string
//    in it.
//
// 2. JSONB — `games.engine_config`, `definitions.data`. These are `jsonb` COLUMNS, so the
//    route hands back the PARSED value (an object, an array, a number) and stores whatever
//    JSON value it is given. The operator edits raw JSON TEXT. Sending the text unparsed
//    stores a JSON STRING where the engine expects an object, and reading the parsed value
//    as text hands `GameDetail`'s `d.engineConfig.trim()` an object to throw on. So the
//    crossing is `JSON.parse` on write and `JSON.stringify` on read, in one place.
//
//    Their EMPTIES differ, and that difference is a schema fact, not a preference:
//    `engine_config` is NOT NULL with a `{}` default, so its empty is the empty JSON
//    OBJECT; `data` is nullable, so its empty is `null`. Posting `null` at the first would
//    500; posting `{}` at the second would show two characters the operator never typed.

/** The wire shape of a row: the client's, except the nullable text columns arrive as
 *  `null` and the `jsonb` columns arrive PARSED. Written as an intersection over the
 *  client type so the two cannot drift apart. */
type GameWire = Omit<Game, "description" | "engineConfig"> & {
  description: string | null;
  engineConfig: unknown;
};

type GameDefinitionWire = Omit<GameDefinition, "description" | "data"> & {
  description: string | null;
  data: unknown;
};

/** An empty box means the column is empty, not that it holds an empty string. */
function emptyToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

/**
 * A `jsonb` column, on the way OUT to the operator: the parsed value re-rendered as the
 * indented text they edit. `null` and the column's own empty both read as an empty box.
 *
 * `emptyValue` is the JSON value this column's empty box means — `{}` for the NOT NULL
 * `engine_config`, `null` for the nullable `data`. Compared by its SERIALIZATION, not by
 * identity, because the wire value is a fresh object every time.
 */
function jsonToText(value: unknown, emptyValue: unknown): string {
  if (value === undefined || value === null) return "";
  const text = JSON.stringify(value, null, 2);
  // `JSON.stringify` answers `undefined` for a value with no JSON form. Nothing a `jsonb`
  // column can hold has one, but this is a cast over the route's response, and showing
  // "undefined" in a textarea would be worse than showing an empty box.
  if (text === undefined) return "";
  return text === JSON.stringify(emptyValue) ? "" : text;
}

/**
 * The same column on the way IN: the operator's text, parsed. An empty box is
 * `emptyValue`; unparseable text is a 400 rather than a stored JSON string.
 *
 * The forms validate parseability before Save (`gameValidate`, `definitionValidate`), so
 * the throw is a second line and not the first — but this function is the one place that
 * cannot be bypassed, which is where an invariant belongs.
 */
function textToJson(text: string, emptyValue: unknown, label: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return emptyValue;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw clientRefusal(`${label} must be valid JSON.`);
  }
}

/** `games.engine_config` is NOT NULL, defaulted `{}`: its empty is the empty object. */
const ENGINE_CONFIG_EMPTY: unknown = {};
/** `definitions.data` is nullable: its empty is the empty COLUMN. */
const DEFINITION_DATA_EMPTY: unknown = null;

/** Exported for the boundary's own tests; every caller should go through the four API
 *  objects below, which apply these on the way past. */
export function gameFromWire(row: GameWire): Game {
  return {
    ...row,
    description: row.description ?? "",
    engineConfig: jsonToText(row.engineConfig, ENGINE_CONFIG_EMPTY),
  };
}

export function gameToWire(input: GameInput): Record<string, unknown> {
  return {
    ...input,
    description: emptyToNull(input.description),
    engineConfig: textToJson(input.engineConfig, ENGINE_CONFIG_EMPTY, "Engine config"),
  };
}

export function definitionFromWire(row: GameDefinitionWire): GameDefinition {
  return {
    ...row,
    description: row.description ?? "",
    data: jsonToText(row.data, DEFINITION_DATA_EMPTY),
  };
}

export function definitionToWire(input: GameDefinitionInput): Record<string, unknown> {
  return {
    ...input,
    description: emptyToNull(input.description),
    data: textToJson(input.data, DEFINITION_DATA_EMPTY, "Data"),
  };
}

// No `/api/game/…` prefix mystery: `/api` is a FRONTEND rewrite
// (`adh-next-config` maps `/api/:path*` onto the backend's prefix-less `/:path*`), the
// same shape `/api/team/teams` and `/api/bucket/buckets` use.
const GAMES = "/api/game/games";
const DEFINITIONS = "/api/game/definitions";
const EFFECTS = "/api/game/effects";
const MAPPINGS = "/api/game/mappings";

export const gamesApi = {
  /** The workspace's catalog. `ecosystemId` is the ecosystem's rdid or uuid; see SCOPING
   *  above for why it is a column filter here and a body field on create. */
  async list(ecosystemId?: string): Promise<Game[]> {
    const url = ecosystemId ? `${GAMES}?ecosystemId=${enc(ecosystemId)}` : GAMES;
    const rows = await authedJson<GameWire[]>(url);
    // The generic list has no ORDER BY, so the order is the planner's. Sorted here, by the
    // name the rail actually shows.
    return sortByText(rows.map(gameFromWire), (g) => g.name);
  },

  /** The ecosystem's (at most one) game — the primary lookup now that a product has at
   *  most one game. Safe to return a single row rather than a list: a partial unique
   *  index, `uq_games_ecosystem` on `(ecosystem_id) WHERE deleted_at IS NULL`, enforces
   *  at most one LIVE game per ecosystem, so this filtered list can never have more than
   *  one row to choose between. */
  async forEcosystem(ecosystemId: string): Promise<Game | null> {
    const rows = await gamesApi.list(ecosystemId);
    return rows[0] ?? null;
  },

  async create(input: GameInput, ecosystemId: string): Promise<Game> {
    // No pre-read for a duplicate slug: the backend's unique constraint is the real guard,
    // and a pre-read cannot see a soft-deleted row still holding the slug. Catch the 409.
    try {
      return gameFromWire(
        await authedJson<GameWire>(GAMES, {
          method: "POST",
          // `ecosystemId` in the BODY stamps the new game into the workspace's ecosystem.
          // Omitted, it would default to the CALLER's — the same ecosystem in the ordinary
          // case, and a silently misfiled game when it is not. Named, a foreign one is a
          // 403 rather than a wrong row.
          body: JSON.stringify({ ...gameToWire(input), ecosystemId }),
        }),
      );
    } catch (err) {
      rethrowConflict(err, `A game with slug "${input.slug}" already exists.`);
    }
  },

  /** `id` is the game's uuid. The ecosystem is NOT resent: a game does not move between
   *  ecosystems, and a PUT that named one would be the only way to try. */
  async update(id: string, input: GameInput): Promise<Game> {
    try {
      return gameFromWire(
        await authedJson<GameWire>(`${GAMES}/${enc(id)}`, {
          method: "PUT",
          body: JSON.stringify(gameToWire(input)),
        }),
      );
    } catch (err) {
      rethrowConflict(err, `A game with slug "${input.slug}" already exists.`);
    }
  },

  /** Generic CRUD TOMBSTONES rather than deleting (`deleted_at`) — so a deleted game's
   *  ecosystem is free for a new game, per `uq_games_ecosystem`'s `WHERE deleted_at IS NULL`. */
  async delete(id: string): Promise<void> {
    await authedRequest(`${GAMES}/${enc(id)}`, { method: "DELETE" });
  },
};

/**
 * The three per-game child collections share one shape, so they share one factory.
 *
 * `gameId` is the parent game's uuid: a LIST FILTER on the way in (`?gameId=`) and a BODY
 * field on create. The two spellings are not interchangeable — the generic POST reads no
 * query params, so a `?gameId=` create would insert with no parent and fail its NOT NULL.
 */
function childApi<TRow, TWire, TInput>(
  base: string,
  /** The column crossing for this collection (see THE TWO COLUMN CROSSINGS). `effects`
   *  and `mappings` have neither a nullable TEXT nor a `jsonb` column — `duration` is
   *  nullable but already typed `number | null`, so null needs no translation there —
   *  and pass the identity pair rather than a special case in here. */
  codec: { fromWire: (row: TWire) => TRow; toWire: (input: TInput) => Record<string, unknown> },
) {
  return {
    async list(gameId: string): Promise<TRow[]> {
      const rows = await authedJson<TWire[]>(`${base}?gameId=${enc(gameId)}`);
      return rows.map(codec.fromWire);
    },
    async create(gameId: string, input: TInput): Promise<TRow> {
      return codec.fromWire(
        await authedJson<TWire>(base, {
          method: "POST",
          body: JSON.stringify({ ...codec.toWire(input), gameId }),
        }),
      );
    },
    async update(id: string, input: TInput): Promise<TRow> {
      return codec.fromWire(
        await authedJson<TWire>(`${base}/${enc(id)}`, {
          method: "PUT",
          body: JSON.stringify(codec.toWire(input)),
        }),
      );
    },
    async delete(id: string): Promise<void> {
      await authedRequest(`${base}/${enc(id)}`, { method: "DELETE" });
    },
  };
}

/** Nothing to translate: this collection has neither a nullable text nor a jsonb column. */
const identityCodec = <TRow, TInput extends object>() => ({
  fromWire: (row: TRow) => row,
  // The cast is the interface/index-signature gap, not a shape claim: an `interface` with
  // no index signature is not assignable to `Record<string, unknown>` however plain its
  // fields are, and every input type here is one.
  toWire: (input: TInput): Record<string, unknown> => ({ ...input }) as Record<string, unknown>,
});

export const gameDefinitionsApi = childApi<
  GameDefinition,
  GameDefinitionWire,
  GameDefinitionInput
>(DEFINITIONS, { fromWire: definitionFromWire, toWire: definitionToWire });

export const gameEffectsApi = childApi<GameEffect, GameEffect, GameEffectInput>(
  EFFECTS,
  identityCodec<GameEffect, GameEffectInput>(),
);

export const gameMappingsApi = childApi<GameMapping, GameMapping, GameMappingInput>(
  MAPPINGS,
  identityCodec<GameMapping, GameMappingInput>(),
);
