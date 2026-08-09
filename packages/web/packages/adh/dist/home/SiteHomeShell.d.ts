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
 *   - The ONE workspacesApi.list() fetch. The bar and the resolution read it.
 *   - Resolution, the URL-as-truth replace, and persistence of an explicit choice — all of it
 *     useWorkspaceRoute's, which the hub mounts too (its workspace lives at `/<slug>/home`, so
 *     it cannot use this shell's URL shape, but the behaviour behind the bar is the same one).
 *   - Holding `children` until resolution, so no feature mounts unscoped and fires a list
 *     request the backend would answer with the wrong reach. `children` is a FUNCTION for that
 *     reason: a node would be CONSTRUCTED on every render, including the ones before a workspace
 *     exists, so its props could only be built from the raw URL segment — which is `undefined`
 *     at `/home` and stale mid-redirect. Called instead, it runs once the answer is known and is
 *     handed that answer.
 *   - Rendering the chooser ONCE, in a labelled bar directly under the header, at every width.
 *
 * Signed-out visitors never reach here: the workspace route sits behind HomeGate.
 */
export declare function SiteHomeShell({ workspaceSlug, children, }: {
    /** The workspace segment as it stands in the URL, if any. */
    workspaceSlug?: string;
    /** This site's HTDV. Called — not rendered — once a workspace is resolved AND in the URL, with
     *  that workspace and the base already scoped to it. Sites do not implement this directly;
     *  SiteHomeRoute does, from the site's SiteHomeModel. */
    children: (scope: SiteHomeScope) => ReactNode;
}): ReactElement;
//# sourceMappingURL=SiteHomeShell.d.ts.map