// Local wire types for the Gamification realm-config client — the backend row +
// request-body shapes the client reads/sends (see ecosystems/wire.ts for the
// pattern: these replace the hub's generated `SuccessBody<...>` /
// `RequestBody<...>` from `@agentic-toolkit/adh-api-types`, adh product
// vocabulary a generic data client must not take on). Each interface carries
// exactly the fields the client and its call sites touch, transcribed from the
// `Gamification*` component schemas the backend's openapi.json documents for
// `/gamification/realms/{ecosystemId}/*` and `/gamification/replay`.
// Type-only file.

/** Season board window (`GamificationSeasons`); `null` ⇒ seasons off. */
export type Seasons = {
  /** Season 0 start day (YYYY-MM-DD, UTC). */
  anchor: string;
  /** Days per season. */
  lengthDays: number;
} | null;

/** `GET /gamification/realms/{ecosystemId}/config` — defaults when unset. */
export interface RealmConfig {
  ecosystemId: string;
  /** false leaves telemetry flowing but suppresses awards/UI. */
  enabled: boolean;
  skin: "rpg" | "plain";
  /** Per-surface toggles; a surface is ON unless set false. */
  surfaces: Record<string, boolean>;
  seasons: Seasons;
  /** IANA zone for the realm's day/streak boundary; defaults to 'UTC'. */
  timezone: string;
}

/** Partial update body for the config PUT — every field optional. */
export interface RealmConfigInput {
  enabled?: boolean;
  skin?: "rpg" | "plain";
  surfaces?: Record<string, boolean>;
  /** null clears seasons; an object sets the window (anchor + lengthDays 1..366). */
  seasons?: Seasons;
  timezone?: string;
}

/** `POST /gamification/replay` — and the `replayed` arm of a config PUT. */
export interface ReplayResult {
  /** Subjects touched (1 for a single-subject replay). */
  subjects: number;
  /** Newly-granted badges across the replayed subject(s). */
  badges: number;
  /** Points granted — single-subject replay only. */
  xpGained?: number;
}

/** Config PUT result; `replayed` is present only when enabling backfilled. */
export interface RealmConfigUpdate {
  config: RealmConfig;
  replayed?: ReplayResult;
}

/** A realm-owned badge row (`GamificationRealmBadge`) — no `source`. */
export interface RealmBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** The stat the rule watches. */
  statKey?: string | null;
  comparator?: ">=" | ">" | "=" | null;
  threshold?: number | null;
  /** Groups the tiers of one line. */
  badgeLine?: string | null;
  tier?: "none" | "bronze" | "silver" | "gold" | "platinum" | null;
  /** XP granted when earned. */
  pointValue: number;
  hidden?: boolean;
  active?: boolean;
  subjectType?: string | null;
  /** NULL = platform default; else the realm. */
  ecosystemId?: string | null;
}

/** A catalog badge: a realm badge row plus the tag saying who owns the slot. */
export type CatalogBadge = RealmBadge & {
  /** 'realm' when a realm row shadows the same-slot default. */
  source: "default" | "realm";
};

/** A catalog ladder rung — the rung as READ, source-tagged. */
export interface CatalogLevel {
  name: string;
  minPoints: number;
  source: "default" | "realm";
}

/**
 * `GET /gamification/realms/{ecosystemId}/catalog` — the EFFECTIVE catalog:
 * platform defaults merged with the realm's own overrides, every row
 * `source`-tagged. `source:'default'` rows are read-only; `source:'realm'` rows
 * are editable/deletable.
 */
export interface RealmCatalog {
  badges: CatalogBadge[];
  levels: CatalogLevel[];
}

/** Author/update body for a realm badge — every field required by the schema. */
export interface RealmBadgeInput {
  name: string;
  description: string;
  icon: string;
  statKey: string;
  comparator: ">=" | ">" | "=";
  threshold: number;
  badgeLine: string;
  tier: "none" | "bronze" | "silver" | "gold" | "platinum";
  pointValue: number;
  hidden: boolean;
}

/** A single ladder rung as SENT to the levels PUT (no `source` — that is read-only). */
export interface LevelRung {
  name: string;
  minPoints: number;
}

/** Replace-ladder body: `rungs[0].minPoints === 0`, strictly increasing. */
export interface RealmLevelsInput {
  rungs: LevelRung[];
}

/** Levels PUT result: the replaced ladder + the backfill hint. */
export interface RealmLevelsUpdate {
  levels: CatalogLevel[];
  /** The owner may POST /replay to backfill retroactively. */
  replayHint: string;
}

/**
 * A realm-defined custom event type — names which existing `gamification.stats`
 * stat_key its custom event bumps (POST /realms/:eco/events looks it up by name).
 */
export interface RealmEventType {
  id: string;
  ecosystemId: string;
  /** The custom event_type key. */
  name: string;
  /** The gamification stat this event bumps. */
  statKey: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Author/update body for a realm event type — both fields required, ≤64 chars. */
export interface RealmEventTypeInput {
  name: string;
  statKey: string;
}
