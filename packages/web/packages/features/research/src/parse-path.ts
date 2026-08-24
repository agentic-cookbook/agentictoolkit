// The /research URL grammar — the ONE authoritative parse of a research route's path
// segments into ResearchFeature's selection props, plus its inverse. Both hosts (the hub's
// /[slug]/research/[[...path]] route and the research site's own /<ws>/home route) call this
// instead of re-deriving the same destructure, so a grammar change can't drift the two hosts
// into parsing the same URL differently.
//
//   /<base>                                → the whole document list, nothing open
//   /<base>/work/notes                     → that category chain selected
//   /<base>/-/<docId>                      → an uncategorised document open
//   /<base>/work/notes/-/<docId>           → a document open inside that chain
//
// This is the SAME grammar `@agentic-toolkit/notebook`'s `parse-path.ts` shipped first — see
// that file for why the separator is `-` and not a UUID sniff or a reserved word. The token
// itself is shared (`CHAIN_SEPARATOR`), so the two features can never drift into two different
// ideas of where a chain ends.
//
// IT COMES FROM `@agentic-toolkit/categories/chain`, NOT the categories barrel, and that is
// load-bearing rather than tidy. This module is built as its own directive-free chunk precisely
// so an RSC host page can CALL `parseResearchPath` — but the categories barrel is a whole-file
// `"use client"` module, and the toolkit packages are `external` in this build, so importing the
// token from the barrel left that client import verbatim in the server-safe chunk. In an RSC a
// value imported from a client module is an opaque client reference, not the string `"-"`;
// `indexOf` compares by identity, never matches, returns -1, and `/…/work/-/doc-1` parses as the
// three-segment CATEGORY chain `["work", "-", "doc-1"]` with no document. Nothing throws, and
// neither `tsc` nor vitest can see it — in both, this import is an ordinary string. `./chain`
// imports nothing, so it cannot be poisoned the same way.
//
// Rows 3 and 4 (a chain WITH a document open in the same URL) are hub-only in practice: on the
// research site the editor is a separate route (`/<ws>/edit/<docId>`) whose own page hands its
// path down to `SiteHomeRoute` as an explicit override — and that override still runs through
// this exact parser (`SiteHomeRoute` calls `model.parse(rest)` unconditionally, override or
// read-from-URL), so a URL there carries a chain OR a doc id, never both, but it is NOT true that
// this parser goes unused on that route. That is exactly why the editor page builds its override
// with `researchSegments([], paperUuid)` rather than a bare `[paperUuid]` array: a bare id has no
// separator, so it parses back as a one-segment CATEGORY chain, not a document, and the editor
// would open on the empty list. The grammar still supports both shapes (chain and doc together)
// because the parser has no way to know which host is calling it, and a narrower grammar here
// would be a fact about one host leaking into the shared parser.
import { CHAIN_SEPARATOR } from "@agentic-toolkit/categories/chain";

/** The selection ResearchFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto ResearchFeature's props (the host supplies `basePath`). */
export interface ResearchPathSelection {
  /** The selected category chain as slugs, outermost first. Empty = the whole list. */
  categorySlugs: string[];
  /** The open document's id, or undefined for the bare list. */
  docId?: string;
}

/**
 * Parse a research route's catch-all `path` segments (see the grammar above). Everything
 * before the first `-` is the category chain; the segment after it is the document id. A
 * trailing `-` with nothing after it is simply "no document open" — the same state as omitting
 * the separator, so a hand-trimmed URL still lands somewhere valid.
 */
export function parseResearchPath(path?: string[]): ResearchPathSelection {
  const segments = (path ?? []).filter(Boolean);
  const at = segments.indexOf(CHAIN_SEPARATOR);
  if (at === -1) return { categorySlugs: segments };
  return { categorySlugs: segments.slice(0, at), docId: segments[at + 1] };
}

/**
 * The inverse: the path segments below the base for a selection. Callers hand these to
 * `pushDeep`, so the separator is written by the same module that reads it. A null/absent
 * document id yields the chain alone (closing the document), which is what every "clear this
 * level" navigation wants.
 */
export function researchSegments(categorySlugs: string[], docId?: string | null): string[] {
  return docId ? [...categorySlugs, CHAIN_SEPARATOR, docId] : [...categorySlugs];
}
