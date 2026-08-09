import type { ReactNode } from 'react';
import type { Workspace } from '@agentic-toolkit/data';
/**
 * What the shell hands whatever it renders below itself. Every field is derived from the
 * RESOLVED workspace, not from the URL segment the caller was handed — the two disagree while
 * resolution is in flight, and this scope only exists after they agree.
 */
export interface SiteHomeScope {
    /** The resolved workspace's slug. Never empty: nothing below the shell renders until a
     *  workspace resolves AND the URL carries it. */
    workspaceSlug: string;
    /** `/${workspaceSlug}` — the base the site's own view is mounted at. Built here so no site
     *  builds it, and so the grammar changes in one place. */
    scopedBase: string;
    /**
     * The resolved workspace's own ROW, not just its slug — carried because the shell already has
     * it and a feature that needs any of it otherwise has to fetch the same list a second time.
     *
     * `kind` is the field that earned this: a surface whose wording or shape differs between a
     * personal workspace and an organization (the integrations site's first destination reads "My
     * Integrations" vs "Org Integrations") can only ask the row. Re-fetching for one enum would
     * duplicate the request this shell exists to own, and would answer LATER than the render that
     * needs it, so the label would flip under the user's cursor on every mount.
     */
    workspace: Workspace;
}
/** A scope plus whatever this site's `parse` made of the segments below the workspace. */
export interface SiteHomeContext<View> extends SiteHomeScope {
    view: View;
}
/**
 * One site's workspace-route declaration. `View` is inferred from `parse`, so a site never names
 * it.
 */
export interface SiteHomeModel<View> {
    /**
     * The path segments BELOW the workspace → this site's view state.
     *
     * `/acme/proj-1/notes` hands `['proj-1', 'notes']`. The workspace segment is already
     * consumed — a site that reads it here is reading the wrong layer, and `scopedBase` /
     * `workspaceSlug` are how it gets that.
     *
     * There is no `basePath` above it and no site declares one: the workspace IS the first segment
     * on every site, so the count of segments above it is zero everywhere and a field that can only
     * hold one value is a field three sites got to disagree about.
     *
     * This is also where a site says a path does NOT exist, by calling `notFound()` — the route
     * mounts one optional catch-all in every site, so "there is nothing at this depth" is a
     * statement about the site's grammar rather than about its file layout. A site with no grammar
     * at all below the workspace uses `noSubPath` below rather than writing that rule again.
     *
     * Called on every render, so it must be pure and cheap; parsing a handful of segments is both.
     */
    parse: (segments: string[]) => View;
    /** This site's workspace landing view. Called only once a workspace has resolved, so nothing
     *  here has to cope with an absent one. */
    render: (ctx: SiteHomeContext<View>) => ReactNode;
}
/**
 * Declares a site's workspace-route model.
 *
 * An identity function, and worth its existence for one reason: it INFERS `View` from `parse`'s
 * return type, so a site writes neither a type parameter nor a type annotation and still gets
 * `ctx.view` fully typed inside `render`. Annotating the object as `SiteHomeModel<Something>`
 * instead forces the site to name the type its own parser already decides.
 */
export declare function defineSiteHome<View>(model: SiteHomeModel<View>): SiteHomeModel<View>;
/**
 * The `parse` for a site with NO grammar below the workspace: `/<ws>` is the only address it has,
 * and anything deeper does not exist.
 *
 * This used to be said by the file layout — those sites mounted a plain `[workspace]/page.tsx`
 * rather than a catch-all, so Next answered a deeper path with not-found and no site wrote a rule.
 * It cost the family its one shape: a site that later grew a sub-path had to change its route
 * FILES, which is exactly the per-site divergence this route exists to remove. So every site now
 * mounts `[workspace]/[[...path]]/page.tsx` — the same bytes — and the depth a site accepts is a
 * line in its model instead of a directory on disk.
 *
 * Says the same thing to a visitor as the old layout did: `notFound()` renders the site's own
 * `app/not-found.tsx`. It is called during render of a Client Component, which Next's HTTP-access
 * fallback boundary catches the same way it catches a server one — the boundary is a React error
 * boundary in the client layout router, not a server-only path.
 *
 * Returns `null` so `View` infers as `null` for these sites, which is what their `render` already
 * expects; the `return` is unreachable, since `notFound()` throws.
 */
export declare function noSubPath(segments: string[]): null;
//# sourceMappingURL=SiteHomeModel.d.ts.map