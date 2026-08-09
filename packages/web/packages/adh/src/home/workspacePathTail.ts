/**
 * The path segments BELOW the workspace segment — the part of the URL that names WHAT the user is
 * looking at, as opposed to WHOSE it is.
 *
 * That split is the whole mechanism behind carrying a selection across a workspace switch. In this
 * platform the HTDV's selected path is not state anywhere: it IS the URL's segments, resolved one
 * level at a time (see useWorkspaceRoute's `switchHrefFor`). So "keep the selection when the
 * workspace changes" is exactly "keep these segments and change the one above them".
 *
 * Dropping exactly one segment — rather than searching the path for the slug — is deliberate. The
 * workspace is the FIRST segment on every site in the family, so its position is fixed by the
 * route's own file layout and cannot be got wrong. Matching on the slug reads as more robust and
 * is strictly worse: an entity whose id equals the workspace slug (`/acme/personas/acme`) makes
 * "the first segment that equals the slug" the wrong segment — silently, with a plausible-looking
 * URL out the other side.
 *
 * This took a `basePath` second argument until the routes converged, because three sites mounted
 * their workspace under `/home/`. Nothing above the workspace survives, so nothing is left to
 * count: a parameter that can only hold `''` is a parameter a caller can disagree with.
 *
 * @param pathname  The current path, as `usePathname()` gives it (leading slash, no query).
 * @returns The segments below the workspace, in order; `[]` when there are none and when the URL
 *          has not reached a workspace yet (a site's bare `/home`).
 */
export function workspacePathTail(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).slice(1)
}
