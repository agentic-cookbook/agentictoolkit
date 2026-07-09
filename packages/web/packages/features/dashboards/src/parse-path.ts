// The Dashboards URL grammar — the ONE authoritative parse of a dashboards route's
// path segments into DashboardsFeature's selection props. A host (the hub's
// /[slug]/dashboards/[[...topic]] route) calls this instead of re-deriving the same
// `[section, rowId]` destructure, so a grammar change can't drift a host's parse.

/** The selection DashboardsFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto DashboardsFeature's props (the host supplies `basePath`). */
export interface DashboardsPathSelection {
  /** The open section ("groups" | "sites"), or undefined for nothing selected. */
  section?: string;
  /** The selected group/site row id, or undefined for none. */
  rowId?: string;
}

/**
 * Parse a dashboards route's catch-all `path` segments:
 *   (none) / []       → {} (nothing open; pick Groups or Sites)
 *   [section]         → { section } (that section's list, no row open)
 *   [section, rowId]  → { section, rowId } (that group/site open in the editor)
 */
export function parseDashboardsPath(path?: string[]): DashboardsPathSelection {
  const [section, rowId] = path ?? [];
  return { section, rowId };
}
