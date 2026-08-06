/**
 * The path segments BELOW the workspace segment — the part of the URL that names WHAT the user is
 * looking at, as opposed to WHOSE it is.
 *
 * That split is the whole mechanism behind carrying a selection across a workspace switch. In this
 * platform the HTDV's selected path is not state anywhere: it IS the URL's segments, resolved one
 * level at a time (see useWorkspaceRoute's `switchHrefFor`). So "keep the selection when the
 * workspace changes" is exactly "keep these segments and change the one above them", and the only
 * thing a caller has to know is how many segments sit ABOVE the workspace — which is its basePath,
 * a fixed property of the route, not something to detect.
 *
 * Counting `basePath` rather than searching for the slug is deliberate. Matching on the slug reads
 * as more robust and is strictly worse: a workspace named `home` on a site based at `/home`, or an
 * entity whose id equals the workspace slug (`/acme/personas/acme`), makes "the first segment that
 * equals the slug" the wrong segment — silently, with a plausible-looking URL out the other side.
 * The segment count above the workspace cannot be wrong, because the route's own file layout is
 * what fixes it.
 *
 * @param pathname  The current path, as `usePathname()` gives it (leading slash, no query).
 * @param basePath  Whatever sits ABOVE the workspace segment — `''` when the workspace IS the
 *                  first segment (every feature site today, and the hub).
 * @returns The segments below the workspace, in order; `[]` when there are none, when the URL has
 *          not reached a workspace yet (a site's bare `/home`), or when it is shorter than its own
 *          base.
 */
export function workspacePathTail(pathname: string, basePath: string): string[] {
  const above = basePath.split('/').filter(Boolean).length
  return pathname.split('/').filter(Boolean).slice(above + 1)
}
