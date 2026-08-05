// The Projects URL grammar below the workspace — the ONE authoritative parse of a
// projects route's path segments into ProjectsFeature's selection props. Both hosts
// (the hub's /[slug]/projects/[[...path]] route and the projects site's workspace
// route, /[workspace]/[[...path]], which names this as its SiteHomeModel's `parse`)
// call this instead of re-deriving the same `[first, second, third]` destructure,
// so a grammar change can't drift the two hosts into parsing the same URL
// differently.

/** The selection ProjectsFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto ProjectsFeature's props (the host supplies `basePath`). */
export interface ProjectsPathSelection {
  /** The explicit "All projects" landing (`…/all`). Omitted for a bare path — a
   *  bare path lets ResourceExplorer resume last-selected or show All. */
  all?: boolean;
  activeProjectId?: string;
  activeTopic?: string;
  activeLeafId?: string;
}

/**
 * Parse a projects route's catch-all `path` segments:
 *   (none) / []          → {} (bare: resume last-selected or the All landing)
 *   ["all"]              → { all: true }
 *   [id]                 → { activeProjectId: id }
 *   [id, topic]          → { activeProjectId: id, activeTopic: topic }
 *   [id, topic, leaf]    → { …, activeLeafId: leaf }
 */
export function parseProjectsPath(path?: string[]): ProjectsPathSelection {
  const [first, second, third] = path ?? [];
  if (!first) return {};
  if (first === "all") return { all: true };
  return { activeProjectId: first, activeTopic: second, activeLeafId: third };
}
