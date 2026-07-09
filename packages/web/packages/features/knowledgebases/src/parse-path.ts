// The Knowledge Bases route's URL grammar — the ONE authoritative parse of a knowledgebases
// route's catch-all path segments, ported faithfully from the hub route
// (main/hub/app/[slug]/(workspace)/knowledgebases/[[...table]]/page.tsx). Table selection there is
// LOCAL state inside the pane, not a URL segment — the catch-all is accepted (so the route shape
// exists for a future deep-link) but never read. Kept as a named parse (rather than each host
// re-deciding "ignore the segments" independently) so a future revision that promotes selection to
// the URL has one place to change the grammar.

/** Nothing is parsed from the path today — reserved for when table selection becomes
 *  deep-linkable. Maps 1:1 onto {@link KnowledgeBasesFeature}'s selection props (there are none
 *  yet). */
export type KnowledgeBasesPathSelection = Record<string, never>;

/**
 * Parse a knowledgebases route's catch-all `path` segments. Every input (including a populated
 * catch-all) currently yields `{}` — the segments are accepted, not read, exactly as the hub
 * route's `await params` discards them today.
 */
export function parseKnowledgeBasesPath(_path?: string[]): KnowledgeBasesPathSelection {
  return {};
}
