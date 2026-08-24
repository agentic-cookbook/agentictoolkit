// The notebook URL grammar — the ONE authoritative parse of a notebook route's path
// segments into NotebookFeature's selection props, plus its inverse. Both live here so
// the reader and the writer can never disagree about where the note id starts.
//
//   /<base>                                → the whole notebook, nothing open
//   /<base>/work/meetings                  → that category chain selected
//   /<base>/-/<noteId>                     → an uncategorised note open
//   /<base>/work/meetings/-/<noteId>       → a note open inside that chain
//
// THREE RESERVED TOKENS, on one guarantee. The separator between the chain and the note id,
// and the category rail's two synthetic rows ("All" and "Uncategorized"), all live off the
// same fact — `slugify` (see `ui/src/lib/slug.ts`) trims non-alphanumerics from both ends, so
// a slug built from a real category NAME can never start with `-`, which reserves the whole
// `-*` space for these tokens. The canonical writeup — including WHY the separator exists
// rather than a UUID sniff or a reserved word — now lives in `@agentic-toolkit/categories`'
// `category-scope.ts`, the shared home of these values for every markdown surface's rail
// (research's `parse-path.ts` needs the identical grammar). This package depends on
// `@agentic-toolkit/categories` (it builds its category levels from the shared
// `useCategoryLevels` hook), so these are real re-exports rather than mirrors: the values do
// not change, only where they come from.
//
// Only `Uncategorized` and the separator reach the URL (`/<base>/-none`,
// `/<base>/-/<noteId>` — states the list can actually be in). `All` is the absence of a
// category, which the grammar already spells as no segments at all — so its token is a ROW id
// only, and a URL never contains it.

// Re-exported (not re-declared) so nothing downstream that imports these from this module has
// to change; `NOTE_SEPARATOR` is `CHAIN_SEPARATOR` under its old local name.
//
// FROM `@agentic-toolkit/categories/chain`, NOT the categories barrel. This module is built as
// its own directive-free chunk (the `./parse` subpath) so a server component can CALL the
// parser — but the categories barrel is a whole-file `"use client"` module and the toolkit
// packages are `external` in this build, so a barrel import survives verbatim into the
// server-safe chunk and hands an RSC an opaque client reference instead of the string `"-"`.
// `indexOf` then never matches and every `/<base>/-/<noteId>` URL parses as a category chain
// with no note open — silently, invisibly to `tsc` and vitest alike. No RSC calls this parser
// today; it is written this way so that the first one to try does not rediscover the bug
// research already shipped. See `categories/src/chain.ts`.
export { CHAIN_SEPARATOR as NOTE_SEPARATOR, UNCATEGORIZED_SLUG, ALL_CATEGORIES_ID } from "@agentic-toolkit/categories/chain";
// A separate import (a re-export alone creates no local binding) so the functions below can
// still read the separator by its established local name.
import { CHAIN_SEPARATOR as NOTE_SEPARATOR } from "@agentic-toolkit/categories/chain";

/** The selection NotebookFeature renders, parsed from a route's path segments.
 *  Maps 1:1 onto NotebookFeature's props (the host supplies `basePath`). */
export interface NotebookPathSelection {
  /** The selected category chain as slugs, outermost first. Empty = the whole notebook. */
  categorySlugs: string[];
  /** The open note's id, or undefined for the bare list. */
  noteId?: string;
}

/**
 * Parse a notebook route's catch-all `path` segments (see the grammar above). Everything
 * before the first `-` is the category chain; the segment after it is the note id. A
 * trailing `-` with nothing after it is simply "no note open" — the same state as omitting
 * the separator, so a hand-trimmed URL still lands somewhere valid.
 */
export function parseNotebookPath(path?: string[]): NotebookPathSelection {
  const segments = (path ?? []).filter(Boolean);
  const at = segments.indexOf(NOTE_SEPARATOR);
  if (at === -1) return { categorySlugs: segments };
  return { categorySlugs: segments.slice(0, at), noteId: segments[at + 1] };
}

/**
 * The inverse: the path segments below the base for a selection. Callers hand these to
 * `pushDeep`, so the separator is written by the same module that reads it. A null/absent
 * note id yields the chain alone (closing the note), which is what every "clear this level"
 * navigation wants.
 */
export function notebookSegments(categorySlugs: string[], noteId?: string | null): string[] {
  return noteId ? [...categorySlugs, NOTE_SEPARATOR, noteId] : [...categorySlugs];
}
