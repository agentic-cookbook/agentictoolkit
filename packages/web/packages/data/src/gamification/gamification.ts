"use client";

// Owner/admin-scoped gamification REALM config for ONE ecosystem (the "realm"). Backs the
// per-product Gamification panes — the hub's single settings pane and the gamification
// site's four-topic rail alike. Wired to the backend's
// /gamification/realms/:ecosystemId/config route (Phase 5 Task 1) through the host BFF's
// /api/:path* proxy.
//
// GET returns the realm's config (defaults when unset). PUT is a partial update; enabling a
// realm (false → true) triggers a retroactive replay, so its response may carry `replayed`.
//
// The types come from ./wire, this module's own transcription of the backend's
// `Gamification*` schemas — NOT from `@agentic-toolkit/adh-api-types`. Every other client
// in this package follows that rule (see ecosystems/wire.ts): a generic data client does
// not take a dependency on adh's generated product vocabulary.

import { enc } from "../client-helpers";
import { authedJson } from "../http";
import type {
  RealmConfig,
  RealmConfigInput,
  RealmConfigUpdate,
  RealmCatalog,
  RealmBadge,
  RealmBadgeInput,
  RealmLevelsInput,
  RealmLevelsUpdate,
  LevelRung,
  ReplayResult,
  RealmEventType,
  RealmEventTypeInput,
} from "./wire";

export type {
  RealmConfig,
  RealmConfigInput,
  RealmConfigUpdate,
  RealmCatalog,
  CatalogBadge,
  CatalogLevel,
  RealmBadge,
  RealmBadgeInput,
  RealmLevelsInput,
  RealmLevelsUpdate,
  LevelRung,
  ReplayResult,
  RealmEventType,
  RealmEventTypeInput,
  Seasons,
} from "./wire";

const configPath = (ecoId: string) => `/api/gamification/realms/${enc(ecoId)}/config`;
const catalogPath = (ecoId: string) => `/api/gamification/realms/${enc(ecoId)}/catalog`;
const badgesPath = (ecoId: string) => `/api/gamification/realms/${enc(ecoId)}/badges`;
const badgePath = (ecoId: string, id: string) =>
  `/api/gamification/realms/${enc(ecoId)}/badges/${enc(id)}`;
const levelsPath = (ecoId: string) => `/api/gamification/realms/${enc(ecoId)}/levels`;
const replayPath = () => `/api/gamification/replay`;
const eventTypesPath = (ecoId: string) => `/api/gamification/realms/${enc(ecoId)}/event-types`;
const eventTypePath = (ecoId: string, id: string) =>
  `/api/gamification/realms/${enc(ecoId)}/event-types/${enc(id)}`;

export const gamificationApi = {
  /** Read a realm's gamification config (admin/owner-gated). */
  getRealmConfig(ecoId: string): Promise<RealmConfig> {
    return authedJson<RealmConfig>(configPath(ecoId));
  },

  /** Update a realm's gamification config (partial). Enabling it replays retroactively. */
  updateRealmConfig(ecoId: string, input: RealmConfigInput): Promise<RealmConfigUpdate> {
    return authedJson<RealmConfigUpdate>(configPath(ecoId), {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /** Read a realm's effective catalog — source-tagged defaults + realm overrides. */
  getCatalog(ecoId: string): Promise<RealmCatalog> {
    return authedJson<RealmCatalog>(catalogPath(ecoId));
  },

  /** Author a realm badge (overrides the same (badgeLine, tier) default). 400 on bad input. */
  createRealmBadge(ecoId: string, input: RealmBadgeInput): Promise<RealmBadge> {
    return authedJson<RealmBadge>(badgesPath(ecoId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Update a realm-owned badge (404 for a platform default). 400 on bad input. */
  updateRealmBadge(ecoId: string, id: string, input: RealmBadgeInput): Promise<RealmBadge> {
    return authedJson<RealmBadge>(badgePath(ecoId, id), {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /** Delete a realm-owned badge (clears its holdings first; 404 for a default). */
  deleteRealmBadge(ecoId: string, id: string): Promise<{ deleted: string }> {
    return authedJson<{ deleted: string }>(badgePath(ecoId, id), { method: "DELETE" });
  },

  /** Replace the realm's level ladder wholesale (must start at 0, strictly increasing). 400 otherwise. */
  putRealmLevels(ecoId: string, rungs: LevelRung[]): Promise<RealmLevelsUpdate> {
    return authedJson<RealmLevelsUpdate>(levelsPath(ecoId), {
      method: "PUT",
      body: JSON.stringify({ rungs } satisfies RealmLevelsInput),
    });
  },

  /** Retroactively backfill the whole realm from telemetry already earned. */
  replayRealm(ecoId: string): Promise<ReplayResult> {
    return authedJson<ReplayResult>(replayPath(), {
      method: "POST",
      body: JSON.stringify({ ecosystemId: ecoId }),
    });
  },

  /** List a realm's custom event types, name-ordered. */
  listEventTypes(ecoId: string): Promise<RealmEventType[]> {
    return authedJson<RealmEventType[]>(eventTypesPath(ecoId));
  },

  /** Register a realm custom event type. 400 on a bad input; 409 on a duplicate name. */
  createEventType(ecoId: string, input: RealmEventTypeInput): Promise<RealmEventType> {
    return authedJson<RealmEventType>(eventTypesPath(ecoId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Update a realm event type. 404 for a foreign realm's row; 409 on a colliding rename. */
  updateEventType(ecoId: string, id: string, input: RealmEventTypeInput): Promise<RealmEventType> {
    return authedJson<RealmEventType>(eventTypePath(ecoId, id), {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /** Delete a realm event type (404 for a foreign realm's row or an unknown id). */
  deleteEventType(ecoId: string, id: string): Promise<{ deleted: string }> {
    return authedJson<{ deleted: string }>(eventTypePath(ecoId, id), { method: "DELETE" });
  },
};
