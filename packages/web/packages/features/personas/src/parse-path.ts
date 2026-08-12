// The SITE-ENTRY Personas URL grammar — the authoritative parse for hosts that mount
// PersonasFeature directly (the personabuilder site's /home catch-all): two segments,
// persona then editor sub-tab. NOTE the hub does NOT use this module: its grouped
// /[slug]/personas route is a THREE-level grammar (member ▸ entity ▸ sub-tab) owned by
// PersonasGroupRoute — changing this parse changes site mounts only.

/** The selection PersonasFeature renders, parsed from a route's path segments. Maps 1:1 onto
 *  PersonasFeature's props (the host supplies `basePath`). */
export interface PersonasPathSelection {
  /** The open persona's id (first path segment), or undefined for nothing open (the rail plus the
   *  frame's select nudge — there is no table beside it; docs/ui/fleet-ui-audit.md §1.5). */
  personaId?: string;
  /** The active editor sub-tab (second path segment), or undefined for the first tab (Identity). */
  subTab?: string;
}

/**
 * Parse a personas route's catch-all `path` segments:
 *   (none) / []            → {} (nothing open; the select nudge)
 *   [personaId]            → { personaId } (that persona open, first editor tab)
 *   [personaId, subTab]    → { personaId, subTab } (that persona open, on that editor tab)
 */
export function parsePersonasPath(path?: string[]): PersonasPathSelection {
  const [personaId, subTab] = path ?? [];
  return { personaId, subTab };
}
