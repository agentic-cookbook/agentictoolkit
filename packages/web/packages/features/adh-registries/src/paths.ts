/**
 * The registries feature's URL grammar, stated once.
 *
 *   /<slug>/registries                        → the registries this workspace owns
 *   /<slug>/registries/all                    → …explicitly unselected
 *   /<slug>/registries/<id>                   → that registry, no topic chosen yet
 *   /<slug>/registries/<id>/<topic>           → …with one of its topics open
 *   /<slug>/registries/joined/<id>            → this member's own entry in that registry
 *   /<slug>/registries/joined/<id>/<section>  → …with a section of that entry open
 *
 * `parseRegistriesPath` parses it and `EntryEditorRoute` builds the `joined` half, which is
 * precisely why the reserved segment is a shared constant rather than a literal in each: a
 * parser and a builder that disagree about one word produce a link that renders the wrong
 * screen, and neither file is wrong on its own.
 *
 * A PURE function rather than the `if`-chain of components it replaces, matching
 * `@agentic-toolkit/projects`' `parse-path.ts`: the grammar is then assertable without
 * rendering anything, and the RSC page can call it before it reaches a client component.
 */

/** Reserved as a first segment, so a registry id can never be it. */
export const JOINED = 'joined';

/** The explicitly-unselected first segment, the shape `ResourceExplorer` already speaks. */
export const ALL = 'all';

/**
 * What a registries URL selects.
 *
 * A discriminated union rather than a component choice: the two arms are genuinely different
 * screens — the owner's explorer over registries they built, and the registrant's editor for
 * their own listing in one — and a union makes the route's job a `switch` over data instead of
 * a chain of length tests whose ordering carries meaning.
 */
export type RegistriesSelection =
  | {
      kind: 'joined';
      registryId: string;
      /** The editor's open section, off the URL's third segment. */
      section?: string;
    }
  | {
      kind: 'explorer';
      /** The explicit unselected state (`…/all`). Omitted for a bare path, which lets
       *  `ResourceExplorer` resume the last selection instead. */
      all?: boolean;
      activeId?: string;
      /**
       * The open topic. There is deliberately no level below it: `ResourceExplorer` supports a
       * deep-linkable leaf inside a topic (`activeLeafId`), and this grammar used to parse a
       * fourth segment into one — but no registry topic is a master/detail that reads it, so
       * every such link rendered exactly as the three-segment one it was built from. A URL level
       * that silently does nothing is worse than one that does not exist: it is the shape people
       * copy out of the address bar and send. When a topic here becomes master/detail, the level
       * comes back with the reader that gives it meaning.
       */
      activeTopic?: string;
    };

/**
 * Parse a registries route's catch-all `path` segments.
 *
 * `joined` is matched before anything else and requires a second segment, so a bare
 * `["joined"]` — which names no registry and so cannot open an editor — falls through to the
 * explorer rather than rendering an editor for `undefined`.
 */
export function parseRegistriesPath(path?: string[]): RegistriesSelection {
  const [first, second, third] = path ?? [];
  // `third` is read by the `joined` arm only — see the note on `activeTopic`.
  if (first === JOINED) {
    // Two or three: the third segment is the entry editor's open section (R4-C1), so a
    // registrant can link someone to the section they are talking about. Absent, the editor
    // opens on its own default.
    if (second) return { kind: 'joined', registryId: second, section: third };
    return { kind: 'explorer' };
  }
  if (!first) return { kind: 'explorer' };
  if (first === ALL) return { kind: 'explorer', all: true };
  return { kind: 'explorer', activeId: first, activeTopic: second };
}
