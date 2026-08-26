// The three reserved URL TOKENS of the shared category rail — and NOTHING else.
//
// WHY THIS FILE EXISTS AT ALL, one layer below `category-scope.ts`. The package barrel
// (`src/index.ts`) opens with `"use client"`, and tsup builds it as one entry, so
// `dist/index.js` is a whole-file client module: every export it names — these constants
// included — reaches a React Server Component as an opaque CLIENT REFERENCE, not as a string.
// Nothing throws. `segments.indexOf(CHAIN_SEPARATOR)` just compares a string against a
// reference object, never matches, and returns -1 — so `/…/research/work/-/doc-1` parsed to
// `{ categorySlugs: ["work", "-", "doc-1"] }` and every research deep link silently opened the
// empty list. `tsc` and vitest cannot see this: in both, the import is an ordinary string.
//
// So the URL grammar's values get their own entry (`./chain`, its own directive-free chunk),
// which the server-safe `parse-path.ts` of research and notebook import instead of the barrel.
//
// THE ONE RULE FOR THIS FILE: it must import NOTHING. Not `@agenticdevelopertoolkit/ui`, not React,
// not a sibling module — a single import of anything that is (or ever becomes) a client module
// re-poisons this chunk transitively and restores the bug in a shape that is even harder to
// see. Values only, no types from elsewhere, no helpers. `packages/features/categories/
// tools/check-directives.py` asserts the built `dist/chain.js` stays directive-free, and it
// runs as part of `pnpm build`.

/**
 * The separator between a category CHAIN and whatever id follows it in a URL — a note id, a
 * research document id, or (in future) anything else a markdown surface opens beneath its rail.
 * Moved here from `features/notebook/src/parse-path.ts`, which owned it alone until research
 * needed the identical grammar for its own URLs; that file now re-exports it as `NOTE_SEPARATOR`
 * so nothing downstream had to change, and research imports it directly.
 *
 * WHY THE SEPARATOR. Categories are a TREE of arbitrary depth, so the chain has no fixed
 * length — and nothing in a slug distinguishes the last category from the id that follows it, so
 * a bare `[…tail]` is unparseable. `-` says where the chain ends. It is preferred over sniffing
 * for a UUID (a grammar that silently changes shape if ids ever do) and over a reserved word like
 * `note` (which a category NAMED "Note" would collide with, since a category's URL identity is
 * `slugify(name)`). `slugify` collapses runs of non-alphanumerics and trims them from both ends,
 * so it can never emit a bare `-`: no category can wear the separator's name, whatever it is
 * called.
 */
export const CHAIN_SEPARATOR = "-";

/**
 * The root list's two synthetic rows. THIS is now the canonical home of the `-*`
 * reservation that `features/notebook/src/parse-path.ts` used to own: `slugify` (see
 * `ui/src/lib/slug.ts`) lowercases, collapses non-alphanumerics to `-`, and then trims
 * leading/trailing hyphens — so a slug built from a real category NAME can never start
 * with `-`. That one fact reserves the entire `-*` namespace for synthetic rows, which is
 * why these values are `-`-prefixed rather than the plain words they read as: a real
 * category named "All" or "Uncategorized" slugifies to `all` / `uncategorized`, and if
 * these constants used those same bare words, `scopeFor` (in `./category-scope`) could no
 * longer tell a user's real category apart from the synthetic row — their notes would
 * resolve to the wrong scope and vanish behind it. `UNCATEGORIZED_SLUG` also appears in
 * real notebook URLs (`/<base>/-none`), so its value is a public URL contract, not just an
 * internal id.
 */
export const ALL_CATEGORIES_ID = "-all";
export const UNCATEGORIZED_SLUG = "-none";
