// The Personas URL grammar — the ONE authoritative parse of a personas route's path segments
// into PersonasFeature's selection props. A host (the hub's /[slug]/personas/[[...topic]] route,
// or a feature site's own catch-all) calls this instead of re-deriving the same
// `[personaId, subTab]` destructure, so a grammar change can't drift a host's parse.

/** The selection PersonasFeature renders, parsed from a route's path segments. Maps 1:1 onto
 *  PersonasFeature's props (the host supplies `basePath`). */
export interface PersonasPathSelection {
  /** The open persona's id (first path segment), or undefined for nothing open (the All table). */
  personaId?: string;
  /** The active editor sub-tab (second path segment), or undefined for the first tab (Identity). */
  subTab?: string;
}

/**
 * Parse a personas route's catch-all `path` segments:
 *   (none) / []            → {} (nothing open; the All personas table)
 *   [personaId]            → { personaId } (that persona open, first editor tab)
 *   [personaId, subTab]    → { personaId, subTab } (that persona open, on that editor tab)
 */
export function parsePersonasPath(path?: string[]): PersonasPathSelection {
  const [personaId, subTab] = path ?? [];
  return { personaId, subTab };
}
