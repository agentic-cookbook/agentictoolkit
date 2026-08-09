import type { ComponentType, ReactNode } from 'react';
/**
 * What the shell hands whatever it renders below itself. Both fields are derived from the
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
}
/** A scope plus whatever this site's `parse` made of the segments below the workspace. */
export interface SiteHomeContext<View> extends SiteHomeScope {
    view: View;
}
/**
 * What a workspace shell is handed: the workspace as the URL spells it (absent at `/home`),
 * and the site's own view as a FUNCTION to call once a workspace has actually resolved.
 *
 * Declared here rather than in SiteHomeShell so a site's model can name the type without
 * importing the shell — and therefore without pulling `@agentic-toolkit/data` in behind it.
 */
export interface SiteHomeShellProps {
    /** The workspace segment as it stands in the URL, if any. */
    workspaceSlug?: string;
    /** The site's view. Called — not rendered — once a workspace is resolved AND in the URL. */
    children: (scope: SiteHomeScope) => ReactNode;
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
    /**
     * This site's own shell around `render`, in place of the shared `<SiteHomeShell>`.
     *
     * The seam that lets `app/home/page.tsx` and `app/[workspace]/[[...path]]/page.tsx` be the
     * same bytes in a site whose workspace chrome is not the family's. `hub` is the one that
     * sets it, and for a reason that is a product question rather than a layout one: its picker
     * carries teams and the per-workspace feature grants that decide which rows may open what,
     * and the shared shell's `workspacesApi.list()` returns neither. Feeding those through the
     * shared shell would mean either every site grows teams or the hub loses them — so the shell
     * is the seam and the answer stays open.
     *
     * A shell owns four things and a replacement owes all four: resolving `/home`'s absent
     * workspace and replacing the URL with it, refusing a slug the caller cannot reach with a
     * `notFound()` rather than a redirect, holding `children` until the resolution agrees with the
     * URL, and drawing the chooser. See SiteHomeShell for what each is defending. The hub owes the
     * refusal like everyone else and pays it ABOVE this seam — its `WorkspaceGate` matches the slug
     * against the caller's memberships before the shell mounts at all — which is why HubHomeShell
     * has no such check of its own.
     */
    shell?: ComponentType<SiteHomeShellProps>;
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