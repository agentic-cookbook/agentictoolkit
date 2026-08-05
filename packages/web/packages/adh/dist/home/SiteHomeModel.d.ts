import type { ReactNode } from 'react';
/**
 * What the shell hands whatever it renders below itself. Both fields are derived from the
 * RESOLVED workspace, not from the URL segment the caller was handed — the two disagree while
 * resolution is in flight, and this scope only exists after they agree.
 */
export interface SiteHomeScope {
    /** The resolved workspace's slug. Never empty: nothing below the shell renders until a
     *  workspace resolves AND the URL carries it. */
    workspaceSlug: string;
    /** `${basePath}/${workspaceSlug}` — the base the site's own view is mounted at. Built here so
     *  no site builds it, and so the grammar changes in one place. */
    scopedBase: string;
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
    /** Whatever sits ABOVE the workspace segment — `''` for every site today, whose workspace is
     *  its first path segment, so the URL is `/<workspace>`. It is declared rather than assumed
     *  because it is the route's own property, and the shell keys its workspace-list cache on it. */
    basePath: string;
    /**
     * The path segments BELOW the workspace → this site's view state.
     *
     * `/acme/proj-1/notes` hands `['proj-1', 'notes']`. The workspace segment is already
     * consumed — a site that reads it here is reading the wrong layer, and `scopedBase` /
     * `workspaceSlug` are how it gets that.
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
//# sourceMappingURL=SiteHomeModel.d.ts.map