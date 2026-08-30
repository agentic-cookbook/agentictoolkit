import { type ReactElement } from 'react';
import type { SiteHomeHostSeams, SiteHomeModel } from './SiteHomeModel';
/**
 * The whole workspace route, for every site. A site's page.tsx renders this and nothing else.
 *
 * This is the ONE place the arrangement lives: read the workspace segment and the path below it,
 * hand the rest to the site's parser, and mount the site's view inside the shell at the
 * workspace-scoped base. A site supplies a model (see ./SiteHomeModel) and supplies no assembly.
 *
 * MOUNTED ONCE OR MORE per site, and the `/home` mount is the whole redirect mechanism:
 *
 *   - `app/[workspace]/[[...path]]/page.tsx` — the workspace route itself, `/<ws>/<rest…>`.
 *   - `app/home/page.tsx` — no params at all, so the shell resolves the user's workspace and
 *     replaces the URL with it (at `model.workspaceHref`, if the site declares one). `/home`
 *     is a redirect, not a page, and it needs no resolution logic of its own.
 *   - A site MAY mount it at NAMED routes instead of the catch-all — research mounts
 *     `[workspace]/home` and `[workspace]/edit/[paperUuid]`, because its `[workspace]` root is a
 *     public page and the two gated surfaces are gated by their own layouts. Such a route has no
 *     `path` param to read, so it passes `path` explicitly; see that prop.
 *
 * A CLIENT component, and that is load-bearing rather than incidental. A model carries functions
 * (`parse`, `render`), and functions cannot cross from a Server Component into a Client one — so
 * if the assembly stayed in a server page.tsx, the model could never reach the client shell and
 * every site would be back to hand-assembling. Moving the assembly here makes each site's page a
 * client module, nothing crosses a boundary, and the shell can therefore take a FUNCTION child.
 * That last part is what lets `scopedBase` be built from the resolved workspace instead of from
 * the raw URL segment — see SiteHomeShell's `children`.
 *
 * Reading the path from `useParams` rather than a prop follows from the same thing: a server page
 * that awaited `params` to pass them down would be a server→client crossing again, for data the
 * client can read directly.
 */
export declare function SiteHomeRoute<View, Host extends SiteHomeHostSeams = SiteHomeHostSeams>({ model, path, host, }: {
    model: SiteHomeModel<View, Host>;
    /**
     * The segments below the workspace, when the ROUTE knows them and the URL does not spell them
     * as a catch-all. A site whose editor lives at `[workspace]/edit/[paperUuid]` has no `path`
     * param to read — its shape is two named segments — so it reads its own and hands them down:
     * `path={[paperUuid]}`.
     *
     * Note what is NOT passed: the literal `edit`. A host's segments are its own URL grammar, and
     * `model.parse` speaks the FEATURE's grammar — the same one the hub's
     * `/<slug>/research/<docId>` speaks. Passing `['edit', uuid]` would give the feature two
     * grammars to parse and put the site's URL layout inside a shared parser, which is exactly the
     * drift that parser exists to prevent.
     *
     * Overrides the route param when given, INCLUDING when it is empty: `[]` means "this route has
     * no segments below the workspace", which is a statement, not an absence.
     */
    path?: string[];
    /**
     * The HOST's seams for this model — chrome the model cannot build for itself and the host can.
     * See SiteHomeModel.render.
     *
     * A fact about one MOUNT, not about the site, which is why it is here and not on the model:
     * the whole point is that the same model renders with the hub's transfer section on
     * agenticdeveloperhub.com and without it on the feature site, from one set of bytes. Contrast
     * `workspaceHref`, which is a fact about the SITE and therefore lives on the model so its
     * three mounts cannot disagree.
     *
     * A site mounting its OWN model omits this and the model sees `{}` — every seam absent, which
     * is what a feature site renders today and must go on rendering. Nothing here is a default the
     * site is missing out on.
     */
    host?: Host;
}): ReactElement;
//# sourceMappingURL=SiteHomeRoute.d.ts.map