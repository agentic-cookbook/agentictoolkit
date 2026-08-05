import { type ReactElement, type ReactNode } from 'react';
import type { SiteHomeScope } from './SiteHomeModel';
/**
 * The shared shell for a feature site's `/home`: one workspace chooser in the header, and below
 * it that site's own HTDV scoped to the chosen workspace.
 *
 * Every site that scopes to a workspace used to grow its own chooser inside its HTDV stack —
 * eating the widest column, reimplemented per feature package, and the answer did not travel.
 * This owns all of it once:
 *
 *   - The ONE workspacesApi.list() fetch. Both picker mounts and the resolution read it.
 *   - Resolution: a slug already in the URL decides on its own. Otherwise the shell seeds one —
 *     but only once workspacePrefsApi.get() has settled, so a first visit with an empty
 *     localStorage cannot write a personal-workspace guess into the URL and permanently outrank
 *     the server's real answer. Once seeding is allowed: the stored preference → the personal
 *     workspace (workspacesApi.list() returns it first, so this costs no extra call) → nothing.
 *   - The URL as live truth: with no (or an unknown) slug, replace to `${basePath}/${slug}`.
 *   - Holding `children` until resolution, so no feature mounts unscoped and fires a list
 *     request the backend would answer with the wrong reach. `children` is a FUNCTION for that
 *     reason: a node would be CONSTRUCTED on every render, including the ones before a workspace
 *     exists, so its props could only be built from the raw URL segment — which is `undefined`
 *     at `/home` and stale mid-redirect. Called instead, it runs once the answer is known and is
 *     handed that answer.
 *   - Rendering the picker twice from that one source — portaled into the header centre (wide)
 *     and in a full-width toolbar (narrow), switched by CSS at 768px. Both read the same
 *     URL-derived state, so they cannot disagree; the hidden one is inert.
 *
 * Signed-out visitors never reach here: `/home` sits behind HomeGate.
 *
 * PRECONDITION: a `HeaderCenterProvider` must be mounted somewhere above this component — in
 * production that's `AdhAppShell.tsx` (`packages/adh/src/layout/AdhAppShell.tsx`), which wraps
 * both the header and the page in one. Without it, `useHeaderCenter()` always reads `null`, the
 * header portal never renders, and the desktop (≥768px) chooser silently disappears — only the
 * narrow `.adh-home__toolbar` copy, hidden above 768px by CSS, remains. This mount silently loses
 * its own picker rather than throwing; see the dev-only warning below.
 */
export declare function SiteHomeShell({ basePath, workspaceSlug, children, }: {
    /** The route's base — `/home` for every site today. Drives the URL and the list cache key. */
    basePath: string;
    /** The workspace segment as it stands in the URL, if any. */
    workspaceSlug?: string;
    /** This site's HTDV. Called — not rendered — once a workspace is resolved AND in the URL, with
     *  that workspace and the base already scoped to it. Sites do not implement this directly;
     *  SiteHomeRoute does, from the site's SiteHomeModel. */
    children: (scope: SiteHomeScope) => ReactNode;
}): ReactElement;
//# sourceMappingURL=SiteHomeShell.d.ts.map