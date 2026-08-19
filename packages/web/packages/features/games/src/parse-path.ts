// Server-safe path parsing for the games workspace. Deliberately its own entry
// (`@agentic-toolkit/games/parse`): the package's main barrel carries 'use client',
// and preserve-directives propagates a chunk's directive to every entry importing
// it, so a parser re-exported from there would turn the whole bundle into a Client
// Component. Nothing complains when that happens — a Client Component is legal, so
// types, tests and `next build` all pass.

/** The positional URL grammar of the games workspace, after the workspace segment. */
export interface GamesPathSelection {
  /** The reserved `all` segment: the fleet's explicit "nothing selected". */
  all?: boolean;
  /** The reserved `new` segment: the create-game dialog. */
  creating?: boolean;
  activeGameId?: string;
  activeTopic?: string;
  activeLeafId?: string;
  activeMemberEntityId?: string;
}

/**
 * `/<workspace>/<gameId>/<topic>/<leafId>/<entityId>`, with two reserved first
 * segments — `all` (nothing selected) and `new` (the create dialog).
 *
 * Reserving `new` is safe because a game's id is an rdid (`game.<eco>.<slug>`) or a
 * uuid, never the bare string. It is a PATH segment rather than a `?new=` search param
 * so the whole grammar stays in this one pure function: the Create Game button (see
 * CreateGameAction) navigates rather than opening the dialog by state — ResourceExplorer's
 * create dialog only opens from its own internal `useState`, and there is no external signal
 * to send it — so the feature reads the reserved segment off the URL instead. A search param
 * would have needed `useSearchParams`, which opts a route into client-side rendering at build
 * time, to buy nothing this does not already give (both are deep-linkable and both survive a
 * refresh).
 */
export function parseGamesPath(path?: string[]): GamesPathSelection {
  const [first, second, third, fourth] = path ?? [];
  if (!first) return {};
  if (first === "all") return { all: true };
  if (first === "new") return { creating: true };
  return {
    activeGameId: first,
    activeTopic: second,
    activeLeafId: third,
    activeMemberEntityId: fourth,
  };
}
