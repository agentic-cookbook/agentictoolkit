// The /research URL grammar — the ONE authoritative parse of a research route's
// path segments into ResearchFeature's selection props. Both hosts (the hub's
// /[slug]/research/[[...path]] route and, in future, a feature site's own /home
// route) call this instead of re-deriving the same `[docId]` destructure, so a
// grammar change can't drift the two hosts into parsing the same URL differently.

/** The selection ResearchFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto ResearchFeature's props (the host supplies `basePath`). */
export interface ResearchPathSelection {
  /** The open document's id (first path segment), or undefined for the bare list. */
  docId?: string;
}

/**
 * Parse a research route's catch-all `path` segments:
 *   (none) / []  → {} (bare: the document list, nothing open)
 *   [docId]      → { docId } (that document open in the editor)
 */
export function parseResearchPath(path?: string[]): ResearchPathSelection {
  const [docId] = path ?? [];
  return { docId };
}
