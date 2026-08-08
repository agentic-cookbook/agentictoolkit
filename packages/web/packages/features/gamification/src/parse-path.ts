import { parseEcosystemsPath, type EcosystemsPathSelection } from "@agentic-toolkit/ecosystems/parse";

/**
 * The gamification site's URL grammar, below the workspace segment:
 *
 *   /<workspace>/<productId>/<topic>[/<leafId>[/<entityId>]]
 *
 * Which is the ecosystems grammar exactly — the rail IS an ecosystems rail, presented under the
 * Product noun with a gamification topic set. So this delegates rather than restating it: a
 * second copy of "first segment is the entity, second is the topic" is a rule that can drift
 * from the one the feature actually navigates by.
 *
 * SERVER-SAFE, and its own entry (`@agentic-toolkit/gamification/parse`) for that reason: the
 * package barrel's dist carries "use client", so an RSC importing the parser from there would
 * throw on a render-only client reference. Mirrors @agentic-toolkit/ecosystems/parse.
 */
export type GamificationPathSelection = EcosystemsPathSelection;

export function parseGamificationPath(path?: string[]): GamificationPathSelection {
  return parseEcosystemsPath(path);
}
