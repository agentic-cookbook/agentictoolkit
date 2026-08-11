/**
 * The ONE cache entry a persona's special interests live in.
 *
 * Two surfaces read that list and they must agree: `InterestsEditor` (the cards that create, edit
 * and delete them) and `KnowledgeFacet` (the tab strip that opens each one's corpus). A second key
 * for the same rows would mean the editor could save an interest the facet still doesn't offer a
 * tab for — so the key is derived here, in one place, and the editor writes its saves and deletes
 * straight through to it.
 *
 * The persona is a key SEGMENT, which is what removes the stale-response race by construction: a
 * read can only ever land on the entry for the persona it was made for.
 */
export function specialInterestsCacheKey(personaId: string | null): string {
  return `persona:${personaId ?? ""}:special-interests`;
}
