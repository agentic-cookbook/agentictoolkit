// The Teams URL grammar — the ONE authoritative parse of a teams route's path
// segments into TeamsFeature's selection props. The hub's /<slug>/teams/[[...path]]
// route calls this instead of re-deriving the same `[first, second, third]`
// destructure, so a grammar change can't drift a host's parsing away from the
// feature's own expectations (mirrors @agentic-toolkit/projects's parse-path).

/** The selection TeamsFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto TeamsFeature's props (the host supplies `basePath`). */
export interface TeamsPathSelection {
  /** The explicit "All teams" landing (`…/all`). Omitted for a bare path — a bare
   *  path lets ResourceExplorer resume last-selected or show All. */
  all?: boolean;
  activeTeamId?: string;
  activeTopic?: string;
  activeLeafId?: string;
}

/**
 * Parse a teams route's catch-all `path` segments:
 *   (none) / []          → {} (bare: resume last-selected or the All landing)
 *   ["all"]              → { all: true }
 *   [id]                 → { activeTeamId: id }
 *   [id, topic]          → { activeTeamId: id, activeTopic: topic }
 *   [id, topic, leaf]    → { …, activeLeafId: leaf }
 */
export function parseTeamsPath(path?: string[]): TeamsPathSelection {
  const [first, second, third] = path ?? [];
  if (!first) return {};
  if (first === "all") return { all: true };
  return { activeTeamId: first, activeTopic: second, activeLeafId: third };
}
