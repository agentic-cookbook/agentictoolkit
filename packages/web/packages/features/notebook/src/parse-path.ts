// The notebook URL grammar — the ONE authoritative parse of a notebook route's path
// segments into NotebookFeature's selection props, plus its inverse. Both live here so
// the reader and the writer can never disagree about where the note id starts.
//
//   /<base>                                → the whole notebook, nothing open
//   /<base>/work/meetings                  → that category chain selected
//   /<base>/-/<noteId>                     → an uncategorised note open
//   /<base>/work/meetings/-/<noteId>       → a note open inside that chain
//
// WHY THE SEPARATOR. Categories are a TREE of arbitrary depth, so the chain has no fixed
// length — and nothing in a slug distinguishes the last category from the note id, so a
// bare `[…tail]` is unparseable. `-` says where the chain ends. It is preferred over
// sniffing for a UUID (a grammar that silently changes shape if ids ever do) and over a
// reserved word like `note` (which a category NAMED "Note" would collide with, since a
// category's URL identity is `slugify(name)`). `slugify` collapses runs of
// non-alphanumerics and trims them from both ends, so it can never emit a bare `-`: no
// category can wear the separator's name, whatever it is called.

/** The separator between the category chain and the open note's id. */
export const NOTE_SEPARATOR = "-";

// TWO MORE RESERVED TOKENS, on the same guarantee. The category rail leads with two rows
// that are not categories — "All" and "Uncategorized" — and each needs an identity no real
// category can wear. `slugify` trims non-alphanumerics from both ends, so a slug never
// STARTS with `-`; that one fact is what reserves the whole `-*` space, and it is written
// down here rather than at either use site so there is one place to check it.
//
// Only `Uncategorized` reaches the URL (`/<base>/-none`, a state the list can actually be
// in). `All` is the absence of a category, which the grammar already spells as no segments
// at all — so its token is a ROW id only, and a URL never contains it.

/** The category rail's "Uncategorized" row — notes with no category. Appears in the URL. */
export const UNCATEGORIZED_SLUG = "-none";

/** The category rail's "All" row. A row id only; the URL for "all" is the bare base. */
export const ALL_CATEGORIES_ID = "-all";

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
