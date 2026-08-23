"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { NotebookFeature } from "@agentic-toolkit/notebook";
import { parseNotebookPath } from "@agentic-toolkit/notebook/parse";

/**
 * The Notebook feature — this site's gated product surface: the workspace owner's notes,
 * browsed through a hierarchical category rail.
 *
 * This site's workspace route — `/<workspace>` and everything below it.
 *
 * Declared here rather than in a page because it is mounted TWICE: at
 * `app/[workspace]/[[...path]]` (the route itself) and at `app/home` (the workspace-less entry
 * every cross-site link names). SiteHomeRoute owns the assembly for both — it reads the workspace
 * segment and the path below it, and mounts what `render` returns inside SiteHomeShell, which
 * fetches the caller's workspaces, resolves the one to use (this URL's segment → their stored
 * preference → their personal workspace), keeps the URL in step, and renders the chooser in a bar
 * under the header. `scopedBase` arrives already built, so no site builds `${base}/${slug}` by
 * hand.
 *
 * A client module because a model carries functions, and functions cannot cross from a Server
 * Component into the client shell — see SiteHomeRoute.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const notebookHome = defineSiteHome({
  // `/<workspace>/<category>/<subcategory>/…[/-/<noteId>]` — a variable-depth category chain,
  // then the open note behind a separator. Imported from the package's SERVER-SAFE ./parse
  // subpath, never the barrel: the barrel's dist carries "use client".
  parse: parseNotebookPath,
  // `workspaceSlug` pins the notes to the workspace's owning principal, so an org workspace
  // shows the ORG's notes. That is the placeholder ownership for org notes: they are the org's
  // documents, filed in the org's `notes` bucket. Org-SHARED semantics are still undesigned and
  // land at this same seam.
  render: ({ scopedBase, workspaceSlug, view }) => (
    // No ToolkitQueryProvider: this surface holds its data in plain component state (as the
    // research surface it descends from does), so there is no react-query runtime to mount.
    <NotebookFeature basePath={scopedBase} workspaceSlug={workspaceSlug} {...view} />
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default notebookHome;
