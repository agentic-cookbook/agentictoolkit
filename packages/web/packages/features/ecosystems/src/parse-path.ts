// The Ecosystems URL grammar — the ONE authoritative parse of an ecosystems route's path
// segments into EcosystemsFeature's selection props, so a host route can't drift its
// parsing away from what the feature expects (mirrors @agentic-toolkit/projects and
// @agentic-toolkit/teams's parse-path).

/** The selection EcosystemsFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto EcosystemsFeature's props (the host supplies `basePath` + the
 *  host-composition config). Unlike Teams/Projects there is no "All" landing — the
 *  ecosystem list itself lives inside the "Child Ecosystems" topic — so a bare/"all"
 *  path both mean the same thing: open the workspace's default ecosystem's topics. */
export interface EcosystemsPathSelection {
  activeEcoId?: string;
  activeTopic?: string;
  activeLeafId?: string;
  /** The 5th URL segment: the deep-linkable inner entity of an open GROUP member
   *  (…/<ecoId>/<group>/<member>/<entity>). */
  activeMemberEntityId?: string;
}

/**
 * Parse an ecosystems route's catch-all `path` segments:
 *   (none) / [] / ["all"]           → {} (opens on the workspace default ecosystem's topics)
 *   [id]                            → { activeEcoId: id }
 *   [id, topic]                     → { …, activeTopic: topic }
 *   [id, topic, leaf]               → { …, activeLeafId: leaf }
 *   [id, topic, leaf, memberEntity] → { …, activeMemberEntityId: memberEntity }
 */
export function parseEcosystemsPath(path?: string[]): EcosystemsPathSelection {
  const [first, second, third, fourth] = path ?? [];
  if (!first || first === "all") return {};
  return {
    activeEcoId: first,
    activeTopic: second,
    activeLeafId: third,
    activeMemberEntityId: fourth,
  };
}
