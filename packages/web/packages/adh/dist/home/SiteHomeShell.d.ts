import { type ReactElement, type ReactNode } from 'react';
import type { SiteHomeScope } from './SiteHomeModel';
/**
 * The shared shell for a feature site's workspace route: one labelled workspace chooser in a bar
 * directly under the header, and below it that site's own HTDV scoped to the chosen workspace.
 *
 * Every site that scopes to a workspace used to grow its own chooser inside its HTDV stack —
 * eating the widest column, reimplemented per feature package, and the answer did not travel.
 * This owns all of it once:
 *
 *   - The ONE workspacesApi.list() fetch. The picker and the resolution read it.
 *   - Resolution: a slug already in the URL decides on its own. Otherwise the shell seeds one —
 *     but only once workspacePrefsApi.get() has settled, so a first visit with an empty
 *     localStorage cannot write a personal-workspace guess into the URL and permanently outrank
 *     the server's real answer. Once seeding is allowed: the stored preference → the personal
 *     workspace (workspacesApi.list() returns it first, so this costs no extra call) → nothing.
 *   - The URL as live truth: with no (or an unknown) slug, replace to `${basePath}/${slug}`. That
 *     is also what makes the site's bare `/home` a redirect rather than a page of its own — it
 *     mounts this shell with no segment, and the first thing the shell does is send the browser
 *     to the resolved workspace's URL.
 *   - Holding `children` until resolution, so no feature mounts unscoped and fires a list
 *     request the backend would answer with the wrong reach. `children` is a FUNCTION for that
 *     reason: a node would be CONSTRUCTED on every render, including the ones before a workspace
 *     exists, so its props could only be built from the raw URL segment — which is `undefined`
 *     at `/home` and stale mid-redirect. Called instead, it runs once the answer is known and is
 *     handed that answer.
 *   - Rendering the chooser ONCE, in a labelled bar directly under the header, at every width.
 *
 * The chooser used to be portaled into the header's centre slot above 768px, with this bar as the
 * narrow-only fallback. That arrangement is gone: the header is built by the site's root layout,
 * above the route, so reaching its centre from here took a context published by a provider the
 * host had to remember to mount — and a host that forgot lost the chooser silently, above 768px
 * only, in production only. One bar the route renders itself has no such precondition and no
 * second copy to keep in step.
 *
 * Signed-out visitors never reach here: the workspace route sits behind HomeGate.
 */
export declare function SiteHomeShell({ basePath, workspaceSlug, children, }: {
    /** The base ABOVE the workspace segment — `''` for a site whose workspace sits at its root,
     *  so the URL is `/<workspace>`. Drives the URL and the list cache key. */
    basePath: string;
    /** The workspace segment as it stands in the URL, if any. */
    workspaceSlug?: string;
    /** This site's HTDV. Called — not rendered — once a workspace is resolved AND in the URL, with
     *  that workspace and the base already scoped to it. Sites do not implement this directly;
     *  SiteHomeRoute does, from the site's SiteHomeModel. */
    children: (scope: SiteHomeScope) => ReactNode;
}): ReactElement;
//# sourceMappingURL=SiteHomeShell.d.ts.map